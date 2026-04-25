'use strict';

const activityService = require('../activity/activity.service');
const { ACTIVITY_TYPES, ACTIVITY_SUBTYPES } = require('../../../../platform/sdk/events/activityEvents');

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

function logTaskCreated(req, task, userId) {
  _emitTaskEvent(req, ACTIVITY_SUBTYPES.CREATED, userId, task).catch(() => {});
}

function logTaskUpdated(req, task, userId, updates = {}) {
  _emitTaskEvent(req, ACTIVITY_SUBTYPES.UPDATED, userId, task, {
    changes: Object.keys(updates),
  }).catch(() => {});
}

function logTaskCompleted(req, task, userId) {
  _emitTaskEvent(req, ACTIVITY_SUBTYPES.COMPLETED, userId, task).catch(() => {});
}

function logTaskAssigned(req, task, userId, assigneeId) {
  _emitTaskEvent(req, ACTIVITY_SUBTYPES.ASSIGNED, userId, task, {
    assigneeId,
  }).catch(() => {});
}

module.exports = {
  logTaskCreated,
  logTaskUpdated,
  logTaskCompleted,
  logTaskAssigned,
};
