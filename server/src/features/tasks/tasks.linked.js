'use strict';

/**
 * Make a task from a note or a library file ("Make a task").
 *
 * Works like message → task (messages.service convertToTask): the task keeps a link
 * to its source (task.linkedNote / task.linkedFile) and the source keeps the task's id
 * (linkedTaskId), so each opens the other and a second attempt answers 409.
 * Tasks.create assigns the issue key on whichever store holds tasks (TASKS_STORE).
 */

const mongoose = require('mongoose');
const logger = require('../../../utils/logger');
const shared = require('./tasks.shared');

const { httpError, isActiveMember, resolveTaskCompany } = shared;

const PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
const PRIORITY_ALIASES = { urgent: 'highest', critical: 'highest', normal: 'medium', none: 'lowest' };

function normalizePriority(p) {
    const v = String(p || '').toLowerCase().trim();
    if (PRIORITIES.includes(v)) return v;
    return PRIORITY_ALIASES[v] || 'medium';
}

const idOf = (v) => (v == null ? null : String(v?._id || v));

/** Whether `taskId` still names a task (a link to a permanently deleted task is stale). */
async function taskExists(taskId) {
    if (!taskId) return false;
    const Tasks = require('./tasks.query');
    return !!(await Tasks.findById(idOf(taskId)).catch(() => null));
}

/**
 * Validated task fields from the request body, for a task in `ws` created by `userId`.
 * Returns { title, description, priority, dueDate, assignedTo }.
 */
function readTaskInput(taskData, ws, userId) {
    const title = typeof taskData.title === 'string' ? taskData.title.trim() : '';
    if (!title) throw httpError(400, 'title is required');
    if (title.length > 500) throw httpError(400, 'title is too long');

    let assignedTo = [String(userId)];
    if (Array.isArray(taskData.assigneeIds) && taskData.assigneeIds.length) {
        const ids = [...new Set(taskData.assigneeIds.map(String))];
        if (ids.some((id) => !mongoose.Types.ObjectId.isValid(id))) throw httpError(400, 'Invalid assigneeIds');
        const invalid = ids.filter((id) => !isActiveMember(ws, id));
        if (invalid.length) throw httpError(400, `Assignees are not workspace members: ${invalid.join(', ')}`);
        assignedTo = ids;
    }

    let dueDate = null;
    if (taskData.dueDate) {
        dueDate = new Date(taskData.dueDate);
        if (isNaN(dueDate.getTime())) throw httpError(400, 'Invalid dueDate');
    }

    return {
        title,
        description: typeof taskData.description === 'string' ? taskData.description.slice(0, 10000) : '',
        priority: normalizePriority(taskData.priority),
        dueDate,
        assignedTo,
    };
}

/**
 * Create the task for a source the caller may already see.
 *
 *   source       { kind: 'note' | 'file', id, title, workspaceId, companyId, linkedTaskId, channel? }
 *   claim(task)  links the source to the task; resolves false when another task won the race
 *   attachments  task attachments ([{ name, url }])
 */
async function createLinkedTask({ userId, source, taskData = {}, claim, attachments = [], io }) {
    const label = source.kind === 'note' ? 'Note' : 'File';
    if (source.linkedTaskId && await taskExists(source.linkedTaskId)) {
        throw httpError(409, `${label} is already a task`, { taskId: idOf(source.linkedTaskId) });
    }

    const identity = require('../../identity');
    const ws = await identity.workspaces.findById(idOf(source.workspaceId));
    if (!ws) throw httpError(404, 'Workspace not found');
    if (!isActiveMember(ws, userId)) throw httpError(403, 'You are not a member of this workspace');

    const input = readTaskInput(taskData, ws, userId);

    const plansSvc = require('../../shared/plans/planService');
    await plansSvc.enforce(plansSvc.assertCanCreateTasks(ws, userId, plansSvc.taskAddsFor(userId, input.assignedTo)));

    const creator = await identity.users.findById(userId);
    const Tasks = require('./tasks.query');
    const task = await Tasks.create({
        ...input,
        status: 'todo',
        company: resolveTaskCompany(ws, creator) || source.companyId || null,
        workspace: idOf(source.workspaceId),
        channel: idOf(source.channel) || null,
        taskType: 'workspace',
        visibility: 'private',
        createdBy: userId,
        attachments,
        linkedNote: source.kind === 'note' ? idOf(source.id) : null,
        linkedFile: source.kind === 'file' ? idOf(source.id) : null,
        source: 'manual',
    });

    // Another request linked the source first: drop this task and point at that one.
    if (!(await claim(task))) {
        await Tasks.deleteMany({ _id: task._id }).catch(() => {});
        throw httpError(409, `${label} is already a task`);
    }

    try {
        await Tasks.logActivity({
            task: task._id,
            user: userId,
            action: 'created',
            metadata: { source: source.kind, [`${source.kind}Id`]: idOf(source.id), sourceTitle: source.title || '', visibility: 'private' },
        });
    } catch (err) {
        logger.warn({ err }, `[tasks] "created from ${source.kind}" activity not recorded`);
    }

    if (io) {
        const payload = await shared.loadTaskForClient(task._id).catch(() => null);
        await shared.emitToTaskAudience(io, task, 'task-created', payload || task);
    }
    return task;
}

/** Short task shape returned by the "make a task" endpoints. */
function briefTask(task) {
    return {
        _id: idOf(task._id),
        issueKey: task.issueKey || null,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate || null,
        workspace: idOf(task.workspace),
    };
}

/** Clear note / file links to tasks that were permanently deleted. */
async function unlinkSources(taskIds) {
    const ids = (taskIds || []).map(idOf).filter(Boolean);
    if (!ids.length) return;
    const Note = require('../../../models/Note');
    const WorkspaceFile = require('../files/WorkspaceFile');
    await Promise.allSettled([
        Note.updateMany({ linkedTaskId: { $in: ids } }, { $set: { linkedTaskId: null } }),
        WorkspaceFile.updateMany({ linkedTaskId: { $in: ids } }, { $set: { linkedTaskId: null } }),
    ]);
}

module.exports = { createLinkedTask, briefTask, unlinkSources, normalizePriority, readTaskInput };
