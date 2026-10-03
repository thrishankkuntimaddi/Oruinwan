'use strict';

/**
 * The tasks service on the PostgreSQL store (TASKS_STORE=pg). Same rules,
 * same return shapes and the same notifications, socket events, history and
 * channel notices as the MongoDB path in tasks.service.js; only the reads and
 * writes go through tasks.repository.js. Users and workspaces come from the
 * PostgreSQL identity repositories (src/identity); channels and messages
 * still live in MongoDB.
 *
 * Built by tasks.service.js with its private helpers so there is no require
 * cycle: `createPgTaskService({ validateWorkspaceMember, getUserChannels, ... })`.
 */

const logger = require('../../../utils/logger');
const identity = require('../../identity');
const Channel = require('../channels/channel.model.js');
const Message = require('../../modules/messages/message.model.js');
const repo = require('./tasks.repository');
const policy = require('./tasks.policy');
const { normalizeAttachments } = require('./tasks.validator');
const notifEmitter = require('../../modules/notifications/notificationEventEmitter');
const { logAction } = require('../../../utils/historyLogger');
const { isValidTransition, getAllowedTransitions, validateBlocked } = require('../../../utils/workflowValidator');
const {
    httpError, isObjectId, idOf, isActiveMember, resolveTaskCompany, canViewTask, emitToTaskAudience, serializeTask,
} = require('./tasks.shared');

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
const LINK_TYPES = ['blocks', 'is_blocked_by', 'duplicates', 'is_duplicated_by', 'relates_to'];
const INVERSE_LINK = { blocks: 'is_blocked_by', is_blocked_by: 'blocks', duplicates: 'is_duplicated_by', is_duplicated_by: 'duplicates', relates_to: 'relates_to' };
const EDITABLE_FIELDS = ['title', 'description', 'priority', 'dueDate', 'tags', 'storyPoints', 'estimatedHours', 'actualHours', 'resolution', 'attachments'];

/** Transfer request as the client reads it: the stored reason doubles as `note`. */
function transferForClient(tr) {
    if (!tr) return tr;
    return { ...tr, note: tr.reason || '' };
}

const freshTimeTracking = (tt) => ({
    totalTime: Number(tt?.totalTime || 0),
    sessions: (tt?.sessions || []).map((x) => ({ start: x.start ? new Date(x.start) : null, end: x.end ? new Date(x.end) : null })),
});

/** Populated + serialized task for clients and socket payloads. */
async function loadForClient(taskId) {
    const task = await repo.findById(taskId);
    if (!task) return null;
    await repo.hydrateForClient([task]);
    return serializeTask(task);
}

