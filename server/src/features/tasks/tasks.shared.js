/**
 * Helpers shared by the tasks service, the manager task endpoints and
 * message → task conversion. Kept free of messages.service imports so it can
 * be required from anywhere without a cycle.
 */
const mongoose = require('mongoose');
const logger = require('../../../utils/logger');
const Task = require('../../../models/Task');
const IssueKeyCounter = require('./issue-key-counter.model');
const { hydrateTaskUsers } = require('./tasks.hydrate');
const { tasksStore } = require('./tasks.store');

// Workspaces and users live in PostgreSQL (src/identity).
const identity = () => require('../../identity');

const USER_FIELDS = 'username profilePicture';

function httpError(statusCode, message, extra = {}) {
    return Object.assign(new Error(message), { statusCode }, extra);
}

function isObjectId(id) {
    if (id instanceof mongoose.Types.ObjectId) return true;
    return typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);
}

const idOf = (v) => String(v?._id || v);

/** Active (not suspended / removed) member of the workspace. */
function isActiveMember(workspace, userId) {
    if (!workspace || !userId) return false;
    const uid = String(userId);
    return (workspace.members || []).some(m =>
        m && m.user && idOf(m.user) === uid && (!m.status || m.status === 'active'));
}

/** Company stamped on new tasks: the workspace's company, else the creator's. */
function resolveTaskCompany(workspace, user) {
    return workspace?.company || user?.companyId || null;
}

async function nextIssueKey(workspaceId, workspaceName) {
    if (!workspaceId) return null;
    try {
        let name = workspaceName;
        if (!name) {
            const ws = await identity().workspaces.findById(workspaceId);
            name = ws?.name;
        }
        return await IssueKeyCounter.nextKey(workspaceId, name || 'TSK');
    } catch (err) {
        logger.warn('[ISSUE_KEY] Failed to generate key:', err.message);
        return null;
    }
}

/**
 * Who may see a task. Watchers do NOT grant access: a watcher must already be
 * able to see the task when they start watching it.
 */
function canViewTask(task, userId, userChannelIds = []) {
    if (!task || !userId) return false;
    const uid = String(userId);
    if (idOf(task.createdBy) === uid) return true;
    if ((task.assignedTo || []).some(a => idOf(a) === uid)) return true;
    if (task.visibility === 'workspace') return true;
    if (task.visibility === 'channel' && task.channel) {
        const channels = userChannelIds.map(String);
        return channels.includes(idOf(task.channel));
    }
    return false;
}

function stakeholderIds(task) {
    const ids = new Set();
    if (task.createdBy) ids.add(idOf(task.createdBy));
    (task.assignedTo || []).forEach(a => a && ids.add(idOf(a)));
    (task.watchers || []).forEach(w => w && ids.add(idOf(w)));
    return [...ids];
}

/**
 * Emit a task event to every stakeholder (creator, assignees, watchers) plus
 * the room implied by the task's visibility. Socket.io dedupes sockets that
 * are in several of the rooms.
 */
async function emitToTaskAudience(io, task, event, payload, extraUserIds = []) {
    if (!io || !task) return;
    try {
        const users = new Set([...stakeholderIds(task), ...extraUserIds.filter(Boolean).map(String)]);
        const rooms = new Set();
        if (task.visibility === 'workspace' && task.workspace) {
            rooms.add(`workspace_${idOf(task.workspace)}`);
            const members = await identity().workspaces.listMembers(idOf(task.workspace), { status: 'active' });
            (members || []).forEach(m => { if (m?.user) users.add(idOf(m.user)); });
        } else if (task.visibility === 'channel' && task.channel) {
            rooms.add(`channel:${idOf(task.channel)}`);
        }
        users.forEach(id => rooms.add(`user_${id}`));
        io.to([...rooms]).emit(event, payload);
    } catch (err) {
        logger.warn({ err }, `[tasks] emit ${event} failed`);
    }
}

/**
 * Standard population for a MongoDB task query: channel and subtasks (both
 * still MongoDB). User references are attached afterwards with
 * `hydrateTaskUsers` because users live in PostgreSQL.
 */
function populateTask(query) {
    return query
        .populate('channel', 'name')
        .populate('subtasks', 'title status assignedTo deleted');
}

/** Plain object for the client; live parents hide their deleted subtasks. */
function serializeTask(doc) {
    if (!doc) return doc;
    const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
    if (Array.isArray(obj.subtasks)) {
        obj.subtasks = obj.subtasks
            .filter(s => s && typeof s === 'object' && s.title !== undefined && (obj.deleted || !s.deleted))
            .map(s => ({ _id: s._id, title: s.title, status: s.status, assignedTo: s.assignedTo || [] }));
    }
    return obj;
}

/** A task ready for clients and socket payloads, from whichever store holds tasks. */
async function loadTaskForClient(taskId) {
    if (tasksStore() === 'pg') return require('./tasks.service.pg').loadForClient(taskId);
    const doc = await populateTask(Task.findById(taskId)).lean();
    if (!doc) return null;
    await hydrateTaskUsers([doc]);
    return serializeTask(doc);
}

module.exports = {
    USER_FIELDS,
    httpError,
    isObjectId,
    idOf,
    isActiveMember,
    resolveTaskCompany,
    nextIssueKey,
    canViewTask,
    stakeholderIds,
    emitToTaskAudience,
    populateTask,
    hydrateTaskUsers,
    serializeTask,
    loadTaskForClient,
};
