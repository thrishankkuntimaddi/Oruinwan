const logger = require('../../../utils/logger');
const mongoose = require('mongoose');

const Task = require('../../../models/Task');
const TaskActivity = require('../../../models/TaskActivity');
const { hydrateTaskUsers, hydrateTaskWorkspaces } = require('./tasks.hydrate');

// Users and workspaces (with their memberships) live in PostgreSQL: src/identity.
const identity = () => require('../../identity');
const Channel = require("../channels/channel.model.js");
const Message = require("../../modules/messages/message.model.js");

const messagesService = require('../../modules/messages/messages.service');

const { logAction } = require('../../../utils/historyLogger');
const { isValidTransition, getAllowedTransitions, validateBlocked } = require('../../../utils/workflowValidator');

const policy = require('./tasks.policy');
const { normalizeAttachments } = require('./tasks.validator');
const notifEmitter = require('../../modules/notifications/notificationEventEmitter');
const { tasksStore } = require('./tasks.store');
const {
    httpError,
    isObjectId,
    idOf,
    isActiveMember,
    resolveTaskCompany,
    nextIssueKey,
    canViewTask,
    emitToTaskAudience,
    populateTask,
    serializeTask,
    loadTaskForClient,
} = require('./tasks.shared');

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
const TASK_PRIORITIES = ['lowest', 'low', 'medium', 'high', 'highest'];
const LINK_TYPES = ['blocks', 'is_blocked_by', 'duplicates', 'is_duplicated_by', 'relates_to'];
const INVERSE_LINK = {
    blocks: 'is_blocked_by',
    is_blocked_by: 'blocks',
    duplicates: 'is_duplicated_by',
    is_duplicated_by: 'duplicates',
    relates_to: 'relates_to'
};

// ─────────────────────────────────────────────────────────────────────────────
// Access helpers
// ─────────────────────────────────────────────────────────────────────────────

function _isWorkspaceAdmin(workspace, userId) {
    const uid = String(userId);
    return !!(workspace?.members || []).some(m =>
        m?.user && idOf(m.user) === uid && (!m.status || m.status === 'active') &&
        (m.role === 'owner' || m.role === 'admin'));
}

/** 400 invalid id, 404 unknown workspace, 403 not an active member. */
async function _validateWorkspaceMember(userId, workspaceId) {
    if (!isObjectId(String(workspaceId))) throw httpError(400, 'Invalid workspace ID');
    const access = await identity().workspaces.membership(workspaceId, userId);
    if (!access) throw httpError(404, 'Workspace not found');
    if (!access.member) throw httpError(403, 'You are not a member of this workspace');
    return access.workspace;
}

async function _getUserChannels(userId, workspaceId) {
    const ids = await Channel.find({
        workspace: new mongoose.Types.ObjectId(String(workspaceId)),
        "members.user": new mongoose.Types.ObjectId(String(userId))
    }).distinct('_id');
    return (ids || []).map(String);
}

/**
 * Load a task and check the caller may see it: active member of its
 * workspace AND creator / assignee / visible by visibility. Watchers never
 * count. Managers (workspace owner/admin) pass with `allowManager`.
 */
async function _loadTaskForUser(userId, taskId, { allowDeleted = false, allowManager = false } = {}) {
    if (!isObjectId(String(taskId))) throw httpError(404, 'Task not found');
    const task = await Task.findById(taskId);
    if (!task || (task.deleted && !allowDeleted)) throw httpError(404, 'Task not found');
    if ((task.deletedFor || []).some(id => idOf(id) === String(userId))) throw httpError(404, 'Task not found');

    let workspace = null;
    let userChannels = [];
    let isManager = false;
    if (task.workspace) {
        workspace = await identity().workspaces.findById(task.workspace);
        if (!workspace) throw httpError(404, 'Workspace for this task not found');
        if (!isActiveMember(workspace, userId)) throw httpError(403, 'You are not a member of this workspace');
        isManager = _isWorkspaceAdmin(workspace, userId);
        if (task.visibility === 'channel' && task.channel) {
            userChannels = await _getUserChannels(userId, task.workspace);
        }
    }

    const canView = canViewTask(task, userId, userChannels);
    if (!canView && !(allowManager && isManager)) {
        throw httpError(403, "You don't have permission to view this task");
    }
    return { task, workspace, isManager, canView };
}

function _buildVisibilityQuery(userId, workspaceId, userChannels, { includeDeleted = false, includeSubtasks = false } = {}) {
    const uid = new mongoose.Types.ObjectId(String(userId));
    const channels = (userChannels || []).map(id => new mongoose.Types.ObjectId(String(id)));
    const and = [{
        $or: [
            { visibility: "workspace" },
            { createdBy: uid },
            { assignedTo: uid },
            { visibility: "channel", channel: { $in: channels } }
        ]
    }];
    if (!includeSubtasks) {
        and.push({ parentTask: null }, { type: { $ne: 'subtask' } });
    }
    const query = {
        workspace: new mongoose.Types.ObjectId(String(workspaceId)),
        deletedFor: { $ne: uid },
        $and: and
    };
    if (!includeDeleted) query.deleted = { $ne: true };
    return query;
}

async function _logActivity(taskId, userId, action, extra = {}, req) {
    try {
        await TaskActivity.create({
            task: taskId,
            user: userId,
            action,
            ...extra,
            ipAddress: req?.ip,
            userAgent: typeof req?.get === 'function' ? req.get('user-agent') : undefined
        });
    } catch (err) {
        logger.warn({ err }, `[tasks] activity '${action}' not recorded`);
    }
}

/**
 * Post an announcement into a channel task's channel. Channels are end-to-end
 * encrypted, so the text is encrypted with the channel key; when the server
 * cannot encrypt for the channel, nothing is posted (never plaintext).
 */
async function _postChannelNotice(task, userId, text, io) {
    if (task.visibility !== 'channel' || !task.channel) return;
    try {
        const { encryptForConversation } = require('../../modules/conversations/cryptoUtils');
        const channelId = idOf(task.channel);
        const enc = await encryptForConversation(channelId, 'channel', text);
        await messagesService.createMessage({
            type: 'message',
            company: task.company || null,
            workspace: task.workspace,
            channel: channelId,
            sender: userId,
            ciphertext: enc.ciphertext,
            messageIv: enc.messageIv,
            isEncrypted: true,
        }, io);
    } catch (err) {
        logger.warn({ err: err.message }, '[tasks] channel notice skipped (cannot encrypt for channel)');
    }
}

