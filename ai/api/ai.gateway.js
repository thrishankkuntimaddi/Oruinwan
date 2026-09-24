/**
 * ai/api/ai.gateway.js
 *
 * AI Gateway: the boundary between the server and the AI subsystem.
 *
 *   client -> HTTP -> server/src/features/ai/ai.controller.js (transport only)
 *          -> ai.gateway (this file: plain data in, plain data out)
 *          -> ai/orchestrator -> ai/agents -> ai/providers (Gemini or mock)
 *
 * Rules: no Express objects here, every function takes a payload and a
 * context, and the server's side-effect helpers are injected as tool actions.
 */

'use strict';

const { Orchestrator } = require('../orchestrator');
const logger = require('../utils/logger');

let _orchestrator = null;

function loadServerActions() {
  try {
    return require('../../server/utils/aiActions');
  } catch (err) {
    logger.warn('[AI Gateway] server actions unavailable, tools disabled:', err.message);
    return {};
  }
}

/** Lazily build the shared orchestrator (or replace it, mainly for tests). */
function getOrchestrator() {
  if (!_orchestrator) _orchestrator = new Orchestrator({ actions: loadServerActions() });
  return _orchestrator;
}

function setOrchestrator(orchestrator) {
  _orchestrator = orchestrator;
}

/**
 * @param {{ message: string, history?: Array, workspaceId?: string }} payload
 * @param {{ userId: string, req?: object, remember?: boolean }} context
 * @returns {Promise<{ text: string, actionsExecuted?: Array, event: object }>}
 */
async function chat(payload, context) {
  return getOrchestrator().run('chat', payload, context);
}

/**
 * @param {{ text: string, style?: string }} payload
 * @returns {Promise<{ summary: string, event: object }>}
 */
async function summarize(payload, context = {}) {
  return getOrchestrator().run('summarize', payload, context);
}

/**
 * @param {{ context: string }} payload
 * @returns {Promise<{ title: string, description: string, priority: string, dueDate?: string, event: object }>}
 */
async function generateTask(payload, context = {}) {
  return getOrchestrator().run('generate_task', payload, context);
}

/** Forget a user's conversation memory (called on logout / "new chat"). */
function clearMemory({ userId, workspaceId } = {}) {
  return getOrchestrator().clearMemory({ userId, workspaceId });
}

module.exports = { chat, summarize, generateTask, clearMemory, getOrchestrator, setOrchestrator };
