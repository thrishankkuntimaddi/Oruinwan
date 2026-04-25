'use strict';

const { SOCKET_EVENTS } = require('../../../../platform/sdk/events/activityEvents');
const logger = require('../../../utils/logger');

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

function notifyTaskAssigned(io, task, assigneeId) {
  try {
    if (!io) return;
    const workspaceId = task.workspaceId || task.workspace;

    const payload = { task: _taskPayload(task), assigneeId };

    
    io.to(`user_${assigneeId}`).emit(SOCKET_EVENTS.TASK_ASSIGNED, payload);

    
    if (workspaceId) {
      io.to(`workspace:${workspaceId}`).emit(SOCKET_EVENTS.TASK_ASSIGNED, payload);
    }
  } catch (err) {
    logger.error('[TaskNotifications] notifyTaskAssigned failed:', err.message);
  }
}

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

module.exports = {
  notifyTaskCreated,
  notifyTaskUpdated,
  notifyTaskAssigned,
  notifyTaskCompleted,
};
