/**
 * ai/events/activityEvent.js
 *
 * AI Subsystem — Shared ActivityEvent Type Definitions
 *
 * This file lives in the AI subsystem so that AI agents, orchestrators,
 * and tools can create structured activity payloads without importing
 * server-side Mongoose models.
 *
 * Usage in AI agents / orchestrators:
 *   const { createAiEvent } = require('../../events/activityEvent');
 *   const event = createAiEvent('summary', userId, workspaceId, { summary: '...' });
 *   // pass to server via callback or message queue
 */

'use strict';

/**
 * Canonical activity event types understood by the platform.
 * Must stay in sync with server/models/ActivityEvent.js ACTIVITY_TYPES.
 */
const ACTIVITY_TYPES = Object.freeze({
  MESSAGE:  'message',
  TASK:     'task',
  NOTE:     'note',
  AI:       'ai',
  UPDATE:   'update',
  MEETING:  'meeting',
  REACTION: 'reaction',
});

/**
 * Subtypes by category
 */
const SUBTYPES = Object.freeze({
  message:  ['sent', 'edited', 'deleted'],
  task:     ['created', 'updated', 'completed', 'assigned'],
  note:     ['created', 'updated', 'deleted'],
  ai:       ['chat', 'summary', 'task_generated'],
  update:   ['posted'],
  meeting:  ['scheduled', 'started', 'ended'],
  reaction: ['added'],
});

/**
 * Create a plain ActivityEvent descriptor (no Mongoose — pure data).
 *
 * @param {string} type        One of ACTIVITY_TYPES values
 * @param {string} [subtype]   Optional subtype
 * @param {string} actor       User ID
 * @param {string} [workspaceId]
 * @param {object} [payload]   Display data
 * @returns {{ type, subtype, actor, workspaceId, payload }}
 */
function createEvent(type, subtype, actor, workspaceId, payload = {}) {
  return { type, subtype: subtype || null, actor, workspaceId: workspaceId || null, payload };
}

/** Shorthand: create an AI-type event */
function createAiEvent(subtype, actor, workspaceId, payload = {}) {
  return createEvent(ACTIVITY_TYPES.AI, subtype, actor, workspaceId, payload);
}

/** Shorthand: create a task-type event */
function createTaskEvent(subtype, actor, workspaceId, payload = {}) {
  return createEvent(ACTIVITY_TYPES.TASK, subtype, actor, workspaceId, payload);
}

/** Shorthand: create a message-type event */
function createMessageEvent(subtype, actor, workspaceId, payload = {}) {
  return createEvent(ACTIVITY_TYPES.MESSAGE, subtype, actor, workspaceId, payload);
}

module.exports = {
  ACTIVITY_TYPES,
  SUBTYPES,
  createEvent,
  createAiEvent,
  createTaskEvent,
  createMessageEvent,
};
