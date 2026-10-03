/**
 * ai/api/ai.gateway.js
 *
 * AI Gateway: the boundary between the server and the AI subsystem.
 *
 *   client -> HTTP -> server/src/features/ai/ai.controller.js (transport only)
 *          -> ai.gateway (this file: plain data in, plain data out)
 *          -> ai/orchestrator -> ai/agents -> ai/providers (Gemini, OpenAI, Anthropic, local, mock)
 *
 * Rules: no Express objects here, every function takes a payload and a
 * context, and the server's side-effect helpers are injected as tool actions.
 *
 * Context accepted by every call:
 *   { userId, workspaceId?, req?, io?, provider?, model?, remember? }
 * `provider` lets the server pass a workspace-specific provider instance.
 */

'use strict';

const { Orchestrator } = require('../orchestrator');
const logger = require('../utils/logger');

let _orchestrator = null;
let _options = {};

function loadServerActions() {
  // As its own process the AI has no database: actions are injected through
  // configure({ actions }) (ai/server.js proxies them to the API) instead.
  if (process.env.AI_STANDALONE === '1') return {};
  try {
    return require('../../server/utils/aiActions');
  } catch (err) {
    logger.warn('[AI Gateway] server actions unavailable, tools disabled:', err.message);
    return {};
  }
}

/** Configure the shared orchestrator before first use (usage logging, injected tool actions). */
function configure(options = {}) {
  _options = { ..._options, ...options };
  _orchestrator = null;
}

/** Lazily build the shared orchestrator (or replace it, mainly for tests). */
function getOrchestrator() {
  if (!_orchestrator) {
    const { actions, ...rest } = _options;
    _orchestrator = new Orchestrator({ actions: actions || loadServerActions(), ...rest });
  }
  return _orchestrator;
}

function setOrchestrator(orchestrator) {
  _orchestrator = orchestrator;
}

/** Generic entry point: run any registered intent. */
function run(intent, payload, context = {}) {
  return getOrchestrator().run(intent, payload, context);
}

/* Assistant chat with tools and memory. */
const chat = (payload, context) => run('chat', payload, context);
/* One-shot helpers (no tools, no memory). */
const summarize = (payload, context = {}) => run('summarize', payload, context);
const generateTask = (payload, context = {}) => run('generate_task', payload, context);
const smartReplies = (payload, context = {}) => run('smart_replies', payload, context);
const translate = (payload, context = {}) => run('translate', payload, context);
const draft = (payload, context = {}) => run('draft', payload, context);
const conversation = (payload, context = {}) => run('conversation', payload, context);
const extractTasks = (payload, context = {}) => run('extract_tasks', payload, context);
const noteAssist = (payload, context = {}) => run('note_assist', payload, context);
const answer = (payload, context = {}) => run('answer', payload, context);
const rerank = (payload, context = {}) => run('rerank', payload, context);
const classifyIntent = (payload, context = {}) => run('classify_intent', payload, context);

/** Forget a user's conversation memory (called on logout / "new chat"). */
function clearMemory({ userId, workspaceId } = {}) {
  return getOrchestrator().clearMemory({ userId, workspaceId });
}

module.exports = {
  configure,
  run,
  chat,
  summarize,
  generateTask,
  smartReplies,
  translate,
  draft,
  conversation,
  extractTasks,
  noteAssist,
  answer,
  rerank,
  classifyIntent,
  clearMemory,
  getOrchestrator,
  setOrchestrator,
};
