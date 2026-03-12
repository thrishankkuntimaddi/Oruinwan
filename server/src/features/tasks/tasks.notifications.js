// server/src/features/tasks/tasks.notifications.js
/**
 * Tasks Notifications — Socket.IO Real-Time Layer
 *
 * Broadcasts task lifecycle events to the correct workspace room so
 * connected clients can update their UI without polling.
 *
 * All functions are fire-and-forget side effects.
 * Callers MUST `.catch(() => {})` — notifications must never block the
 * primary request/response path.
 *
 * Socket rooms used:
 *   workspace:<workspaceId>  — all workspace members
 *   user_<userId>           — targeted user (for assignee alerts)
 *
 * @module features/tasks/tasks.notifications
 */

'use strict';

const { SOCKET_EVENTS } = require('../../../../../platform/sdk/events/activityEvents');
const logger = require('../../../utils/logger');

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Build a minimal task snapshot safe to broadcast over the wire.
 * @param {object} task Mongoose Task document or plain object
 */
function _taskPayload(task) {
  return {
    taskId:      task._id,
    issueKey:    task.issueKey  || null,
    title:       task.title,
    status:      task.status,
    priority:    task.priority  || 'medium',
    assignedTo:  task.assignedTo || null,
    workspaceId: task.workspaceId || task.workspace || null,
    updatedAt:   task.updatedAt  || new Date(),
  };
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Notify workspace members that a new task was created.
 * @param {import('socket.io').Server} io
 * @param {object} task
 * @param {string} workspaceId
 */
function notifyTaskCreated(io, task, workspaceId) {
  try {
    if (!io || !workspaceId) return;
    io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.TASK_CREATED, {
      task: _taskPayload(task),
    });
  } catch (err) {
    logger.error('[TaskNotifications] notifyTaskCreated failed:', err.message);
  }
}

/**
 * Notify workspace members that a task was updated.
 * @param {import('socket.io').Server} io
 * @param {object} task
 * @param {string} workspaceId
 * @param {object} [changes]  Delta object — used by clients for optimistic UI
 */
function notifyTaskUpdated(io, task, workspaceId, changes = {}) {
  try {
    if (!io || !workspaceId) return;
    io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.TASK_UPDATED, {
      task: _taskPayload(task),
      changes,
    });
  } catch (err) {
    logger.error('[TaskNotifications] notifyTaskUpdated failed:', err.message);
  }
}

/**
 * Notify the assignee directly that a task was assigned to them.
 * Also broadcasts to the workspace room so other members see it.
 * @param {import('socket.io').Server} io
 * @param {object} task
 * @param {string} assigneeId
 */
function notifyTaskAssigned(io, task, assigneeId) {
  try {
    if (!io) return;
    const workspaceId = task.workspaceId || task.workspace;

    const payload = { task: _taskPayload(task), assigneeId };

    // Personal room — always present
    io.to(`user_${assigneeId}`).emit(SOCKET_EVENTS.TASK_ASSIGNED, payload);

    // Workspace room — if available
    if (workspaceId) {
      io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.TASK_ASSIGNED, payload);
    }
  } catch (err) {
    logger.error('[TaskNotifications] notifyTaskAssigned failed:', err.message);
  }
}

/**
 * Notify workspace that a task was completed.
 * @param {import('socket.io').Server} io
 * @param {object} task
 * @param {string} workspaceId
 */
function notifyTaskCompleted(io, task, workspaceId) {
  try {
    if (!io || !workspaceId) return;
    io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.TASK_COMPLETED, {
      task: _taskPayload(task),
    });
  } catch (err) {
    logger.error('[TaskNotifications] notifyTaskCompleted failed:', err.message);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  notifyTaskCreated,
  notifyTaskUpdated,
  notifyTaskAssigned,
  notifyTaskCompleted,
};
