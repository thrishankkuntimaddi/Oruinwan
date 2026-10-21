'use strict';

/**
 * Which AI gateway this process talks to:
 *   AI_SERVICE_URL set   -> the standalone AI process over HTTP (ai.remote.js)
 *   otherwise            -> the in-process gateway (ai/api/ai.gateway.js), today's behaviour
 *
 * `gateway()` returns the chosen backend. The module itself also delegates
 * every method (gateway.chat(...), gateway.configure(...)) so call sites only
 * change their require line.
 */

const local = require('../../../../ai/api/ai.gateway');
const { createRemoteGateway } = require('./ai.remote');

let remote = null;
let remoteUrl = null;

function gateway(env = process.env) {
  const url = env.AI_SERVICE_URL;
  if (!url) return local;
  if (!remote || remoteUrl !== url) {
    remote = createRemoteGateway({ baseUrl: url, token: env.AI_SERVICE_TOKEN });
    remoteUrl = url;
  }
  return remote;
}

/** Test hook: forget the cached remote client. */
function _reset() { remote = null; remoteUrl = null; }

/**
 * The single choke point for plan limits on AI: every model request the server
 * makes goes through one of these methods. Requests answered with the server's
 * key count toward the person's and the workspace's daily allowance
 * (src/shared/plans/aiQuota.js); requests through someone's own or the
 * workspace's installed key (context.provider) do not. rerank and
 * classifyIntent are helper steps of a larger request and are not counted.
 */
const COUNTED = new Set(['chat', 'summarize', 'generateTask', 'smartReplies', 'translate', 'draft',
  'conversation', 'extractTasks', 'noteAssist', 'answer']);
const UNCOUNTED_INTENTS = new Set(['rerank', 'classify_intent']);

function counted(backend, key, fn) {
  return async function countedCall(...args) {
    const context = (key === 'run' ? args[2] : args[1]) || {};
    if (key === 'run' && UNCOUNTED_INTENTS.has(args[0])) return fn.apply(backend, args);
    const quota = require('../../shared/plans/aiQuota');
    if (!quota.usesServerKey(context)) return fn.apply(backend, args);
    let usage = null;
    try {
      usage = await quota.consume({ userId: context.userId, workspaceId: context.workspaceId });
    } catch (err) {
      if (err && err.code === 'PLAN_LIMIT') throw err;
      // The counter store being unreachable must not take AI down with it.
      require('../../../utils/logger').warn(`[AI] plan counter unavailable: ${err?.message}`);
    }
    if (usage) {
      const io = context.io || require('../../socket/getIO').getIO();
      quota.announce(io, context.userId, context.workspaceId, usage);
    }
    return fn.apply(backend, args);
  };
}

module.exports = new Proxy({ gateway, _reset, COUNTED }, {
  get(target, key) {
    if (key in target) return target[key];
    const backend = gateway();
    const value = backend[key];
    if (typeof value !== 'function') return value;
    if (COUNTED.has(key) || key === 'run') return counted(backend, key, value);
    return value.bind(backend);
  },
});
