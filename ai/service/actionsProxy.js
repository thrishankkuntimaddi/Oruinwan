'use strict';

/**
 * Tool actions for the standalone AI process. The AI has no database, so every
 * action the assistant may run (create a task, post a message, search…) is
 * forwarded to the API's internal endpoint, which holds the real
 * implementation (server/utils/aiActions.js) and enforces membership:
 *
 *   POST {API_INTERNAL_URL}/api/internal/ai-actions/:name
 *   Authorization: Bearer {AI_SERVICE_TOKEN}
 *   { args, ctx: { userId, workspaceId } }      -> { result }
 *
 * Only ids cross the wire: never a request, socket or provider object.
 */

const { ACTION_FOR } = require('../tools/registry');

const DEFAULT_TIMEOUT_MS = 20_000;

function plainCtx(ctx = {}) {
  return { userId: ctx.userId != null ? String(ctx.userId) : null, workspaceId: ctx.workspaceId != null ? String(ctx.workspaceId) : null };
}

/**
 * @param {{ apiUrl?: string, token?: string, timeoutMs?: number, fetchImpl?: Function }} [opts]
 * @returns {Record<string, (args: object, ctx: object) => Promise<object>>} one function per known action
 */
function createActionsProxy({
  apiUrl = process.env.API_INTERNAL_URL,
  token = process.env.AI_SERVICE_TOKEN,
  timeoutMs = Number(process.env.AI_ACTION_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
  fetchImpl = fetch,
} = {}) {
  if (!apiUrl || !token) return {}; // no API to call: tools are simply not offered
  const base = apiUrl.replace(/\/$/, '');

  const call = (name) => async (args = {}, ctx = {}) => {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetchImpl(`${base}/api/internal/ai-actions/${encodeURIComponent(name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ args, ctx: plainCtx(ctx) }),
        signal: ac.signal,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { success: false, error: body.error || `API action ${name} failed (${res.status})` };
      return body.result;
    } catch (err) {
      // The model sees a plain failure and tells the user; the turn itself survives.
      return { success: false, error: err.name === 'AbortError' ? `Action ${name} timed out` : `Action ${name} unavailable: ${err.message}` };
    } finally {
      clearTimeout(timer);
    }
  };

  const actions = {};
  for (const name of new Set(Object.values(ACTION_FOR))) actions[name] = call(name);
  return actions;
}

module.exports = { createActionsProxy, plainCtx };