function createPgTaskService({ validateWorkspaceMember, getUserChannels, isWorkspaceAdmin, postChannelNotice, assertActiveMembers }) {

    async function logActivity(taskId, userId, action, extra = {}, req) {
        try {
            await repo.appendActivity({
                task: taskId, user: userId, action, field: extra.field, from: extra.from, to: extra.to, metadata: extra.metadata,
                ipAddress: req?.ip, userAgent: typeof req?.get === 'function' ? req.get('user-agent') : undefined,
            });
        } catch (err) {
            logger.warn({ err }, `[tasks:pg] activity '${action}' not recorded`);
        }
    }

    /** Same checks as _loadTaskForUser in tasks.service.js. */
    async function loadTaskForUser(userId, taskId, { allowDeleted = false, allowManager = false } = {}) {
        if (!isObjectId(String(taskId))) throw httpError(404, 'Task not found');
        const task = await repo.findById(taskId);
        if (!task || (task.deleted && !allowDeleted)) throw httpError(404, 'Task not found');
        if ((task.deletedFor || []).some((id) => idOf(id) === String(userId))) throw httpError(404, 'Task not found');

        let workspace = null;
        let userChannels = [];
        let isManager = false;
        if (task.workspace) {
            workspace = await identity.workspaces.findById(task.workspace);
            if (!workspace) throw httpError(404, 'Workspace for this task not found');
            if (!isActiveMember(workspace, userId)) throw httpError(403, 'You are not a member of this workspace');
            isManager = isWorkspaceAdmin(workspace, userId);
            if (task.visibility === 'channel' && task.channel) userChannels = await getUserChannels(userId, task.workspace);
        }
        const canView = canViewTask(task, userId, userChannels);
        if (!canView && !(allowManager && isManager)) throw httpError(403, "You don't have permission to view this task");
        return { task, workspace, isManager, canView };
    }

    async function loadForAdminAction(userId, taskId, { allowDeleted = true } = {}) {
        if (!isObjectId(String(taskId))) throw httpError(404, 'Task not found');
        const task = await repo.findById(taskId);
        if (!task || (task.deleted && !allowDeleted)) throw httpError(404, 'Task not found');
        let workspace = null;
        if (task.workspace) {
            workspace = await identity.workspaces.findById(task.workspace);
            if (!workspace) throw httpError(404, 'Workspace for this task not found');
            if (!isActiveMember(workspace, userId)) throw httpError(403, 'You are not a member of this workspace');
        }
        return { task, workspace, isWorkspaceAdmin: isWorkspaceAdmin(workspace, userId) };
    }

    // ── Queries ──

    async function getTasks(userId, filters = {}) {
        const { workspaceId, status, assignedTo, priority } = filters;
        const includeDeleted = filters.includeDeleted === true || filters.includeDeleted === 'true';
        const includeSubtasks = filters.includeSubtasks === true || filters.includeSubtasks === 'true';
        if (!workspaceId || typeof workspaceId !== 'string') throw httpError(400, 'Workspace ID required');

        await validateWorkspaceMember(userId, workspaceId);
        const userChannels = await getUserChannels(userId, workspaceId);

        const filter = { workspace: workspaceId, userId, channelIds: userChannels, deletedForNot: userId, excludeSubtasks: !includeSubtasks };
        if (!includeDeleted) filter.deleted = false;
        if (typeof status === 'string' && status) {
            if (!TASK_STATUSES.includes(status)) throw httpError(400, `Invalid status: ${status}`);
            filter.status = status;
        }
        if (typeof priority === 'string' && priority) {
            if (!TASK_PRIORITIES.includes(priority)) throw httpError(400, `Invalid priority: ${priority}`);
            filter.priority = priority;
        }
        if (typeof assignedTo === 'string' && assignedTo) {
            if (!isObjectId(assignedTo)) throw httpError(400, 'Invalid assignedTo');
            filter.assignedTo = assignedTo;
        }
        const tasks = await repo.findMany(filter);
        await repo.hydrateForClient(tasks);
        return { tasks: tasks.map(serializeTask) };
    }

    async function getTask(userId, taskId) {
        const { task } = await loadTaskForUser(userId, taskId, { allowDeleted: true });
        return { task: await loadForClient(task._id) };
    }

    async function getMyTasks(userId, filters = {}) {
        const { status, priority } = filters;
        const user = await identity.users.findById(userId);
        if (!user) throw httpError(404, 'User not found');
        const filter = { assignedTo: userId, deleted: false, deletedForNot: userId, sort: { dueDate: 1, priority: -1 } };
        if (typeof status === 'string' && status) filter.status = status;
        if (typeof priority === 'string' && priority) filter.priority = priority;
        const tasks = await repo.findMany(filter);
        await Promise.all([repo.hydrateUsers(tasks), repo.hydrateWorkspaces(tasks), repo.hydrateChannels(tasks)]);
        return { tasks };
    }

    // ── Create ──

    async function createTask(userId, taskData, io, req) {
        const {
            workspaceId, title, description, assignedToIds = [], channelId = null, taskMode = 'split',
            status = 'todo', priority = 'medium', dueDate, linkedMessage, tags, source, type, blockedReason, attachments,
        } = taskData;
        const assignmentType = taskData.assignmentType === 'members' ? 'individual' : (taskData.assignmentType || 'self');

        if (!title || !workspaceId) throw httpError(400, 'Title and workspace ID required');
        if (!['self', 'individual', 'channel'].includes(assignmentType)) throw httpError(400, 'Invalid assignment type');
        if (!TASK_STATUSES.includes(status)) throw httpError(400, `Invalid status: ${status}`);
        if (status === 'blocked') {
            const v = validateBlocked(status, blockedReason);
            if (!v.valid) throw httpError(400, v.error);
        }

        const user = await identity.users.findById(userId);
        if (!user) throw httpError(404, 'User not found');
        const workspace = await validateWorkspaceMember(userId, workspaceId);

        let channel = null;
        if (channelId) {
            if (!isObjectId(String(channelId))) throw httpError(400, 'Invalid channel ID');
            channel = await Channel.findById(channelId);
            if (!channel || String(channel.workspace) !== String(workspace._id)) throw httpError(400, 'Invalid channel');
            if (typeof channel.isMember === 'function' ? !channel.isMember(userId)
                : !(channel.members || []).some((m) => idOf(m.user || m) === String(userId))) {
                throw httpError(403, "You don't have access to this channel");
            }
        } else if (assignmentType === 'channel') {
            throw httpError(400, 'Channel ID required');
        }
        const channelRef = channel ? String(channel._id) : null;

        const taskDefinitions = [];
        if (assignmentType === 'self') {
            taskDefinitions.push({ assignedTo: [userId], visibility: 'private' });
        } else if (assignmentType === 'individual') {
            const ids = [...new Set((assignedToIds || []).map(String))];
            if (ids.length === 0) throw httpError(400, 'Please select at least one assignee');
            assertActiveMembers(workspace, ids);
            if (taskMode === 'split' && ids.length > 1) ids.forEach((id) => taskDefinitions.push({ assignedTo: [id], visibility: 'private' }));
            else taskDefinitions.push({ assignedTo: ids, visibility: 'private' });
        } else {
            let memberIds;
            if (assignedToIds && assignedToIds.length > 0) {
                memberIds = [...new Set(assignedToIds.map(String))];
                assertActiveMembers(workspace, memberIds);
            } else {
                memberIds = [...new Set((channel.members || []).map((m) => idOf(m.user || m)).filter((id) => isActiveMember(workspace, id)))];
            }
            taskDefinitions.push({ assignedTo: memberIds, visibility: 'channel' });
        }

        const company = resolveTaskCompany(workspace, user);
        const storedAttachments = normalizeAttachments(Array.isArray(attachments) ? attachments : [], userId);
        const createdTasks = [];

        for (const def of taskDefinitions) {
            const issueKey = await repo.nextIssueKey(workspace._id, workspace.name);
            const task = await repo.insert({
                company,
                workspace: workspace._id,
                title: String(title).trim(),
                description: typeof description === 'string' ? description : '',
                createdBy: userId,
                assignedTo: def.assignedTo,
                visibility: def.visibility,
                channel: channelRef,
                status,
                priority: TASK_PRIORITIES.includes(priority) ? priority : 'medium',
                dueDate: dueDate ? new Date(dueDate) : null,
                linkedMessage: isObjectId(String(linkedMessage || '')) ? linkedMessage : null,
                tags: Array.isArray(tags) ? tags : [],
                labels: Array.isArray(taskData.labels) ? taskData.labels : [],
                attachments: storedAttachments,
                source: source || 'manual',
                type: ['task', 'bug', 'epic'].includes(type) ? type : 'task',
                taskType: 'workspace',
                issueKey,
                ...(status === 'blocked' ? { blockedReason: blockedReason.trim(), blockedBy: userId, blockedAt: new Date() } : {}),
                ...(status === 'done' ? { completedAt: new Date(), completedBy: userId } : {}),
            });
            createdTasks.push(task);

            await logActivity(task._id, userId, 'created', { metadata: { assignmentType, visibility: def.visibility, source: task.source, channel: channelRef } }, req);
            await logAction({ userId, action: 'task_created', description: `Created task: ${task.title}`, resourceType: 'task', resourceId: task._id, companyId: company, req });
            await postChannelNotice(task, userId, `🆕 **New Task:** ${task.title}\nAssigned to Team`, io);

            try {
                const assignerUsername = user.username || 'Someone';
                for (const assigneeId of task.assignedTo) {
                    if (String(assigneeId) === String(userId)) continue;
                    const assignee = await identity.users.findById(assigneeId);
                    notifEmitter.emit('task.assigned', {
                        io, assigneeId: String(assigneeId), assignerUsername, workspaceId: String(task.workspace),
                        taskTitle: task.title, taskId: String(task._id), assigneeEmail: assignee?.email || null,
                    });
                }
            } catch (noteErr) {
                logger.error('Notification Error:', noteErr);
            }
        }

        const populatedTasks = await Promise.all(createdTasks.map((t) => loadForClient(t._id)));
        for (let i = 0; i < createdTasks.length; i += 1) await emitToTaskAudience(io, createdTasks[i], 'task-created', populatedTasks[i]);
        return { message: 'Tasks created successfully', tasks: populatedTasks };
    }

    // ── Update ──

    function normalizeEditable(field, value, task, userId) {
        switch (field) {
            case 'title': return String(value).trim();
            case 'description': return value === null ? '' : value;
            case 'resolution': return value === null ? '' : value;
            case 'dueDate': return value ? new Date(value) : null;
            case 'attachments': {
                const existing = task.attachments || [];
                return normalizeAttachments(value || [], userId).map((a) => {
                    const prev = existing.find((e) => e.url === a.url && e.name === a.name);
                    return prev ? { ...a, uploadedBy: prev.uploadedBy || a.uploadedBy, uploadedAt: prev.uploadedAt || a.uploadedAt } : a;
                });
            }
            default: return value;
        }
    }

    function comparable(field, value) {
        if (value === undefined || value === null) return JSON.stringify(null);
        if (field === 'dueDate') return JSON.stringify(new Date(value).getTime());
        if (field === 'attachments') return JSON.stringify((value || []).map((a) => [a.name, a.url]));
        if (field === 'tags') return JSON.stringify(Array.from(value));
        return JSON.stringify(value);
    }

    async function updateTask(userId, taskId, updates, io, req) {
        updates = updates || {};
        const { task, isManager } = await loadTaskForUser(userId, taskId, { allowManager: true });

        const changes = [];
        const patch = {};
        const previousStatus = task.status;
        let completedNow = false;

        if (updates.status && updates.status !== previousStatus) {
            if (!TASK_STATUSES.includes(updates.status)) throw httpError(400, `Invalid status: ${updates.status}`);
            if (!policy.canChangeStatus(task, userId, isManager)) throw httpError(403, 'Only the creator, assignees or workspace managers can change task status');
            if (!isValidTransition(previousStatus, updates.status)) {
                throw httpError(400, `Invalid status transition from "${previousStatus}" to "${updates.status}"`, { allowedTransitions: getAllowedTransitions(previousStatus) });
            }
            if (updates.status === 'blocked') {
                const validation = validateBlocked(updates.status, typeof updates.blockedReason === 'string' ? updates.blockedReason.trim() : '');
                if (!validation.valid) throw httpError(400, validation.error);
            }
            changes.push({ action: 'status_changed', field: 'status', from: previousStatus, to: updates.status, metadata: updates.status === 'blocked' ? { reason: updates.blockedReason.trim() } : {} });
            patch.previousStatus = previousStatus;
            patch.status = updates.status;
            if (updates.status === 'blocked') {
                Object.assign(patch, { blockedBy: userId, blockedAt: new Date(), blockedReason: updates.blockedReason.trim() });
            } else if (previousStatus === 'blocked' || task.blockedReason) {
                changes.push({ action: 'unblocked', field: 'status', from: previousStatus, to: updates.status });
                Object.assign(patch, { blockedBy: null, blockedAt: null, blockedReason: null });
            }
            if (updates.status === 'done') {
                Object.assign(patch, { completedBy: userId, completedAt: new Date(), completionNote: typeof updates.completionNote === 'string' ? updates.completionNote : '' });
                completedNow = true;
            } else if (previousStatus === 'done') {
                Object.assign(patch, { completedBy: null, completedAt: null, completionNote: '' });
            }
        } else if (task.status === 'blocked' && typeof updates.blockedReason === 'string'
            && updates.blockedReason.trim() && updates.blockedReason.trim() !== task.blockedReason) {
            if (!policy.canChangeStatus(task, userId, isManager)) throw httpError(403, 'Only the creator, assignees or workspace managers can change the blocked reason');
            changes.push({ action: 'blocked', field: 'blockedReason', from: task.blockedReason, to: updates.blockedReason.trim() });
            patch.blockedReason = updates.blockedReason.trim();
        }

        let addedAssignees = [];
        let removedAssignees = [];
        if (updates.assignedTo !== undefined) {
            if (!policy.canManageAssignees(task, userId, isManager)) throw httpError(403, 'Only task creator or workspace managers can manage assignees');
            const workspace = await identity.workspaces.findById(task.workspace);
            const oldAssignees = task.assignedTo.map(String);
            const newAssignees = [...new Set((Array.isArray(updates.assignedTo) ? updates.assignedTo : [updates.assignedTo]).map(String))];
            assertActiveMembers(workspace, newAssignees);
            addedAssignees = newAssignees.filter((id) => !oldAssignees.includes(id));
            removedAssignees = oldAssignees.filter((id) => !newAssignees.includes(id));
            addedAssignees.forEach((id) => changes.push({ action: 'assignee_added', field: 'assignedTo', to: id }));
            removedAssignees.forEach((id) => changes.push({ action: 'assignee_removed', field: 'assignedTo', from: id }));
            patch.assignedTo = newAssignees;
        }

        for (const field of EDITABLE_FIELDS) {
            if (updates[field] === undefined) continue;
            const value = normalizeEditable(field, updates[field], task, userId);
            const current = field === 'attachments' ? (task.attachments || []) : task[field];
            if (comparable(field, value) === comparable(field, current)) continue;
            if (!policy.canEditTask(task, userId, isManager)) throw httpError(403, 'Only task creator or workspace managers can edit task details');
            if (field === 'priority' && !TASK_PRIORITIES.includes(value)) throw httpError(400, `Invalid priority: ${value}`);
            changes.push(field === 'attachments'
                ? { action: 'updated', field, from: (current || []).map((a) => a.name), to: value.map((a) => a.name) }
                : { action: 'updated', field, from: current, to: value });
            patch[field] = value;
        }

        const saved = Object.keys(patch).length ? await repo.update(task._id, patch) : task;

        for (const change of changes) {
            await logActivity(saved._id, userId, change.action, { field: change.field, from: change.from, to: change.to, metadata: change.metadata || {} }, req);
        }
        await logAction({ userId, action: 'task_updated', description: `Updated task: ${saved.title}`, resourceType: 'task', resourceId: saved._id, companyId: saved.company, metadata: updates, req });

        const populatedTask = await loadForClient(saved._id);
        if (io) {
            removedAssignees.forEach((assigneeId) => io.to(`user_${assigneeId}`).emit('task-removed', { taskId: saved._id, reason: 'reassigned' }));
            addedAssignees.forEach((assigneeId) => io.to(`user_${assigneeId}`).emit('task-assigned', populatedTask));
        }
        await emitToTaskAudience(io, saved, 'task-updated', populatedTask);
        if (completedNow) await postChannelNotice(saved, userId, `✅ **Completed Task:** ${saved.title}`, io);

        if (changes.length > 0) {
            (async () => {
                const notificationService = require('../../modules/notifications/notificationService');
                const changer = await identity.users.findById(userId);
                const actorUsername = changer?.username || 'Someone';
                const base = { workspaceId: saved.workspace, taskTitle: saved.title, taskId: String(saved._id) };
                const me = String(userId);
                const added = changes.filter((c) => c.action === 'assignee_added').map((c) => String(c.to)).filter((id) => id !== me);
                const removed = changes.filter((c) => c.action === 'assignee_removed').map((c) => String(c.from)).filter((id) => id !== me);
                await Promise.allSettled(added.map((assigneeId) => notificationService.taskAssigned(io, { ...base, assigneeId, assignerUsername: actorUsername })));
                if (removed.length) await notificationService.taskRemoved(io, { ...base, recipientIds: removed, actorUsername, reason: 'unassigned' });
                const audience = [...new Set([...saved.assignedTo.map(String), String(saved.createdBy || ''), ...(saved.watchers || []).map(String)])]
                    .filter((id) => id && id !== me && !added.includes(id));
                const statusChange = changes.find((c) => c.action === 'status_changed');
                if (statusChange) await notificationService.taskStatusChanged(io, { ...base, recipientIds: audience, changerUsername: actorUsername, from: statusChange.from, to: statusChange.to });
                const otherFields = [...new Set(changes.filter((c) => !['status_changed', 'unblocked', 'assignee_added', 'assignee_removed'].includes(c.action)).map((c) => c.field || c.action))];
                if (otherFields.length) await notificationService.taskUpdated(io, { ...base, recipientIds: audience, actorUsername, summary: `Changed ${otherFields.join(', ')}` });
            })().catch((err) => logger.warn({ err }, '[updateTask:pg] notifications failed'));
        }

        return { message: 'Task updated successfully', task: populatedTask, previousStatus, completed: completedNow };
    }

    // ── Delete / restore / permanent delete ──

    async function deleteTask(userId, taskId, io, req) {
        const { task, isWorkspaceAdmin: admin } = await loadForAdminAction(userId, taskId, { allowDeleted: false });
        const uid = String(userId);
        const isAssignee = task.assignedTo.some((id) => String(id) === uid);
        const isCompleted = task.status === 'done';
        const isCreator = String(task.createdBy) === uid;
        const canDelete = isCreator || (isAssignee && isCompleted) || admin;
        if (!canDelete) {
            throw httpError(403, isAssignee ? 'You can only delete tasks after marking them as completed' : 'Only task creator or workspace admin can delete tasks');
        }

        if (isCreator || admin) {
            await repo.softDelete(task._id, userId);
            await logActivity(task._id, userId, 'deleted', {}, req);
            (async () => {
                const notificationService = require('../../modules/notifications/notificationService');
                const actor = await identity.users.findById(userId);
                await notificationService.taskRemoved(io, {
                    recipientIds: task.assignedTo.map(String).filter((id) => id !== uid), actorUsername: actor?.username || 'Someone',
                    workspaceId: task.workspace, taskTitle: task.title, taskId: String(task._id), reason: 'deleted',
                });
            })().catch((err) => logger.warn({ err }, '[deleteTask:pg] notification failed'));
            await postChannelNotice(task, userId, `🗑️ **Deleted Task:** ${task.title}`, io);
            await logAction({ userId, action: 'task_deleted', description: `Deleted task: ${task.title}`, resourceType: 'task', resourceId: taskId, companyId: task.company, req });
            await emitToTaskAudience(io, task, 'task-deleted', { taskId: String(task._id), deleted: true });
            return { message: 'Task deleted successfully', workspaceId: task.workspace ? String(task.workspace) : null };
        }

        await repo.hideFor(task._id, userId);
        await logAction({ userId, action: 'task_deleted', description: `Removed completed task from view: ${task.title}`, resourceType: 'task', resourceId: taskId, companyId: task.company, req });
        if (io) io.to(`user_${uid}`).emit('task-removed', { taskId: String(task._id), reason: 'hidden' });
        return { message: 'Task removed from your view' };
    }

    async function restoreTask(userId, taskId, req) {
        const io = req?.io || null;
        const { task, isWorkspaceAdmin: admin } = await loadForAdminAction(userId, taskId);
        if (!(String(task.createdBy) === String(userId) || admin)) throw httpError(403, 'Only task creator or workspace admin can restore tasks');
        if (!task.deleted) return { message: 'Task is not deleted', task: await loadForClient(task._id) };
        if (task.parentTask) {
            const parent = await repo.findById(task.parentTask);
            if (parent?.deleted) throw httpError(400, 'Restore the parent task first');
        }
        await repo.restore(task._id, task.deletedAt);
        await logActivity(task._id, userId, 'restored', {}, req);
        await logAction({ userId, action: 'task_restored', description: `Restored task: ${task.title}`, resourceType: 'task', resourceId: taskId, companyId: task.company, req });
        const populatedTask = await loadForClient(task._id);
        await emitToTaskAudience(io, task, 'task-restored', { task: populatedTask });
        return { message: 'Task restored successfully', task: populatedTask };
    }

    async function permanentDeleteTask(userId, taskId, req) {
        const io = req?.io || null;
        const { task, isWorkspaceAdmin: admin } = await loadForAdminAction(userId, taskId);
        if (!(String(task.createdBy) === String(userId) || admin)) throw httpError(403, 'Only task creator or workspace admin can permanently delete tasks');
        const ids = await repo.hardDelete(task._id); // links, deps, activity, assignees cascade in SQL
        await Promise.allSettled([Message.updateMany({ linkedTaskId: { $in: ids } }, { $set: { linkedTaskId: null } })]);
        await logAction({ userId, action: 'task_permanently_deleted', description: `Permanently deleted task: ${task.title}`, resourceType: 'task', resourceId: taskId, companyId: task.company, req });
        await emitToTaskAudience(io, task, 'task-deleted', { taskId: String(task._id), permanent: true });
        return { message: 'Task permanently deleted' };
    }

    // ── Subtasks / activity ──

    async function createSubtask(userId, parentId, subtaskData, io, req) {
        const { title, description, assignedTo = [], priority, dueDate, tags } = subtaskData;
        if (!title) throw httpError(400, 'Subtask title is required');
        const { task: parentTask, workspace, isManager } = await loadTaskForUser(userId, parentId, { allowManager: true });
        if (parentTask.type === 'subtask' || parentTask.parentTask) throw httpError(400, 'Cannot create subtask under another subtask. Please create it under the parent task.');
        if (!policy.canAddSubtask(parentTask, userId, isManager)) throw httpError(403, 'Only task creator, assignees, or workspace managers can add subtasks');

        const subAssignees = [...new Set((Array.isArray(assignedTo) ? assignedTo : []).map(String))];
        if (workspace) assertActiveMembers(workspace, subAssignees);

        const subtask = await repo.insert({
            type: 'subtask', parentTask: parentTask._id, workspace: parentTask.workspace, company: parentTask.company, project: parentTask.project,
            taskType: parentTask.taskType, issueKey: await repo.nextIssueKey(parentTask.workspace, workspace?.name),
            title: String(title).trim(), description: description || '', createdBy: userId, assignedTo: subAssignees, status: 'todo',
            priority: TASK_PRIORITIES.includes(priority) ? priority : parentTask.priority, dueDate: dueDate ? new Date(dueDate) : null,
            tags: tags || [], visibility: parentTask.visibility, channel: parentTask.channel,
            epic: parentTask.type === 'epic' ? parentTask._id : parentTask.epic, source: 'manual',
        });

        (async () => {
            const notificationService = require('../../modules/notifications/notificationService');
            const creator = await identity.users.findById(userId);
            const actorUsername = creator?.username || 'Someone';
            const me = String(userId);
            const notifyAssignees = subtask.assignedTo.map(String).filter((id) => id !== me);
            await Promise.allSettled(notifyAssignees.map((assigneeId) => notificationService.taskAssigned(io, {
                assigneeId, assignerUsername: actorUsername, workspaceId: subtask.workspace, taskTitle: subtask.title, taskId: String(subtask._id),
            })));
            const parentAudience = [...new Set([...parentTask.assignedTo.map(String), String(parentTask.createdBy || '')])].filter((id) => id && id !== me && !notifyAssignees.includes(id));
            await notificationService.taskUpdated(io, {
                recipientIds: parentAudience, actorUsername, workspaceId: parentTask.workspace, taskTitle: parentTask.title,
                taskId: String(parentTask._id), summary: `Added subtask "${subtask.title}"`, kind: 'subtask',
            });
        })().catch((err) => logger.warn({ err }, '[createSubtask:pg] notification failed'));

        await logActivity(parentTask._id, userId, 'subtask_added', { metadata: { subtaskId: subtask._id, subtaskTitle: subtask.title } }, req);
        await logActivity(subtask._id, userId, 'created', { metadata: { parentTaskId: parentTask._id } }, req);

        const populatedSubtask = { ...subtask, parentTask: { _id: parentTask._id, title: parentTask.title } };
        await repo.hydrateUsers([populatedSubtask], ['createdBy', 'assignedTo']);

        if (io) {
            const stakeholders = new Set([String(parentTask.createdBy), ...parentTask.assignedTo.map(String), ...subtask.assignedTo.map(String)]);
            io.to([...stakeholders].map((id) => `user_${id}`)).emit('subtask-created', { subtask: populatedSubtask, parentTaskId: parentTask._id });
        }
        await emitToTaskAudience(io, parentTask, 'task-updated', await loadForClient(parentTask._id));
        return { message: 'Subtask created successfully', subtask: populatedSubtask };
    }

    async function getTaskActivity(userId, taskId, pagination = {}) {
        const { limit = 50, offset = 0 } = pagination;
        await loadTaskForUser(userId, taskId, { allowDeleted: true });
        const { activities, total } = await repo.listActivity(taskId, { limit: parseInt(limit), offset: parseInt(offset) });
        await repo.hydrateUsers(activities, ['user']);
        return { activities, pagination: { total, limit: parseInt(limit), offset: parseInt(offset), hasMore: (parseInt(offset) + parseInt(limit)) < total } };
    }

    // ── Links / watchers / dependencies ──

    async function addLink(userId, taskId, { linkedTaskId, linkType }) {
        if (!LINK_TYPES.includes(linkType)) throw httpError(400, `Invalid linkType. Must be one of: ${LINK_TYPES.join(', ')}`);
        if (!isObjectId(String(linkedTaskId))) throw httpError(400, 'Invalid linkedTaskId');
        if (String(taskId) === String(linkedTaskId)) throw httpError(400, 'A task cannot be linked to itself');
        const { task } = await loadTaskForUser(userId, taskId);
        const { task: linked } = await loadTaskForUser(userId, linkedTaskId);
        if (String(task.workspace) !== String(linked.workspace)) throw httpError(400, 'Linked tasks must be in the same workspace');
        await repo.addLink(task._id, linked._id, linkType, userId);
        await repo.addLink(linked._id, task._id, INVERSE_LINK[linkType] || 'relates_to', userId);

        const populated = await repo.findById(task._id);
        const others = await repo.findByIds(populated.linkedIssues.map((l) => l.task));
        const map = new Map(others.map((o) => [o._id, { _id: o._id, title: o.title, issueKey: o.issueKey, status: o.status, priority: o.priority, type: o.type }]));
        populated.linkedIssues = populated.linkedIssues.map((l) => ({ ...l, task: map.get(String(l.task)) || l.task }));
        return { task: populated };
    }

    async function removeLink(userId, taskId, linkId) {
        const { task } = await loadTaskForUser(userId, taskId);
        if (!isObjectId(String(linkId))) throw httpError(404, 'Link not found');
        const link = await repo.findLink(linkId);
        if (!link || link.taskId !== String(task._id)) throw httpError(404, 'Link not found');
        try {
            await repo.removeLinkBetween(link.task, task._id, INVERSE_LINK[link.linkType] || 'relates_to');
        } catch (err) {
            logger.warn({ err }, '[removeLink:pg] inverse link cleanup failed');
        }
        await repo.removeLink(linkId);
        return { message: 'Link removed' };
    }

    async function addWatcher(userId, taskId) {
        const { task } = await loadTaskForUser(userId, taskId);
        await repo.addWatcher(task._id, userId);
        return { watchers: await repo.listWatchers(task._id) };
    }

    async function removeWatcher(userId, taskId) {
        if (!isObjectId(String(taskId))) throw httpError(404, 'Task not found');
        const task = await repo.findById(taskId);
        if (!task) throw httpError(404, 'Task not found');
        await repo.removeWatcher(task._id, userId);
        return { watchers: await repo.listWatchers(task._id) };
    }

    async function addDependency(userId, taskId, dependencyTaskId) {
        if (!isObjectId(String(dependencyTaskId))) throw httpError(400, 'Invalid dependencyTaskId');
        if (String(taskId) === String(dependencyTaskId)) throw httpError(400, 'A task cannot depend on itself');
        const { task, isManager } = await loadTaskForUser(userId, taskId);
        const isAllowed = isManager || String(task.createdBy) === String(userId) || task.assignedTo.some((id) => String(id) === String(userId));
        if (!isAllowed) throw httpError(403, 'Only the creator, assignees or workspace managers can add dependencies');
        let depTask;
        try {
            ({ task: depTask } = await loadTaskForUser(userId, dependencyTaskId));
        } catch (err) {
            if (err.statusCode === 404) throw httpError(404, 'Dependency task not found');
            throw err;
        }
        if (String(depTask.workspace) !== String(task.workspace)) throw httpError(400, 'Dependencies must be in the same workspace');
        await repo.addDependency(task._id, depTask._id);
        return { dependencies: await repo.listDependencies(task._id) };
    }

    async function getWorkload(userId, workspaceId) {
        if (!workspaceId || typeof workspaceId !== 'string') throw httpError(400, 'workspaceId required');
        await validateWorkspaceMember(userId, workspaceId);
        const userChannels = await getUserChannels(userId, workspaceId);
        const result = await repo.workload({ workspace: workspaceId, userId, channelIds: userChannels });
        const users = await identity.users.findManyByIds(result.map((r) => r.userId));
        const userMap = {};
        users.forEach((u) => { userMap[String(u._id)] = { _id: String(u._id), username: u.username, profilePicture: u.profilePicture || null }; });
        return { workload: result.map((r) => ({ userId: r.userId, count: r.count, user: userMap[r.userId] || null })) };
    }

    // ── Revoke / transfer ──

    async function revokeTask(userId, taskId, req) {
        const io = req?.io || null;
        const { task } = await loadForAdminAction(userId, taskId, { allowDeleted: false });
        if (String(task.createdBy) !== String(userId)) throw httpError(403, 'Only the task creator can revoke tasks');

        const previousAssignees = task.assignedTo.map(String);
        const patch = { revokedAt: new Date(), revokedBy: userId, assignedTo: [String(userId)] };
        // A pending transfer no longer makes sense once the creator takes it back.
        if (task.transferRequest?.status === 'pending') patch.transferRequest = null;
        if (task.status === 'done') Object.assign(patch, { previousStatus: 'done', status: 'todo', completedAt: null, completedBy: null, completionNote: '' });
        const saved = await repo.update(task._id, patch);

        await logActivity(saved._id, userId, 'all_assignees_changed', { field: 'assignedTo', from: previousAssignees, to: [String(userId)], metadata: { revoked: true } }, req);
        await logAction({ userId, action: 'task_updated', description: `Revoked task: ${saved.title}`, resourceType: 'task', resourceId: taskId, companyId: saved.company, metadata: { previousAssignees }, req });

        const populatedTask = await loadForClient(saved._id);
        if (io) {
            previousAssignees.filter((id) => id !== String(userId)).forEach((id) => io.to(`user_${id}`).emit('task-removed', { taskId: String(saved._id), reason: 'revoked' }));
        }
        await emitToTaskAudience(io, saved, 'task-updated', populatedTask);
        return { message: 'Task revoked successfully. You can now edit and reassign it.', task: populatedTask };
    }

    async function requestTransfer(userId, taskId, newAssigneeId, note, io, req) {
        if (!newAssigneeId) throw httpError(400, 'New assignee ID is required');
        if (!isObjectId(String(newAssigneeId))) throw httpError(400, 'Invalid new assignee ID');
        const { task, workspace } = await loadForAdminAction(userId, taskId, { allowDeleted: false });

        if (!task.assignedTo.some((id) => String(id) === String(userId))) throw httpError(403, 'Only the task assignee can request a transfer');
        if (String(newAssigneeId) === String(userId)) throw httpError(400, 'You cannot transfer a task to yourself');
        if (!workspace || !isActiveMember(workspace, newAssigneeId)) throw httpError(400, 'The new assignee must be an active workspace member');
        if (task.assignedTo.some((id) => String(id) === String(newAssigneeId))) throw httpError(400, 'That user is already assigned to this task');

        const reason = typeof note === 'string' ? note.trim() : '';
        const transferRequest = { requestedBy: String(userId), requestedTo: String(newAssigneeId), requestedAt: new Date(), status: 'pending', reason };
        const saved = await repo.update(task._id, { transferRequest });

        await logActivity(saved._id, userId, 'transfer_requested', { to: String(newAssigneeId), metadata: { reason } }, req);
        (async () => {
            const notificationService = require('../../modules/notifications/notificationService');
            const users = await identity.users.findManyByIds([userId, newAssigneeId]);
            await notificationService.taskTransfer(io, {
                recipientIds: [String(newAssigneeId), String(saved.createdBy || '')].filter((id) => id && id !== String(userId)),
                requesterUsername: users.get(String(userId))?.username || 'Someone',
                toUsername: users.get(String(newAssigneeId))?.username || 'a teammate',
                workspaceId: saved.workspace, taskTitle: saved.title, taskId: String(saved._id), note: reason,
            });
        })().catch((err) => logger.warn({ err }, '[requestTransfer:pg] notification failed'));
        await logAction({ userId, action: 'task_updated', description: `Requested transfer for task: ${saved.title}`, resourceType: 'task', resourceId: taskId, companyId: saved.company, metadata: { newAssigneeId, note: reason }, req });

        const populatedTask = await loadForClient(saved._id);
        await emitToTaskAudience(io, saved, 'task-updated', populatedTask);
        return { message: "Transfer request submitted. Waiting for creator's approval.", transferRequest: transferForClient(saved.transferRequest), task: populatedTask };
    }

    async function handleTransferRequest(userId, taskId, action, io, req) {
        if (!['approve', 'reject'].includes(action)) throw httpError(400, "Invalid action. Use 'approve' or 'reject'");
        const { task, workspace } = await loadForAdminAction(userId, taskId, { allowDeleted: false });
        if (String(task.createdBy) !== String(userId)) throw httpError(403, 'Only the task creator can approve or reject transfer requests');
        const tr = task.transferRequest;
        if (!tr || tr.status !== 'pending') throw httpError(400, 'No pending transfer request found for this task');

        const requesterId = tr.requestedBy ? idOf(tr.requestedBy) : null;
        const newAssigneeId = tr.requestedTo ? idOf(tr.requestedTo) : null;

        if (action === 'approve') {
            if (!newAssigneeId) throw httpError(400, 'Cannot approve request: Target user not found or deleted');
            if (!workspace || !isActiveMember(workspace, newAssigneeId)) {
                throw httpError(400, 'Cannot approve request: the target user is no longer an active workspace member');
            }
            // Hand the requester's share of the task to the target; other assignees keep theirs.
            const next = task.assignedTo.map(String).filter((id) => id !== requesterId);
            if (!next.includes(newAssigneeId)) next.push(newAssigneeId);
            const saved = await repo.update(task._id, { assignedTo: next, transferRequest: { ...tr, status: 'approved' } });

            await logActivity(saved._id, userId, 'transfer_approved', { from: requesterId, to: newAssigneeId }, req);
            (async () => {
                const notificationService = require('../../modules/notifications/notificationService');
                const approver = await identity.users.findById(userId);
                const actorUsername = approver?.username || 'Someone';
                const base = { workspaceId: saved.workspace, taskTitle: saved.title, taskId: String(saved._id) };
                if (newAssigneeId !== String(userId)) await notificationService.taskAssigned(io, { ...base, assigneeId: newAssigneeId, assignerUsername: actorUsername });
                if (requesterId && requesterId !== String(userId)) {
                    await notificationService.taskUpdated(io, { ...base, recipientIds: [requesterId], actorUsername, summary: 'Your transfer request was approved', kind: 'transfer_approved' });
                }
            })().catch((err) => logger.warn({ err }, '[handleTransferRequest:pg] notification failed'));
            await logAction({ userId, action: 'task_updated', description: `Approved transfer request for task: ${saved.title}`, resourceType: 'task', resourceId: taskId, companyId: saved.company, req });

            const populatedTask = await loadForClient(saved._id);
            if (io) {
                io.to(`user_${newAssigneeId}`).emit('task-assigned', populatedTask);
                if (requesterId && requesterId !== String(userId)) io.to(`user_${requesterId}`).emit('task-removed', { taskId: saved._id, reason: 'reassigned' });
            }
            await emitToTaskAudience(io, saved, 'task-updated', populatedTask);
            return { message: 'Transfer request approved. Task has been reassigned.', task: populatedTask };
        }

        const saved = await repo.update(task._id, { transferRequest: { ...tr, status: 'rejected' } });
        await logActivity(saved._id, userId, 'transfer_rejected', { from: requesterId, to: newAssigneeId }, req);
        (async () => {
            const notificationService = require('../../modules/notifications/notificationService');
            const rejecter = await identity.users.findById(userId);
            if (requesterId && requesterId !== String(userId)) {
                await notificationService.taskUpdated(io, {
                    recipientIds: [requesterId], actorUsername: rejecter?.username || 'Someone', workspaceId: saved.workspace,
                    taskTitle: saved.title, taskId: String(saved._id), summary: 'Your transfer request was declined', kind: 'transfer_rejected',
                });
            }
        })().catch((err) => logger.warn({ err }, '[handleTransferRequest:pg] notification failed'));
        await logAction({ userId, action: 'task_updated', description: `Rejected transfer request for task: ${saved.title}`, resourceType: 'task', resourceId: taskId, companyId: saved.company, req });

        const populatedTask = await loadForClient(saved._id);
        await emitToTaskAudience(io, saved, 'task-updated', populatedTask);
        return { message: 'Transfer request rejected. Task remains with current assignee.', task: populatedTask };
    }

    // ── Timers ──

    async function startTimer(userId, taskId) {
        const { task } = await loadTaskForUser(userId, taskId);
        const timeTracking = freshTimeTracking(task.timeTracking);
        if (timeTracking.sessions.some((x) => x.start && !x.end)) throw httpError(400, 'A timer session is already running. Stop it first.');
        timeTracking.sessions.push({ start: new Date(), end: null });
        const saved = await repo.update(task._id, { timeTracking });
        return { message: 'Timer started', timeTracking: saved.timeTracking };
    }

    async function stopTimer(userId, taskId) {
        const { task } = await loadTaskForUser(userId, taskId);
        const timeTracking = freshTimeTracking(task.timeTracking);
        const open = timeTracking.sessions.slice().reverse().find((x) => x.start && !x.end);
        if (!open) throw httpError(400, 'No active timer session found');
        const now = new Date();
        open.end = now;
        const elapsed = Math.floor((now - new Date(open.start)) / 1000);
        timeTracking.totalTime += elapsed;
        const saved = await repo.update(task._id, { timeTracking });
        return { message: 'Timer stopped', elapsed, timeTracking: saved.timeTracking };
    }

    // ── Integrations (GitHub / Jira) ──

    /** Same contract as applyExternalUpdate in tasks.service.js; runs as a system actor. */
    async function applyExternalUpdate(taskId, { actorId, link = null, note = null, action = 'integration_event', status = null, onlyFrom = null } = {}, io = null) {
        const task = isObjectId(String(taskId)) ? await repo.findById(taskId) : null;
        if (!task || task.deleted) return { task: null, statusChanged: false };

        const patch = {};
        if (link && link.url) {
            const links = (task.externalLinks || []).map((l) => ({ ...l }));
            const i = links.findIndex((l) => l.url === link.url);
            const next = { ...(i >= 0 ? links[i] : {}), ...link, updatedAt: new Date() };
            if (i >= 0) links[i] = next; else links.push(next);
            patch.externalLinks = links;
        }

        const from = task.status;
        let statusChanged = false;
        if (status && TASK_STATUSES.includes(status) && status !== from && status !== 'blocked'
            && (!onlyFrom || onlyFrom.includes(from)) && isValidTransition(from, status)) {
            Object.assign(patch, { previousStatus: from, status });
            if (from === 'blocked') Object.assign(patch, { blockedBy: null, blockedAt: null, blockedReason: null });
            if (status === 'done') Object.assign(patch, { completedAt: new Date(), completedBy: actorId || null });
            else if (from === 'done') Object.assign(patch, { completedAt: null, completedBy: null, completionNote: '' });
            statusChanged = true;
        }

        const dirty = Object.keys(patch).length > 0;
        const saved = dirty ? await repo.update(task._id, patch) : task;

        const meta = link ? { provider: link.provider, kind: link.kind, url: link.url } : {};
        if (note && actorId) await logActivity(saved._id, actorId, action, { metadata: { ...meta, text: String(note).slice(0, 2000) } });
        if (statusChanged && actorId) {
            await logActivity(saved._id, actorId, 'status_changed', { field: 'status', from, to: status, metadata: { ...meta, source: link?.provider || 'integration' } });
        }
        if (dirty || note) {
            try {
                await emitToTaskAudience(io, saved, 'task-updated', await loadForClient(saved._id));
            } catch (err) {
                logger.warn({ err: err.message }, '[tasks:pg] integration update emit failed');
            }
        }
        return { task: saved, statusChanged, from, to: statusChanged ? status : from };
    }

    return {
        getTasks, getTask, getMyTasks, createTask, updateTask, deleteTask, restoreTask, permanentDeleteTask,
        createSubtask, getTaskActivity, addLink, removeLink, addWatcher, removeWatcher, addDependency, getWorkload,
        revokeTask, requestTransfer, handleTransferRequest, startTimer, stopTimer, applyExternalUpdate,
        loadForClient, loadTaskForUser,
    };
}

module.exports = { createPgTaskService, loadForClient };
