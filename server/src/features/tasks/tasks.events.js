'use strict';

/**
 * Automation triggers for tasks (`task.created`, `task.completed`) on the
 * notification event emitter the automation engine listens to. Works for both
 * stores (Mongo and TASKS_STORE=pg) because it reads the shapes the service
 * returns. Never throws into the caller.
 *
 * Tasks created by an automation's own `create_task` action do not go through
 * the service, so they never re-trigger `task.created` (no loops).
 */

const logger = require('../../../utils/logger');

const idOf = (v) => (v == null ? null : String(v._id || v));

/** The metadata an automation can match conditions on and interpolate into actions. */
function taskEventData(task, actorId) {
    const assignees = (task.assignedTo || []).map(idOf).filter(Boolean);
    const assigneeNames = (task.assignedTo || []).map((a) => (a && a.username) || null).filter(Boolean);
    return {
        workspaceId: idOf(task.workspace),
        taskId: idOf(task._id),
        title: task.title || '',
        status: task.status || null,
        priority: task.priority || null,
        type: task.type || null,
        source: task.source || null,
        tags: Array.isArray(task.tags) ? task.tags : [],
        channelId: idOf(task.channel),
        assigneeIds: assignees,
        assigneeId: assignees[0] || null,
        assigneeUsernames: assigneeNames,
        createdBy: idOf(task.createdBy),
        userId: actorId ? String(actorId) : idOf(task.createdBy),
        dueDate: task.dueDate || null,
        storyPoints: task.storyPoints ?? null,
        issueKey: task.issueKey || task.key || null,
        parentTaskId: idOf(task.parentTask),
        completedAt: task.completedAt || null,
    };
}

function emit(event, task, actorId, io) {
    try {
        if (!task) return;
        const data = taskEventData(task, actorId);
        if (!data.workspaceId) return;
        require('../../modules/notifications/notificationEventEmitter').emit(event, { io, ...data });
    } catch (err) {
        logger.warn({ err: err.message, event }, '[tasks.events] emit failed');
    }
}

function emitCreated(result, actorId, io) {
    const list = result?.tasks || (result?.subtask ? [result.subtask] : result?.task ? [result.task] : []);
    for (const task of list) emit('task.created', task, actorId, io);
    return result;
}

function emitCompleted(task, actorId, io) {
    emit('task.completed', task, actorId, io);
}

module.exports = { taskEventData, emitCreated, emitCompleted };
