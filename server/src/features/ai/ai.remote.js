'use strict';

/**
 * The AI gateway over HTTP: same surface as ai/api/ai.gateway.js, served by
 * the standalone AI process (ai/server.js) at AI_SERVICE_URL.
 *
 * What crosses the wire: the payload, and the plain parts of the context
 * (ids, flags, memories, knowledge). `req`, `io`, callbacks and the abort
 * signal stay here; a per-workspace provider instance travels as
 * `providerSpec` and is rebuilt on the other side. Streaming chat is an SSE
 * response whose token/tool events are turned back into the `onToken` /
 * `onEvent` callbacks the controllers already use, so the frames they write
 * to browsers are unchanged.
 */

const logger = require('../../../utils/logger');

const INTENTS = ['chat', 'summarize', 'generate_task', 'smart_replies', 'translate', 'draft', 'conversation', 'extract_tasks', 'note_assist', 'answer', 'rerank', 'classify_intent'];
const OMIT = new Set(['req', 'io', 'signal', 'onToken', 'onEvent', 'provider']);

function providerSpec(provider) {
  if (!provider || typeof provider !== 'object' || !provider.name) return undefined;
  return { name: provider.name, apiKey: provider.apiKey || undefined, baseUrl: provider.baseUrl || undefined, defaultModels: provider.models || undefined };
}

/** Context without transport objects and functions; the provider becomes a spec. */
function wireContext(context = {}) {
  const out = {};
  for (const [k, v] of Object.entries(context)) {
    if (OMIT.has(k) || typeof v === 'function' || v === undefined) continue;
    out[k] = v;
  }
  const spec = providerSpec(context.provider);
  if (spec) out.providerSpec = spec;
  return out;
}

function remoteError(body, status) {
  const err = new Error(body?.message || `AI service error (${status})`);
  if (body?.code) err.code = body.code;
  if (body?.status) err.status = body.status;
  else if (status === 429) err.status = 429;
  return err;
}

/** Parse SSE frames out of a byte stream; calls onFrame({ event, data }) per frame. */
async function readSse(body, onFrame) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = 'message';
      const data = [];
      for (const line of frame.split('\n')) {
        if (line.startsWith(':')) continue; // ping / comment
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (data.length) onFrame({ event, data: data.join('\n') });
    }
  }
}

function createRemoteGateway({ baseUrl = process.env.AI_SERVICE_URL, token = process.env.AI_SERVICE_TOKEN, timeoutMs = Number(process.env.AI_REMOTE_TIMEOUT_MS) || 180_000, fetchImpl = fetch } = {}) {
  const base = String(baseUrl || '').replace(/\/$/, '');
  let onUsage = null;

  function configure(options = {}) {
    if (options.onUsage) onUsage = options.onUsage;
  }

  function usage(intent, context, started, result, error) {
    if (!onUsage) return;
    try {
      const p = result?.event?.payload || {};
      const out = onUsage({
        intent, agent: p.agent || null, provider: p.provider || null, model: p.model || null,
        userId: context.userId || null, workspaceId: context.workspaceId || null,
        durationMs: Date.now() - started, ok: !error, error: error ? error.message : null,
      });
      if (out && typeof out.catch === 'function') out.catch(() => {});
    } catch { /* usage logging must never break a request */ }
  }

  function request(path, body, { signal } = {}) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    if (signal) {
      if (signal.aborted) ac.abort();
      else signal.addEventListener('abort', () => ac.abort(), { once: true });
    }
    return fetchImpl(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: ac.signal,
    }).catch((err) => {
      if (signal?.aborted) throw Object.assign(new Error('AI request aborted'), { code: 'AI_ABORTED' });
      throw Object.assign(new Error(`AI service unreachable: ${err.message}`), { code: 'AI_ENGINE_UNAVAILABLE' });
    }).finally(() => clearTimeout(timer));
  }

  async function run(intent, payload = {}, context = {}) {
    const started = Date.now();
    const wantsStream = intent === 'chat' && (typeof context.onToken === 'function' || typeof context.onEvent === 'function');
    try {
      const res = await request(`/v1/run/${intent}`, { payload, context: wireContext(context), ...(wantsStream && { stream: true }) }, { signal: context.signal });
      if (!res.ok) throw remoteError(await res.json().catch(() => ({})), res.status);
      let result;
      if (wantsStream) {
        let done = null;
        let failure = null;
        await readSse(res.body, ({ event, data }) => {
          let parsed;
          try { parsed = JSON.parse(data); } catch { return; }
          if (event === 'token') context.onToken?.(parsed.t);
          else if (event === 'tool') context.onEvent?.(parsed.status === 'running' ? { type: 'tool', name: parsed.name } : { type: 'tool_result', name: parsed.name, ok: parsed.status === 'done' });
          else if (event === 'done') done = parsed;
          else if (event === 'error') failure = remoteError(parsed, 502);
        });
        if (failure) throw failure;
        if (!done) throw Object.assign(new Error(context.signal?.aborted ? 'AI request aborted' : 'AI stream ended without a result'), { code: context.signal?.aborted ? 'AI_ABORTED' : 'AI_FAILED' });
        result = done;
      } else {
        result = await res.json();
      }
      usage(intent, context, started, result, null);
      return result;
    } catch (err) {
      usage(intent, context, started, null, err);
      throw err;
    }
  }

  async function clearMemory({ userId, workspaceId } = {}) {
    try {
      await request('/v1/clear-memory', { userId, workspaceId });
    } catch (err) {
      logger.warn(`[AI remote] clearMemory failed: ${err.message}`);
    }
  }

  // Not a real orchestrator: enough for callers that only ask what exists.
  const shim = { listIntents: () => INTENTS.slice(), provider: { name: 'remote', isConfigured: true } };

  const api = { configure, run, clearMemory, getOrchestrator: () => shim, setOrchestrator: () => {}, isRemote: true, baseUrl: base };
  const alias = { summarize: 'summarize', generateTask: 'generate_task', smartReplies: 'smart_replies', translate: 'translate', draft: 'draft', conversation: 'conversation', extractTasks: 'extract_tasks', noteAssist: 'note_assist', answer: 'answer', rerank: 'rerank', classifyIntent: 'classify_intent', chat: 'chat' };
  for (const [method, intent] of Object.entries(alias)) api[method] = (payload, context = {}) => run(intent, payload, context);
  return api;
}

module.exports = { createRemoteGateway, wireContext, readSse, INTENTS };
