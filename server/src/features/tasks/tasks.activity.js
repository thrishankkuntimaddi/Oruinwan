// server/src/features/tasks/tasks.activity.js
/**
 * Tasks Activity — Unified Activity Stream Integration
 *
 * Persists TaskActivity events into the shared ActivityEvent collection
 * and broadcasts them to the workspace socket room via activityService.
 *
 * All exported functions are fire-and-forget side effects.
 * Callers MUST `.catch(() => {})` — activity must never block the primary
 * request/response path.
 *
 * @module features/tasks/tasks.activity
 */

'use strict';

const activityService = require('../activity/activity.service');
const { ACTIVITY_TYPES, ACTIVITY_SUBTYPES } = require('../../../../../platform/sdk/events/activityEvents');

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Emit a task-type ActivityEvent.
 * @param {import('express').Request} req
 * @param {string} subtype   One of ACTIVITY_SUBTYPES.*
 * @param {string} userId    Actor user ID
 * @param {object} task      Mongoose Task document (or plain object)
 * @param {object} [extra]   Additional payload fields
 */
function _emitTaskEvent(req, subtype, userId, task, extra = {}) {
  return activityService.emit(req, {
    type:        ACTIVITY_TYPES.TASK,
    subtype,
    actor:       userId,
    workspaceId: task.workspaceId || task.workspace || null,
    payload: {
      taskId:   task._id,
      issueKey: task.issueKey || null,
      title:    task.title,
      priority: task.priority || 'medium',
      status:   task.status,
      ...extra,
    },
  });
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Log task created event.
 * @param {import('express').Request} req
 * @param {object} task   The newly created task document
 * @param {string} userId Creator user ID
 */
function logTaskCreated(req, task, userId) {
  _emitTaskEvent(req, ACTIVITY_SUBTYPES.CREATED, userId, task).catch(() => {});
}

/**
 * Log task updated event.
 * @param {import('express').Request} req
 * @param {object} task    Updated task document
 * @param {string} userId  Actor user ID
 * @param {object} updates The update delta
 */
function logTaskUpdated(req, task, userId, updates = {}) {
  _emitTaskEvent(req, ACTIVITY_SUBTYPES.UPDATED, userId, task, {
    changes: Object.keys(updates),
  }).catch(() => {});
}

/**
 * Log task completed event.
 * @param {import('express').Request} req
 * @param {object} task   The completed task document
 * @param {string} userId Actor user ID
 */
function logTaskCompleted(req, task, userId) {
  _emitTaskEvent(req, ACTIVITY_SUBTYPES.COMPLETED, userId, task).catch(() => {});
}

/**
 * Log task assigned event.
 * @param {import('express').Request} req
 * @param {object} task       The task that was assigned
 * @param {string} userId     Actor (assigner) user ID
 * @param {string} assigneeId The user who received the assignment
 */
function logTaskAssigned(req, task, userId, assigneeId) {
  _emitTaskEvent(req, ACTIVITY_SUBTYPES.ASSIGNED, userId, task, {
    assigneeId,
  }).catch(() => {});
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  logTaskCreated,
  logTaskUpdated,
  logTaskCompleted,
  logTaskAssigned,
};
