'use strict';

/**
 * Picks the AI provider for a workspace.
 *
 *   workspace.settings.ai.provider  →  AIProvider record (key sealed under SERVER_KEK)
 *                                   →  provider instance from ai/providers
 *   otherwise                       →  the process-wide default (AI_PROVIDER + env keys)
 *
 * Instances are cached per workspace for a minute so a chat turn never rebuilds
 * SDK clients; `invalidate(workspaceId)` is called when settings change.
 */

const identity = require('../../identity');
const AIProvider = require('../integrations/ai-provider.model');
const { createProvider, modelsFor } = require('../../../../ai/providers');
const aiConfig = require('../../../../ai/config');
const { openSecret } = require('../../modules/conversations/cryptoUtils');
const logger = require('../../../utils/logger');

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // workspaceId -> { at, value }

function invalidate(workspaceId) {
    if (workspaceId) {
        for (const k of cache.keys()) if (k === String(workspaceId) || k.startsWith(`${workspaceId}:`)) cache.delete(k);
    } else cache.clear();
}

/** No connected, active provider behind a requested assistant (e.g. @claude before anyone connected Claude). */
class AssistantNotConnected extends Error {
    constructor(name) {
        super(`${name} isn't connected for you or this workspace. Connect your own in Agents, or ask a workspace admin to install it.`);
        this.code = 'AI_ASSISTANT_NOT_CONNECTED';
        this.status = 400;
    }
}

/**
 * A specific connected assistant ('anthropic', 'openai', 'gemini', 'xai', 'local_llm') for one
 * request, whatever the workspace default is. The asking person's own connection answers first
 * (Agents → Connect for me), then the workspace's install. Throws AssistantNotConnected when
 * neither exists. A personal key is only ever looked up for `userId`'s own requests.
 */
async function resolveAssistant(workspaceId, assistant, userId = null) {
    const { canonical, describe } = require('./assistants');
    const id = canonical(assistant);
    const key = `${workspaceId}:${id}:${userId || '-'}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    let value = null;
    if (userId && id !== 'local_llm') {
        const mine = await require('../connections/connections.service').personalFor(workspaceId, userId, id);
        if (mine) {
            const model = mine.config?.model || null;
            const models = { ...modelsFor(id), ...(model && { chat: model, fast: model }) };
            value = {
                provider: createProvider(id, { apiKey: mine.secret, defaultModels: models }),
                model,
                providerName: id,
                source: 'assistant',
                keySource: 'personal',
                enabled: true,
            };
        }
    }
    if (!value) {
        const record = await AIProvider.findOne({ workspaceId, provider: { $in: id === 'anthropic' ? ['anthropic', 'claude'] : [id] }, status: 'active' }).lean();
        const apiKey = record ? openSecret(record.apiKey) : null;
        const baseUrl = record?.config?.baseUrl || undefined;
        const usable = id === 'local_llm' ? !!(record && baseUrl) : !!apiKey;
        if (!usable) throw new AssistantNotConnected(describe(id)?.name || id);
        const model = record.config?.model || null;
        const models = { ...modelsFor(id), ...(model && { chat: model, fast: model }) };
        value = {
            provider: createProvider(id, { apiKey: apiKey || undefined, baseUrl, defaultModels: models }),
            model,
            providerName: id,
            source: 'assistant',
            keySource: 'workspace',
            enabled: true,
        };
    }
    cache.set(key, { at: Date.now(), value });
    return value;
}

/**
 * @returns {Promise<{ provider: object|null, model: string|null, providerName: string, source: 'workspace'|'default', enabled: boolean }>}
 *   `provider` is null when the default should be used.
 */
async function resolveForWorkspace(workspaceId) {
    const key = String(workspaceId || '');
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

    let value = { provider: null, model: null, providerName: aiConfig.provider, source: 'default', enabled: true };
    try {
        if (workspaceId) {
            const ws = await identity.workspaces.findById(workspaceId);
            const ai = ws?.settings?.ai || {};
            value.enabled = ai.enabled !== false;
            if (ai.provider && ai.provider !== 'default') {
                const record = await AIProvider.findOne({ workspaceId, provider: ai.provider, status: 'active' }).lean();
                const apiKey = record ? openSecret(record.apiKey) : null;
                const baseUrl = record?.config?.baseUrl || undefined;
                const models = { ...modelsFor(ai.provider), ...(ai.model && { chat: ai.model, fast: ai.model }) };
                // A self-hosted engine is only used when an active record points at an endpoint;
                // otherwise fall back to the server's default engine rather than guessing a URL.
                const usable = ai.provider === 'local_llm' ? !!(record && baseUrl) : !!apiKey;
                if (usable) {
                    value = {
                        ...value,
                        provider: createProvider(ai.provider, { apiKey: apiKey || undefined, baseUrl, defaultModels: models }),
                        model: ai.model || null,
                        providerName: ai.provider,
                        source: 'workspace',
                    };
                } else {
                    logger.warn(`[AI] workspace ${workspaceId} selected ${ai.provider} but it is not connected (no active key/endpoint); using default provider`);
                }
            } else if (ai.model) {
                value.model = ai.model;
            }
        }
    } catch (err) {
        logger.warn({ err }, '[AI] provider resolution failed, using default');
    }
    cache.set(key, { at: Date.now(), value });
    return value;
}

/**
 * Context fields the gateway needs for this workspace (provider override + model). With an
 * `assistant` other than 'default', that connected assistant answers instead of the default,
 * using `userId`'s own connection when they have one.
 */
async function contextFor(workspaceId, assistant = null, userId = null) {
    if (assistant && assistant !== 'default') {
        const a = await resolveAssistant(workspaceId, assistant, userId);
        return { provider: a.provider, ...(a.model && { model: a.model }), assistant: a.providerName, keySource: a.keySource };
    }
    const r = await resolveForWorkspace(workspaceId);
    const ctx = {};
    if (r.provider) ctx.provider = r.provider;
    if (r.model) ctx.model = r.model;
    return ctx;
}

module.exports = { resolveForWorkspace, resolveAssistant, contextFor, invalidate, AssistantNotConnected };