function _assertActiveMembers(workspace, ids) {
    const invalid = ids.filter(id => !isObjectId(String(id)) || !isActiveMember(workspace, id));
    if (invalid.length) {
        throw httpError(400, `Not active workspace members: ${invalid.join(', ')}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Store switch: TASKS_STORE=pg routes the ported functions through
// tasks.service.pg.js (same rules and shapes, PostgreSQL storage). Every
// public function has a PostgreSQL implementation.
// ─────────────────────────────────────────────────────────────────────────────

let _pgService = null;
function pg() {
    if (!_pgService) {
        _pgService = require('./tasks.service.pg').createPgTaskService({
            validateWorkspaceMember: _validateWorkspaceMember,
            getUserChannels: _getUserChannels,
            isWorkspaceAdmin: _isWorkspaceAdmin,
            postChannelNotice: _postChannelNotice,
            assertActiveMembers: _assertActiveMembers,
        });
    }
    return _pgService;
}
const onPg = () => tasksStore() === 'pg';

// ─────────────────────────────────────────────────────────────────────────────
// Queries
// ─────────────────────────────────────────────────────────────────────────────

async function getTasks(userId, filters = {}) {
    if (onPg()) return pg().getTasks(userId, filters);
    const { workspaceId, status, assignedTo, priority } = filters;
    const includeDeleted = filters.includeDeleted === true || filters.includeDeleted === 'true';
    const includeSubtasks = filters.includeSubtasks === true || filters.includeSubtasks === 'true';

    if (!workspaceId || typeof workspaceId !== 'string') throw httpError(400, 'Workspace ID required');

    await _validateWorkspaceMember(userId, workspaceId);
    const userChannels = await _getUserChannels(userId, workspaceId);

    // Workspace membership scopes the query; no company filter (tasks created
    // under a different company value must still show up).
    const query = _buildVisibilityQuery(userId, workspaceId, userChannels, { includeDeleted, includeSubtasks });

    if (typeof status === 'string' && status) {
        if (!TASK_STATUSES.includes(status)) throw httpError(400, `Invalid status: ${status}`);
        query.status = status;
    }
    if (typeof priority === 'string' && priority) {
        if (!TASK_PRIORITIES.includes(priority)) throw httpError(400, `Invalid priority: ${priority}`);
        query.priority = priority;
    }
    if (typeof assignedTo === 'string' && assignedTo) {
        if (!isObjectId(assignedTo)) throw httpError(400, 'Invalid assignedTo');
        query.assignedTo = new mongoose.Types.ObjectId(assignedTo);
    }

    const tasks = await populateTask(Task.find(query))
        .sort({ dueDate: 1, priority: -1, createdAt: -1 })
        .lean();
    await hydrateTaskUsers(tasks);

    return { tasks: tasks.map(serializeTask) };
}

async function getTask(userId, taskId) {
    if (onPg()) return pg().getTask(userId, taskId);
    const { task } = await _loadTaskForUser(userId, taskId, { allowDeleted: true });
    return { task: await loadTaskForClient(task._id) };
}

async function getMyTasks(userId, filters = {}) {
    if (onPg()) return pg().getMyTasks(userId, filters);
    const { status, priority } = filters;

    const user = await identity().users.findById(userId);
    if (!user) throw httpError(404, 'User not found');

    const query = {
        assignedTo: userId,
        deleted: { $ne: true },
        deletedFor: { $ne: userId }
    };
    if (typeof status === 'string' && status) query.status = status;
    if (typeof priority === 'string' && priority) query.priority = priority;

    const tasks = await Task.find(query)
        .populate("channel", "name")
        .sort({ dueDate: 1, priority: -1 })
        .lean();
    await Promise.all([
        hydrateTaskUsers(tasks, ['createdBy', 'transferRequest.requestedTo', 'transferRequest.requestedBy']),
        hydrateTaskWorkspaces(tasks),
    ]);

    return { tasks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Create
// ─────────────────────────────────────────────────────────────────────────────

async function createTask(userId, taskData, io, req) {
    if (onPg()) return pg().createTask(userId, taskData, io, req);
    const {
        workspaceId,
        title,
        description,
        assignedToIds = [],
        channelId = null,
        taskMode = 'split',
        status = "todo",
        priority = "medium",
        dueDate,
        linkedMessage,
        tags,
        source,
        type,
        blockedReason,
        attachments
    } = taskData;
    const assignmentType = taskData.assignmentType === 'members' ? 'individual' : (taskData.assignmentType || 'self');

    if (!title || !workspaceId) throw httpError(400, 'Title and workspace ID required');
    if (!['self', 'individual', 'channel'].includes(assignmentType)) throw httpError(400, 'Invalid assignment type');
    if (!TASK_STATUSES.includes(status)) throw httpError(400, `Invalid status: ${status}`);
    if (status === 'blocked') {
        const v = validateBlocked(status, blockedReason);
        if (!v.valid) throw httpError(400, v.error);
    }

    const user = await identity().users.findById(userId);
    if (!user) throw httpError(404, 'User not found');

    const workspace = await _validateWorkspaceMember(userId, workspaceId);

    // Every assignment type may carry a channel; it must belong to this
    // workspace and be accessible to the creator.
    let channel = null;
    if (channelId) {
        if (!isObjectId(String(channelId))) throw httpError(400, 'Invalid channel ID');
        channel = await Channel.findById(channelId);
        if (!channel || String(channel.workspace) !== String(workspace._id)) {
            throw httpError(400, 'Invalid channel');
        }
        if (typeof channel.isMember === 'function' ? !channel.isMember(userId)
            : !(channel.members || []).some(m => idOf(m.user || m) === String(userId))) {
            throw httpError(403, "You don't have access to this channel");
        }
    } else if (assignmentType === 'channel') {
        throw httpError(400, 'Channel ID required');
    }
    const channelRef = channel ? channel._id : null;

    const taskDefinitions = [];
    if (assignmentType === "self") {
        taskDefinitions.push({ assignedTo: [userId], visibility: "private" });
    } else if (assignmentType === "individual") {
        const ids = [...new Set((assignedToIds || []).map(String))];
        if (ids.length === 0) throw httpError(400, 'Please select at least one assignee');
        _assertActiveMembers(workspace, ids);

        if (taskMode === 'split' && ids.length > 1) {
            ids.forEach(id => taskDefinitions.push({ assignedTo: [id], visibility: "private" }));
        } else {
            taskDefinitions.push({ assignedTo: ids, visibility: "private" });
        }
    } else {
        let memberIds;
        if (assignedToIds && assignedToIds.length > 0) {
            memberIds = [...new Set(assignedToIds.map(String))];
            _assertActiveMembers(workspace, memberIds);
        } else {
            memberIds = [...new Set((channel.members || [])
                .map(m => idOf(m.user || m))
                .filter(id => isActiveMember(workspace, id)))];
        }
        taskDefinitions.push({ assignedTo: memberIds, visibility: "channel" });
    }

    const company = resolveTaskCompany(workspace, user);
    const storedAttachments = normalizeAttachments(Array.isArray(attachments) ? attachments : [], userId);
    const createdTasks = [];

    for (const def of taskDefinitions) {
        const issueKey = await nextIssueKey(workspace._id, workspace.name);

        const task = new Task({
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
            issueKey,
            ...(status === 'blocked' ? { blockedReason: blockedReason.trim(), blockedBy: userId, blockedAt: new Date() } : {}),
            ...(status === 'done' ? { completedAt: new Date(), completedBy: userId } : {}),
        });

        await task.save();
        createdTasks.push(task);

        await _logActivity(task._id, userId, 'created', {
            metadata: { assignmentType, visibility: def.visibility, source: task.source, channel: channelRef }
        }, req);

        await logAction({
            userId,
            action: "task_created",
            description: `Created task: ${task.title}`,
            resourceType: "task",
            resourceId: task._id,
            companyId: company,
            req
        });

        await _postChannelNotice(task, userId, `🆕 **New Task:** ${task.title}\nAssigned to Team`, io);

        try {
            const assignerUsername = user.username || 'Someone';
            for (const assigneeId of task.assignedTo) {
                if (assigneeId.toString() === userId.toString()) continue;
                const assignee = await identity().users.findById(assigneeId);
                notifEmitter.emit('task.assigned', {
                    io,
                    assigneeId: assigneeId.toString(),
                    assignerUsername,
                    workspaceId: task.workspace?.toString(),
                    taskTitle: task.title,
                    taskId: task._id?.toString(),
                    assigneeEmail: assignee?.email || null,
                });
            }
        } catch (noteErr) {
            logger.error("Notification Error:", noteErr);
        }
    }

    const populatedTasks = await Promise.all(createdTasks.map(t => loadTaskForClient(t._id)));

    for (let i = 0; i < createdTasks.length; i++) {
        await emitToTaskAudience(io, createdTasks[i], "task-created", populatedTasks[i]);
    }

    return {
        message: "Tasks created successfully",
        tasks: populatedTasks
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Update
// ─────────────────────────────────────────────────────────────────────────────

const EDITABLE_FIELDS = ['title', 'description', 'priority', 'dueDate', 'tags',
    'storyPoints', 'estimatedHours', 'actualHours', 'resolution', 'attachments'];

function _normalizeEditable(field, value, task, userId) {
    switch (field) {
        case 'title': return String(value).trim();
        case 'description': return value === null ? '' : value;
        case 'resolution': return value === null ? '' : value;
        case 'dueDate': return value ? new Date(value) : null;
        case 'attachments': {
            const existing = task.attachments || [];
            return normalizeAttachments(value || [], userId).map(a => {
                const prev = existing.find(e => e.url === a.url && e.name === a.name);
                return prev ? { ...a, uploadedBy: prev.uploadedBy || a.uploadedBy, uploadedAt: prev.uploadedAt || a.uploadedAt } : a;
            });
        }
        default: return value;
    }
}

function _comparable(field, value) {
    if (value === undefined || value === null) return JSON.stringify(null);
    if (field === 'dueDate') return JSON.stringify(new Date(value).getTime());
    if (field === 'attachments') return JSON.stringify((value || []).map(a => [a.name, a.url]));
    if (field === 'tags') return JSON.stringify(Array.from(value));
    return JSON.stringify(value);
}

async function updateTask(userId, taskId, updates, io, req) {
    if (onPg()) return pg().updateTask(userId, taskId, updates, io, req);
    updates = updates || {};
    const { task, isManager } = await _loadTaskForUser(userId, taskId, { allowManager: true });

    const changes = [];
    const previousStatus = task.status;
    let completedNow = false;

    if (updates.status && updates.status !== previousStatus) {
        if (!TASK_STATUSES.includes(updates.status)) throw httpError(400, `Invalid status: ${updates.status}`);
        if (!policy.canChangeStatus(task, userId, isManager)) {
            throw httpError(403, 'Only the creator, assignees or workspace managers can change task status');
        }
        if (!isValidTransition(previousStatus, updates.status)) {
            throw httpError(400, `Invalid status transition from "${previousStatus}" to "${updates.status}"`, {
                allowedTransitions: getAllowedTransitions(previousStatus)
            });
        }
        if (updates.status === 'blocked') {
            const validation = validateBlocked(updates.status, typeof updates.blockedReason === 'string' ? updates.blockedReason.trim() : '');
            if (!validation.valid) throw httpError(400, validation.error);
        }

        changes.push({
            action: 'status_changed',
            field: 'status',
            from: previousStatus,
            to: updates.status,
            metadata: updates.status === 'blocked' ? { reason: updates.blockedReason.trim() } : {}
        });

        task.previousStatus = previousStatus;
        task.status = updates.status;

        if (updates.status === 'blocked') {
            task.blockedBy = userId;
            task.blockedAt = new Date();
            task.blockedReason = updates.blockedReason.trim();
        } else if (previousStatus === 'blocked' || task.blockedReason) {
            changes.push({ action: 'unblocked', field: 'status', from: previousStatus, to: updates.status });
            task.blockedBy = null;
            task.blockedAt = null;
            task.blockedReason = null;
        }

        if (updates.status === 'done') {
            task.completedBy = userId;
            task.completedAt = new Date();
            task.completionNote = typeof updates.completionNote === 'string' ? updates.completionNote : '';
            completedNow = true;
        } else if (previousStatus === 'done') {
            // Reopened: the task is no longer complete.
            task.completedBy = null;
            task.completedAt = null;
            task.completionNote = '';
        }
    } else if (task.status === 'blocked' && typeof updates.blockedReason === 'string' &&
        updates.blockedReason.trim() && updates.blockedReason.trim() !== task.blockedReason) {
        if (!policy.canChangeStatus(task, userId, isManager)) {
            throw httpError(403, 'Only the creator, assignees or workspace managers can change the blocked reason');
        }
        changes.push({ action: 'blocked', field: 'blockedReason', from: task.blockedReason, to: updates.blockedReason.trim() });
        task.blockedReason = updates.blockedReason.trim();
    }

    // Assignees
    let addedAssignees = [];
    let removedAssignees = [];
    if (updates.assignedTo !== undefined) {
        if (!policy.canManageAssignees(task, userId, isManager)) {
            throw httpError(403, 'Only task creator or workspace managers can manage assignees');
        }
        const workspace = await identity().workspaces.findById(task.workspace);
        const oldAssignees = task.assignedTo.map(id => id.toString());
        const newAssignees = [...new Set((Array.isArray(updates.assignedTo) ? updates.assignedTo : [updates.assignedTo])
            .map(id => String(id)))];
        _assertActiveMembers(workspace, newAssignees);

        addedAssignees = newAssignees.filter(id => !oldAssignees.includes(id));
        removedAssignees = oldAssignees.filter(id => !newAssignees.includes(id));
        addedAssignees.forEach(id => changes.push({ action: 'assignee_added', field: 'assignedTo', to: id }));
        removedAssignees.forEach(id => changes.push({ action: 'assignee_removed', field: 'assignedTo', from: id }));
        task.assignedTo = newAssignees;
    }

    // Details
    for (const field of EDITABLE_FIELDS) {
        if (updates[field] === undefined) continue;
        const value = _normalizeEditable(field, updates[field], task, userId);
        const current = field === 'attachments' ? (task.attachments || []) : task[field];
        if (_comparable(field, value) === _comparable(field, current)) continue;

        if (!policy.canEditTask(task, userId, isManager)) {
            throw httpError(403, 'Only task creator or workspace managers can edit task details');
        }
        if (field === 'priority' && !TASK_PRIORITIES.includes(value)) throw httpError(400, `Invalid priority: ${value}`);

        changes.push(field === 'attachments'
            ? { action: 'updated', field, from: (current || []).map(a => a.name), to: value.map(a => a.name) }
            : { action: 'updated', field, from: current, to: value });
        task[field] = value;
    }

    await task.save();

    for (const change of changes) {
        await _logActivity(task._id, userId, change.action, {
            field: change.field,
            from: change.from,
            to: change.to,
            metadata: change.metadata || {}
        }, req);
    }

    await logAction({
        userId,
        action: "task_updated",
        description: `Updated task: ${task.title}`,
        resourceType: "task",
        resourceId: task._id,
        companyId: task.company,
        metadata: updates,
        req
    });

    const populatedTask = await loadTaskForClient(task._id);

    if (io) {
        removedAssignees.forEach(assigneeId => {
            io.to(`user_${assigneeId}`).emit("task-removed", { taskId: task._id, reason: "reassigned" });
        });
        addedAssignees.forEach(assigneeId => {
            io.to(`user_${assigneeId}`).emit("task-assigned", populatedTask);
        });
    }
    await emitToTaskAudience(io, task, "task-updated", populatedTask);

    if (completedNow) {
        await _postChannelNotice(task, userId, `✅ **Completed Task:** ${task.title}`, io);
    }

    // Bell notifications: new assignees, removed assignees, status moves and
    // other edits go to everyone on the task except the person editing it.
    if (changes.length > 0) {
        (async () => {
            const notificationService = require('../../modules/notifications/notificationService');
            const changer = await identity().users.findById(userId);
            const actorUsername = changer?.username || 'Someone';
            const base = { workspaceId: task.workspace, taskTitle: task.title, taskId: String(task._id) };
            const me = String(userId);

            const added = changes.filter(c => c.action === 'assignee_added').map(c => String(c.to)).filter(id => id !== me);
            const removed = changes.filter(c => c.action === 'assignee_removed').map(c => String(c.from)).filter(id => id !== me);
            await Promise.allSettled(added.map(assigneeId => notificationService.taskAssigned(io, { ...base, assigneeId, assignerUsername: actorUsername })));
            if (removed.length) await notificationService.taskRemoved(io, { ...base, recipientIds: removed, actorUsername, reason: 'unassigned' });

            const audience = [...new Set([
                ...task.assignedTo.map(String),
                String(task.createdBy || ''),
                ...(task.watchers || []).map(String),
            ])].filter(id => id && id !== me && !added.includes(id));

            const statusChange = changes.find(c => c.action === 'status_changed');
            if (statusChange) {
                await notificationService.taskStatusChanged(io, { ...base, recipientIds: audience, changerUsername: actorUsername, from: statusChange.from, to: statusChange.to });
            }
            const otherFields = [...new Set(changes
                .filter(c => !['status_changed', 'unblocked', 'assignee_added', 'assignee_removed'].includes(c.action))
                .map(c => c.field || c.action))];
            if (otherFields.length) {
                await notificationService.taskUpdated(io, { ...base, recipientIds: audience, actorUsername, summary: `Changed ${otherFields.join(', ')}` });
            }
        })().catch(err => logger.warn({ err }, '[updateTask] notifications failed'));
    }

    return {
        message: "Task updated successfully",
        task: populatedTask,
        previousStatus,
        completed: completedNow
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete / restore / permanent delete
// ─────────────────────────────────────────────────────────────────────────────

async function _loadTaskWorkspaceForAdminAction(userId, taskId, { allowDeleted = true } = {}) {
    if (!isObjectId(String(taskId))) throw httpError(404, 'Task not found');
    const task = await Task.findById(taskId);
    if (!task || (task.deleted && !allowDeleted)) throw httpError(404, 'Task not found');
    let workspace = null;
    if (task.workspace) {
        workspace = await identity().workspaces.findById(task.workspace);
        if (!workspace) throw httpError(404, 'Workspace for this task not found');
        if (!isActiveMember(workspace, userId)) throw httpError(403, 'You are not a member of this workspace');
    }
    return { task, workspace, isWorkspaceAdmin: _isWorkspaceAdmin(workspace, userId) };
}

async function deleteTask(userId, taskId, io, req) {
    if (onPg()) return pg().deleteTask(userId, taskId, io, req);
    const { task, isWorkspaceAdmin } = await _loadTaskWorkspaceForAdminAction(userId, taskId, { allowDeleted: false });
    const uid = String(userId);
    const isAssignee = task.assignedTo.some(id => id.toString() === uid);
    const isCompleted = task.status === 'done';
    const isCreator = task.createdBy.toString() === uid;

    const canDelete = isCreator || (isAssignee && isCompleted) || isWorkspaceAdmin;
    if (!canDelete) {
        throw httpError(403, isAssignee
            ? "You can only delete tasks after marking them as completed"
            : "Only task creator or workspace admin can delete tasks");
    }

    if (isCreator || isWorkspaceAdmin) {
        const now = new Date();
        task.deleted = true;
        task.deletedAt = now;
        task.deletedBy = userId;
        await task.save();

        // Subtasks go to the trash with their parent (same deletedAt so a
        // restore brings back exactly these).
        await Task.updateMany(
            { parentTask: task._id, deleted: { $ne: true } },
            { $set: { deleted: true, deletedAt: now, deletedBy: userId } }
        );

        await _logActivity(task._id, userId, 'deleted', {}, req);

        (async () => {
            const notificationService = require('../../modules/notifications/notificationService');
            const actor = await identity().users.findById(userId);
            await notificationService.taskRemoved(io, {
                recipientIds: task.assignedTo.map(String).filter(id => id !== uid),
                actorUsername: actor?.username || 'Someone',
                workspaceId: task.workspace,
                taskTitle: task.title,
                taskId: String(task._id),
                reason: 'deleted',
            });
        })().catch(err => logger.warn({ err }, '[deleteTask] notification failed'));

        await _postChannelNotice(task, userId, `🗑️ **Deleted Task:** ${task.title}`, io);

        await logAction({
            userId,
            action: "task_deleted",
            description: `Deleted task: ${task.title}`,
            resourceType: "task",
            resourceId: taskId,
            companyId: task.company,
            req
        });

        await emitToTaskAudience(io, task, "task-deleted", { taskId: String(task._id), deleted: true });

        return { message: "Task deleted successfully", workspaceId: task.workspace ? String(task.workspace._id || task.workspace) : null };
    }

    // Assignee hiding a completed task from their own view.
    if (!(task.deletedFor || []).some(id => idOf(id) === uid)) {
        task.deletedFor.push(userId);
    }
    await task.save();

    await logAction({
        userId,
        action: "task_deleted",
        description: `Removed completed task from view: ${task.title}`,
        resourceType: "task",
        resourceId: taskId,
        companyId: task.company,
        req
    });

    if (io) io.to(`user_${uid}`).emit("task-removed", { taskId: String(task._id), reason: "hidden" });

    return { message: "Task removed from your view" };
}

async function restoreTask(userId, taskId, req) {
    if (onPg()) return pg().restoreTask(userId, taskId, req);
    const io = req?.io || null;
    const { task, isWorkspaceAdmin } = await _loadTaskWorkspaceForAdminAction(userId, taskId);

    const canRestore = task.createdBy.toString() === String(userId) || isWorkspaceAdmin;
    if (!canRestore) throw httpError(403, 'Only task creator or workspace admin can restore tasks');

    if (!task.deleted) {
        return { message: "Task is not deleted", task: await loadTaskForClient(task._id) };
    }

    if (task.parentTask) {
        const parent = await Task.findById(task.parentTask).select('deleted').lean();
        if (parent?.deleted) throw httpError(400, 'Restore the parent task first');
    }

    const deletedAt = task.deletedAt;
    task.deleted = false;
    task.deletedAt = null;
    task.deletedBy = null;
    await task.save();

    await Task.updateMany(
        { parentTask: task._id, deleted: true, ...(deletedAt ? { deletedAt } : {}) },
        { $set: { deleted: false, deletedAt: null, deletedBy: null } }
    );

    await _logActivity(task._id, userId, 'restored', {}, req);

    await logAction({
        userId,
        action: "task_restored",
        description: `Restored task: ${task.title}`,
        resourceType: "task",
        resourceId: taskId,
        companyId: task.company,
        req
    });

    const populatedTask = await loadTaskForClient(task._id);
    await emitToTaskAudience(io, task, "task-restored", { task: populatedTask });

    return {
        message: "Task restored successfully",
        task: populatedTask
    };
}

async function permanentDeleteTask(userId, taskId, req) {
    if (onPg()) return pg().permanentDeleteTask(userId, taskId, req);
    const io = req?.io || null;
    const { task, isWorkspaceAdmin } = await _loadTaskWorkspaceForAdminAction(userId, taskId);

    const canDelete = task.createdBy.toString() === String(userId) || isWorkspaceAdmin;
    if (!canDelete) throw httpError(403, 'Only task creator or workspace admin can permanently delete tasks');

    const subtaskIds = await Task.find({ parentTask: task._id }).distinct('_id');
    const ids = [task._id, ...(subtaskIds || [])];

    await Task.deleteMany({ _id: { $in: ids } });

    // No dangling references to the removed tasks.
    await Task.updateMany(
        { $or: [{ subtasks: { $in: ids } }, { dependencies: { $in: ids } }, { 'linkedIssues.task': { $in: ids } }] },
        { $pull: { subtasks: { $in: ids }, dependencies: { $in: ids }, linkedIssues: { task: { $in: ids } } } }
    );
    await Promise.allSettled([
        TaskActivity.deleteMany({ task: { $in: ids } }),
        Message.updateMany({ linkedTaskId: { $in: ids } }, { $set: { linkedTaskId: null } }),
    ]);

    await logAction({
        userId,
        action: "task_permanently_deleted",
        description: `Permanently deleted task: ${task.title}`,
        resourceType: "task",
        resourceId: taskId,
        companyId: task.company,
        req
    });

    await emitToTaskAudience(io, task, "task-deleted", { taskId: String(task._id), permanent: true });

    return { message: "Task permanently deleted" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Revoke / transfer
// ─────────────────────────────────────────────────────────────────────────────

async function revokeTask(userId, taskId, req) {
    if (onPg()) return pg().revokeTask(userId, taskId, req);
    const io = req?.io || null;
    const { task } = await _loadTaskWorkspaceForAdminAction(userId, taskId, { allowDeleted: false });

    if (task.createdBy.toString() !== String(userId)) {
        throw httpError(403, 'Only the task creator can revoke tasks');
    }

    task.revokedAt = new Date();
    task.revokedBy = userId;

    const previousAssignees = task.assignedTo.map(String);
    task.assignedTo = [userId];

    // A pending transfer no longer makes sense once the creator takes it back.
    if (task.transferRequest?.status === 'pending') {
        task.transferRequest = undefined;
    }

    if (task.status === 'done') {
        task.previousStatus = 'done';
        task.status = 'todo';
        task.completedAt = null;
        task.completedBy = null;
        task.completionNote = '';
    }

    await task.save();

    await _logActivity(task._id, userId, 'all_assignees_changed', {
        field: 'assignedTo', from: previousAssignees, to: [String(userId)], metadata: { revoked: true }
    }, req);

    await logAction({
        userId,
        action: "task_updated",
        description: `Revoked task: ${task.title}`,
        resourceType: "task",
        resourceId: taskId,
        companyId: task.company,
        metadata: { previousAssignees },
        req
    });

    const populatedTask = await loadTaskForClient(task._id);
    if (io) {
        previousAssignees.filter(id => id !== String(userId)).forEach(id => {
            io.to(`user_${id}`).emit("task-removed", { taskId: String(task._id), reason: "revoked" });
        });
    }
    await emitToTaskAudience(io, task, "task-updated", populatedTask);

    return {
        message: "Task revoked successfully. You can now edit and reassign it.",
        task: populatedTask
    };
}

function _transferForClient(tr) {
    if (!tr) return tr;
    const obj = typeof tr.toObject === 'function' ? tr.toObject() : { ...tr };
    return { ...obj, note: obj.reason || '' };
}

async function requestTransfer(userId, taskId, newAssigneeId, note, io, req) {
    if (onPg()) return pg().requestTransfer(userId, taskId, newAssigneeId, note, io, req);
    if (!newAssigneeId) throw httpError(400, 'New assignee ID is required');
    if (!isObjectId(String(newAssigneeId))) throw httpError(400, 'Invalid new assignee ID');

    const { task, workspace } = await _loadTaskWorkspaceForAdminAction(userId, taskId, { allowDeleted: false });

    const isAssignee = task.assignedTo.some(id => id.toString() === String(userId));
    if (!isAssignee) throw httpError(403, 'Only the task assignee can request a transfer');
    if (String(newAssigneeId) === String(userId)) throw httpError(400, 'You cannot transfer a task to yourself');
    if (!workspace || !isActiveMember(workspace, newAssigneeId)) {
        throw httpError(400, 'The new assignee must be an active workspace member');
    }
    if (task.assignedTo.some(id => id.toString() === String(newAssigneeId))) {
        throw httpError(400, 'That user is already assigned to this task');
    }

    const reason = typeof note === 'string' ? note.trim() : '';
    task.transferRequest = {
        requestedBy: userId,
        requestedTo: newAssigneeId,
        requestedAt: new Date(),
        status: 'pending',
        reason
    };
    await task.save();

    await _logActivity(task._id, userId, 'transfer_requested', { to: String(newAssigneeId), metadata: { reason } }, req);

    (async () => {
        const notificationService = require('../../modules/notifications/notificationService');
        const [requester, target] = await Promise.all([
            identity().users.findById(userId),
            identity().users.findById(newAssigneeId),
        ]);
        await notificationService.taskTransfer(io, {
            recipientIds: [String(newAssigneeId), String(task.createdBy || '')].filter(id => id && id !== String(userId)),
            requesterUsername: requester?.username || 'Someone',
            toUsername: target?.username || 'a teammate',
            workspaceId: task.workspace,
            taskTitle: task.title,
            taskId: String(task._id),
            note: reason,
        });
    })().catch(err => logger.warn({ err }, '[requestTransfer] notification failed'));

    await logAction({
        userId,
        action: "task_updated",
        description: `Requested transfer for task: ${task.title}`,
        resourceType: "task",
        resourceId: taskId,
        companyId: task.company,
        metadata: { newAssigneeId, note: reason },
        req
    });

    const populatedTask = await loadTaskForClient(task._id);
    await emitToTaskAudience(io, task, "task-updated", populatedTask);

    return {
        message: "Transfer request submitted. Waiting for creator's approval.",
        transferRequest: _transferForClient(task.transferRequest),
        task: populatedTask
    };
}

async function handleTransferRequest(userId, taskId, action, io, req) {
    if (onPg()) return pg().handleTransferRequest(userId, taskId, action, io, req);
    if (!['approve', 'reject'].includes(action)) {
        throw httpError(400, "Invalid action. Use 'approve' or 'reject'");
    }

    const { task, workspace } = await _loadTaskWorkspaceForAdminAction(userId, taskId, { allowDeleted: false });

    if (task.createdBy.toString() !== String(userId)) {
        throw httpError(403, 'Only the task creator can approve or reject transfer requests');
    }
    if (!task.transferRequest || task.transferRequest.status !== 'pending') {
        throw httpError(400, 'No pending transfer request found for this task');
    }

    const requesterId = task.transferRequest.requestedBy ? idOf(task.transferRequest.requestedBy) : null;
    const newAssigneeId = task.transferRequest.requestedTo ? idOf(task.transferRequest.requestedTo) : null;

    if (action === 'approve') {
        if (!newAssigneeId) throw httpError(400, 'Cannot approve request: Target user not found or deleted');
        if (!workspace || !isActiveMember(workspace, newAssigneeId)) {
            throw httpError(400, 'Cannot approve request: the target user is no longer an active workspace member');
        }

        // Hand the requester's share of the task to the target; other
        // assignees keep theirs.
        const next = task.assignedTo.map(String).filter(id => id !== requesterId);
        if (!next.includes(newAssigneeId)) next.push(newAssigneeId);
        task.assignedTo = next;
        task.transferRequest.status = 'approved';
        await task.save();

        await _logActivity(task._id, userId, 'transfer_approved', { from: requesterId, to: newAssigneeId }, req);

        (async () => {
            const notificationService = require('../../modules/notifications/notificationService');
            const approver = await identity().users.findById(userId);
            const actorUsername = approver?.username || 'Someone';
            const base = { workspaceId: task.workspace, taskTitle: task.title, taskId: String(task._id) };
            if (newAssigneeId !== String(userId)) {
                await notificationService.taskAssigned(io, { ...base, assigneeId: newAssigneeId, assignerUsername: actorUsername });
            }
            if (requesterId && requesterId !== String(userId)) {
                await notificationService.taskUpdated(io, { ...base, recipientIds: [requesterId], actorUsername, summary: 'Your transfer request was approved', kind: 'transfer_approved' });
            }
        })().catch(err => logger.warn({ err }, '[handleTransferRequest] notification failed'));

        await logAction({
            userId,
            action: "task_updated",
            description: `Approved transfer request for task: ${task.title}`,
            resourceType: "task",
            resourceId: taskId,
            companyId: task.company,
            req
        });

        const populatedTask = await loadTaskForClient(task._id);
        if (io) {
            io.to(`user_${newAssigneeId}`).emit("task-assigned", populatedTask);
            if (requesterId && requesterId !== String(userId)) {
                io.to(`user_${requesterId}`).emit("task-removed", { taskId: task._id, reason: "reassigned" });
            }
        }
        await emitToTaskAudience(io, task, "task-updated", populatedTask);

        return {
            message: "Transfer request approved. Task has been reassigned.",
            task: populatedTask
        };
    }

    task.transferRequest.status = 'rejected';
    await task.save();

    await _logActivity(task._id, userId, 'transfer_rejected', { from: requesterId, to: newAssigneeId }, req);

    (async () => {
        const notificationService = require('../../modules/notifications/notificationService');
        const rejecter = await identity().users.findById(userId);
        if (requesterId && requesterId !== String(userId)) {
            await notificationService.taskUpdated(io, {
                recipientIds: [requesterId], actorUsername: rejecter?.username || 'Someone',
                workspaceId: task.workspace, taskTitle: task.title, taskId: String(task._id),
                summary: 'Your transfer request was declined', kind: 'transfer_rejected',
            });
        }
    })().catch(err => logger.warn({ err }, '[handleTransferRequest] notification failed'));

    await logAction({
        userId,
        action: "task_updated",
        description: `Rejected transfer request for task: ${task.title}`,
        resourceType: "task",
        resourceId: taskId,
        companyId: task.company,
        req
    });

    const populatedTask = await loadTaskForClient(task._id);
    await emitToTaskAudience(io, task, "task-updated", populatedTask);

    return {
        message: "Transfer request rejected. Task remains with current assignee.",
        task: populatedTask
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Subtasks / activity
// ─────────────────────────────────────────────────────────────────────────────

async function createSubtask(userId, parentId, subtaskData, io, req) {
    if (onPg()) return pg().createSubtask(userId, parentId, subtaskData, io, req);
    const { title, description, assignedTo = [], priority, dueDate, tags } = subtaskData;
    if (!title) throw httpError(400, 'Subtask title is required');

    const { task: parentTask, workspace, isManager } = await _loadTaskForUser(userId, parentId, { allowManager: true });

    if (parentTask.type === 'subtask' || parentTask.parentTask) {
        throw httpError(400, 'Cannot create subtask under another subtask. Please create it under the parent task.');
    }
    if (!policy.canAddSubtask(parentTask, userId, isManager)) {
        throw httpError(403, 'Only task creator, assignees, or workspace managers can add subtasks');
    }

    const subAssignees = [...new Set((Array.isArray(assignedTo) ? assignedTo : []).map(String))];
    if (workspace) _assertActiveMembers(workspace, subAssignees);

    const subtask = new Task({
        type: 'subtask',
        parentTask: parentTask._id,
        workspace: parentTask.workspace,
        company: parentTask.company,
        project: parentTask.project,
        taskType: parentTask.taskType,
        issueKey: await nextIssueKey(parentTask.workspace, workspace?.name),
        title: String(title).trim(),
        description: description || '',
        createdBy: userId,
        assignedTo: subAssignees,
        status: 'todo',
        priority: TASK_PRIORITIES.includes(priority) ? priority : parentTask.priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags: tags || [],
        visibility: parentTask.visibility,
        channel: parentTask.channel,
        epic: parentTask.type === 'epic' ? parentTask._id : parentTask.epic,
        source: 'manual'
    });
    await subtask.save();

    if (!parentTask.subtasks) parentTask.subtasks = [];
    parentTask.subtasks.push(subtask._id);
    await parentTask.save();

    (async () => {
        const notificationService = require('../../modules/notifications/notificationService');
        const creator = await identity().users.findById(userId);
        const actorUsername = creator?.username || 'Someone';
        const me = String(userId);
        const notifyAssignees = subtask.assignedTo.map(String).filter(id => id !== me);
        await Promise.allSettled(notifyAssignees.map(assigneeId => notificationService.taskAssigned(io, {
            assigneeId, assignerUsername: actorUsername, workspaceId: subtask.workspace, taskTitle: subtask.title, taskId: String(subtask._id),
        })));
        const parentAudience = [...new Set([...parentTask.assignedTo.map(String), String(parentTask.createdBy || '')])]
            .filter(id => id && id !== me && !notifyAssignees.includes(id));
        await notificationService.taskUpdated(io, {
            recipientIds: parentAudience, actorUsername, workspaceId: parentTask.workspace,
            taskTitle: parentTask.title, taskId: String(parentTask._id), summary: `Added subtask "${subtask.title}"`, kind: 'subtask',
        });
    })().catch(err => logger.warn({ err }, '[createSubtask] notification failed'));

    await _logActivity(parentTask._id, userId, 'subtask_added', {
        metadata: { subtaskId: subtask._id, subtaskTitle: subtask.title }
    }, req);
    await _logActivity(subtask._id, userId, 'created', { metadata: { parentTaskId: parentTask._id } }, req);

    const populatedSubtask = await Task.findById(subtask._id)
        .populate('parentTask', 'title')
        .lean();
    if (populatedSubtask) await hydrateTaskUsers([populatedSubtask], ['createdBy', 'assignedTo']);

    if (io) {
        const stakeholders = new Set([
            parentTask.createdBy.toString(),
            ...parentTask.assignedTo.map(id => id.toString()),
            ...subtask.assignedTo.map(id => id.toString())
        ]);
        io.to([...stakeholders].map(id => `user_${id}`)).emit('subtask-created', {
            subtask: populatedSubtask,
            parentTaskId: parentTask._id
        });
    }
    // Parent's subtask list changed.
    await emitToTaskAudience(io, parentTask, "task-updated", await loadTaskForClient(parentTask._id));

    return {
        message: "Subtask created successfully",
        subtask: populatedSubtask
    };
}

async function getTaskActivity(userId, taskId, pagination = {}) {
    if (onPg()) return pg().getTaskActivity(userId, taskId, pagination);
    const { limit = 50, offset = 0 } = pagination;
    await _loadTaskForUser(userId, taskId, { allowDeleted: true });

    const activities = await TaskActivity.find({ task: taskId })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset))
        .lean();
    await hydrateTaskUsers(activities, ['user']);

    const total = await TaskActivity.countDocuments({ task: taskId });

    return {
        activities,
        pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: (parseInt(offset) + parseInt(limit)) < total
        }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Links / watchers / dependencies / timers (all require visibility)
// ─────────────────────────────────────────────────────────────────────────────

async function addLink(userId, taskId, { linkedTaskId, linkType }) {
    if (onPg()) return pg().addLink(userId, taskId, { linkedTaskId, linkType });
    if (!LINK_TYPES.includes(linkType)) throw httpError(400, `Invalid linkType. Must be one of: ${LINK_TYPES.join(', ')}`);
    if (!isObjectId(String(linkedTaskId))) throw httpError(400, 'Invalid linkedTaskId');
    if (String(taskId) === String(linkedTaskId)) throw httpError(400, 'A task cannot be linked to itself');

    const { task } = await _loadTaskForUser(userId, taskId);
    const { task: linked } = await _loadTaskForUser(userId, linkedTaskId);
    if (String(task.workspace) !== String(linked.workspace)) {
        throw httpError(400, 'Linked tasks must be in the same workspace');
    }

    const tid = String(task._id);
    const lid = String(linked._id);
    if (!task.linkedIssues.some(l => l.task.toString() === lid && l.linkType === linkType)) {
        task.linkedIssues.push({ task: linked._id, linkType, createdBy: userId });
        await task.save();
    }

    const inverseType = INVERSE_LINK[linkType] || 'relates_to';
    if (!linked.linkedIssues.some(l => l.task.toString() === tid && l.linkType === inverseType)) {
        linked.linkedIssues.push({ task: task._id, linkType: inverseType, createdBy: userId });
        await linked.save();
    }

    const populated = await Task.findById(task._id)
        .populate('linkedIssues.task', 'title issueKey status priority type')
        .lean();
    return { task: populated };
}

async function removeLink(userId, taskId, linkId) {
    if (onPg()) return pg().removeLink(userId, taskId, linkId);
    const { task } = await _loadTaskForUser(userId, taskId);
    if (!isObjectId(String(linkId))) throw httpError(404, 'Link not found');

    const link = task.linkedIssues.id(linkId);
    if (!link) throw httpError(404, 'Link not found');

    try {
        const other = await Task.findById(link.task);
        if (other) {
            const inverseType = INVERSE_LINK[link.linkType] || 'relates_to';
            other.linkedIssues = other.linkedIssues.filter(
                l => !(l.task.toString() === String(task._id) && l.linkType === inverseType)
            );
            await other.save();
        }
    } catch (err) {
        logger.warn({ err }, '[removeLink] inverse link cleanup failed');
    }

    task.linkedIssues.pull(linkId);
    await task.save();
    return { message: 'Link removed' };
}

async function addWatcher(userId, taskId) {
    if (onPg()) return pg().addWatcher(userId, taskId);
    // Watching requires being able to see the task already.
    const { task } = await _loadTaskForUser(userId, taskId);
    if (!task.watchers.map(id => id.toString()).includes(String(userId))) {
        task.watchers.push(userId);
        await task.save();
    }
    return { watchers: task.watchers };
}

async function removeWatcher(userId, taskId) {
    if (onPg()) return pg().removeWatcher(userId, taskId);
    if (!isObjectId(String(taskId))) throw httpError(404, 'Task not found');
    const task = await Task.findById(taskId);
    if (!task) throw httpError(404, 'Task not found');
    const before = task.watchers.length;
    task.watchers = task.watchers.filter(id => id.toString() !== String(userId));
    if (task.watchers.length !== before) await task.save();
    return { watchers: task.watchers };
}

async function addDependency(userId, taskId, dependencyTaskId) {
    if (onPg()) return pg().addDependency(userId, taskId, dependencyTaskId);
    if (!isObjectId(String(dependencyTaskId))) throw httpError(400, 'Invalid dependencyTaskId');
    if (String(taskId) === String(dependencyTaskId)) throw httpError(400, 'A task cannot depend on itself');

    const { task, isManager } = await _loadTaskForUser(userId, taskId);
    const isAllowed = isManager || task.createdBy.toString() === String(userId) ||
        task.assignedTo.some(id => id.toString() === String(userId));
    if (!isAllowed) throw httpError(403, 'Only the creator, assignees or workspace managers can add dependencies');

    let depTask;
    try {
        ({ task: depTask } = await _loadTaskForUser(userId, dependencyTaskId));
    } catch (err) {
        if (err.statusCode === 404) throw httpError(404, 'Dependency task not found');
        throw err;
    }
    if (String(depTask.workspace) !== String(task.workspace)) {
        throw httpError(400, 'Dependencies must be in the same workspace');
    }

    const depStr = String(depTask._id);
    if (!task.dependencies.map(id => id.toString()).includes(depStr)) {
        task.dependencies.push(depTask._id);
        await task.save();
    }
    return { dependencies: task.dependencies };
}

async function startTimer(userId, taskId) {
    if (onPg()) return pg().startTimer(userId, taskId);
    const { task } = await _loadTaskForUser(userId, taskId);

    const hasOpenSession = task.timeTracking.sessions.some(s => s.start && !s.end);
    if (hasOpenSession) throw httpError(400, 'A timer session is already running. Stop it first.');

    task.timeTracking.sessions.push({ start: new Date(), end: null });
    await task.save();
    return { message: 'Timer started', timeTracking: task.timeTracking };
}

async function stopTimer(userId, taskId) {
    if (onPg()) return pg().stopTimer(userId, taskId);
    const { task } = await _loadTaskForUser(userId, taskId);

    const openSession = task.timeTracking.sessions.slice().reverse().find(s => s.start && !s.end);
    if (!openSession) throw httpError(400, 'No active timer session found');

    const now = new Date();
    openSession.end = now;
    const elapsed = Math.floor((now - new Date(openSession.start)) / 1000);
    task.timeTracking.totalTime = (task.timeTracking.totalTime || 0) + elapsed;

    await task.save();
    return { message: 'Timer stopped', elapsed, timeTracking: task.timeTracking };
}

/** Open tasks per assignee, counting only tasks the caller can see. */
async function getWorkload(userId, workspaceId) {
    if (onPg()) return pg().getWorkload(userId, workspaceId);
    if (!workspaceId || typeof workspaceId !== 'string') throw httpError(400, 'workspaceId required');
    await _validateWorkspaceMember(userId, workspaceId);
    const userChannels = await _getUserChannels(userId, workspaceId);

    const match = _buildVisibilityQuery(userId, workspaceId, userChannels, { includeSubtasks: true });
    match.status = { $nin: ['done', 'cancelled'] };

    const result = await Task.aggregate([
        { $match: match },
        { $unwind: '$assignedTo' },
        { $match: { $expr: { $not: [{ $in: ['$assignedTo', { $ifNull: ['$deletedFor', []] }] }] } } },
        { $group: { _id: '$assignedTo', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    const userIds = result.map(r => String(r._id));
    const users = await identity().users.findManyByIds(userIds);
    const userMap = {};
    users.forEach(u => { userMap[String(u._id)] = { _id: String(u._id), username: u.username, profilePicture: u.profilePicture || null }; });

    const workload = result.map(r => ({
        userId: r._id,
        count: r.count,
        user: userMap[r._id.toString()] || null
    }));

    return { workload };
}

// ─────────────────────────────────────────────────────────────────────────────
// Integrations (GitHub / Jira): external links, activity and status sync
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Apply an update coming from an integration to a workspace task. Runs as a
 * system actor (the integration bot), so the per-user policy checks of
 * updateTask do not apply, but the workflow rules do: a status move happens
 * only when `isValidTransition(current, status)` allows it.
 *
 * @param {string} taskId
 * @param {object} opts
 *   actorId   bot / user id recorded on activity entries
 *   link      optional external link, upserted into task.externalLinks by url
 *   note      optional activity text ("PR #12 opened by octocat")
 *   action    activity action for the note: 'integration_event' (default) | 'ai_note'
 *   status    optional target status
 *   onlyFrom  optional list: move only when the current status is one of these
 * @returns {Promise<{ task: object|null, statusChanged: boolean, from?: string, to?: string }>}
 */
async function applyExternalUpdate(taskId, { actorId, link = null, note = null, action = 'integration_event', status = null, onlyFrom = null } = {}, io = null) {
    if (onPg()) return pg().applyExternalUpdate(taskId, { actorId, link, note, action, status, onlyFrom }, io);
    const task = await Task.findOne({ _id: taskId, deleted: { $ne: true } });
    if (!task) return { task: null, statusChanged: false };

    let dirty = false;
    if (link && link.url) {
        const links = (task.externalLinks || []).map(l => (typeof l.toObject === 'function' ? l.toObject() : { ...l }));
        const i = links.findIndex(l => l.url === link.url);
        const next = { ...(i >= 0 ? links[i] : {}), ...link, updatedAt: new Date() };
        if (i >= 0) links[i] = next; else links.push(next);
        task.externalLinks = links;
        task.markModified('externalLinks');
        dirty = true;
    }

    const from = task.status;
    let statusChanged = false;
    if (status && TASK_STATUSES.includes(status) && status !== from && status !== 'blocked'
        && (!onlyFrom || onlyFrom.includes(from)) && isValidTransition(from, status)) {
        task.previousStatus = from;
        task.status = status;
        if (from === 'blocked') {
            task.blockedBy = null;
            task.blockedAt = null;
            task.blockedReason = null;
        }
        if (status === 'done') {
            task.completedAt = new Date();
            task.completedBy = actorId || null;
        } else if (from === 'done') {
            task.completedAt = null;
            task.completedBy = null;
            task.completionNote = '';
        }
        statusChanged = true;
        dirty = true;
    }

    if (dirty) await task.save();

    const meta = link ? { provider: link.provider, kind: link.kind, url: link.url } : {};
    if (note && actorId) {
        await _logActivity(task._id, actorId, action, { metadata: { ...meta, text: String(note).slice(0, 2000) } });
    }
    if (statusChanged && actorId) {
        await _logActivity(task._id, actorId, 'status_changed', {
            field: 'status', from, to: status, metadata: { ...meta, source: link?.provider || 'integration' }
        });
    }

    if (dirty || note) {
        try {
            const populated = await loadTaskForClient(task._id);
            await emitToTaskAudience(io, task, 'task-updated', populated);
        } catch (err) {
            logger.warn({ err: err.message }, '[tasks] integration update emit failed');
        }
    }
    return { task, statusChanged, from, to: statusChanged ? status : from };
}

module.exports = {
    getTasks,
    getTask,
    createTask,
    updateTask,
    deleteTask,
    getMyTasks,
    restoreTask,
    permanentDeleteTask,
    revokeTask,
    requestTransfer,
    handleTransferRequest,
    createSubtask,
    getTaskActivity,
    addLink,
    removeLink,
    addWatcher,
    removeWatcher,
    addDependency,
    startTimer,
    stopTimer,
    getWorkload,
    applyExternalUpdate,
    // exported for tests
    _buildVisibilityQuery,
    _validateWorkspaceMember,
};
