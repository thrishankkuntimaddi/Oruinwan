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

const Workspace = require('../../../models/Workspace');
const AIProvider = require('../integrations/ai-provider.model');
const { createProvider, modelsFor } = require('../../../../ai/providers');
const aiConfig = require('../../../../ai/config');
const { openSecret } = require('../../modules/conversations/cryptoUtils');
const logger = require('../../../utils/logger');

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // workspaceId -> { at, value }

function invalidate(workspaceId) {
    if (workspaceId) cache.delete(String(workspaceId));
    else cache.clear();
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
            const ws = await Workspace.findById(workspaceId).select('settings.ai').lean();
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

/** Context fields the gateway needs for this workspace (provider override + model). */
async function contextFor(workspaceId) {
    const r = await resolveForWorkspace(workspaceId);
    const ctx = {};
    if (r.provider) ctx.provider = r.provider;
    if (r.model) ctx.model = r.model;
    return ctx;
}

module.exports = { resolveForWorkspace, contextFor, invalidate };
