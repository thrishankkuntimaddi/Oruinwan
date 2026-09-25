'use strict';

/**
 * Side effects the assistant can perform through tools (ai/tools/registry.js).
 *
 * Every action receives `(args, ctx)` where ctx = { userId, workspaceId, req, io }.
 * The user id and workspace always come from the authenticated request, never
 * from the model, and every action checks membership before touching data.
 * Messages are encrypted with the conversation key so they stay E2EE.
 */

const mongoose = require('mongoose');
const logger = require('./logger');
const Channel = require('../src/features/channels/channel.model');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const Note = require('../models/Note');
const Task = require('../models/Task');

const TASK_STATUSES = ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];

const oid = (v) => mongoose.Types.ObjectId.isValid(String(v)) ? new mongoose.Types.ObjectId(String(v)) : null;
const fail = (error) => ({ success: false, error });
const ioFrom = (ctx) => ctx.io || ctx.req?.app?.get?.('io') || null;

async function membership(ctx) {
    if (!ctx.workspaceId) return { error: fail('No current workspace. Ask the user to open a workspace first.') };
    const ws = await Workspace.findById(ctx.workspaceId).select('name members settings').lean();
    if (!ws) return { error: fail('Workspace not found') };
    const me = (ws.members || []).find(m => String(m.user?._id || m.user) === String(ctx.userId) && m.status !== 'removed');
    if (!me) return { error: fail('You are not a member of this workspace') };
    return { ws, me };
}

async function getCurrentWorkspace(_args, ctx) {
    const { ws, me, error } = await membership(ctx);
    if (error) return error;
    return { success: true, workspace: { id: String(ws._id), name: ws.name, role: me.role, memberCount: (ws.members || []).length } };
}

async function getUserChannels(_args, ctx) {
    const { error } = await membership(ctx);
    if (error) return error;
    const channels = await Channel.find({ workspace: ctx.workspaceId, 'members.user': ctx.userId })
        .select('name description isPrivate members').lean();
    return {
        success: true,
        count: channels.length,
        channels: channels.map(c => ({ id: String(c._id), name: c.name, description: c.description || '', isPrivate: !!c.isPrivate, memberCount: c.members?.length || 0 })),
    };
}

async function getWorkspaceMembers(_args, ctx) {
    const { ws, error } = await membership(ctx);
    if (error) return error;
    const ids = (ws.members || []).filter(m => m.status !== 'removed').map(m => m.user?._id || m.user);
    const users = await User.find({ _id: { $in: ids } }).select('username email').lean();
    const roleOf = new Map((ws.members || []).map(m => [String(m.user?._id || m.user), m.role]));
    return {
        success: true,
        members: users.map(u => ({ id: String(u._id), username: u.username, email: u.email, role: roleOf.get(String(u._id)) || 'member', isMe: String(u._id) === String(ctx.userId) })),
    };
}

async function sendMessageToChannel({ channelId, message }, ctx) {
    if (!oid(channelId) || !message?.trim()) return fail('channelId and message are required');
    const { error } = await membership(ctx);
    if (error) return error;
    const channel = await Channel.findOne({ _id: channelId, workspace: ctx.workspaceId }).select('name members company workspace').lean();
    if (!channel) return fail('Channel not found in this workspace');
    if (!(channel.members || []).some(m => String(m.user?._id || m.user || m) === String(ctx.userId))) return fail('You are not a member of this channel');

    const { encryptForConversation } = require('../src/modules/conversations/cryptoUtils');
    const messagesService = require('../src/modules/messages/messages.service');
    let enc;
    try {
        enc = await encryptForConversation(String(channel._id), 'channel', message.trim());
    } catch (err) {
        logger.warn({ err }, '[aiActions] channel encryption unavailable');
        return fail('This channel cannot be encrypted by the assistant yet. Send the message yourself.');
    }
    const saved = await messagesService.createMessage({
        type: 'message',
        company: channel.company,
        workspace: channel.workspace,
        channel: channel._id,
        sender: ctx.userId,
        ciphertext: enc.ciphertext,
        messageIv: enc.messageIv,
        isEncrypted: true,
        mentionText: message.trim(),
    }, ioFrom(ctx));
    return { success: true, channelName: channel.name, messageId: String(saved._id) };
}

async function sendDirectMessage({ userId: recipientId, message }, ctx) {
    if (!oid(recipientId) || !message?.trim()) return fail('userId and message are required');
    if (String(recipientId) === String(ctx.userId)) return fail('Cannot message yourself');
    const { ws, error } = await membership(ctx);
    if (error) return error;
    if (!(ws.members || []).some(m => String(m.user?._id || m.user) === String(recipientId))) return fail('That user is not in this workspace');

    const messagesService = require('../src/modules/messages/messages.service');
    const { encryptForConversation } = require('../src/modules/conversations/cryptoUtils');
    const dm = await messagesService.findOrCreateDMSession(ctx.userId, recipientId, ctx.workspaceId);
    let enc;
    try {
        enc = await encryptForConversation(String(dm._id), 'dm', message.trim());
    } catch (err) {
        logger.warn({ err }, '[aiActions] dm encryption unavailable');
        return fail('This conversation cannot be encrypted by the assistant yet. Send the message yourself.');
    }
    const saved = await messagesService.createMessage({
        type: 'message',
        company: dm.company,
        workspace: dm.workspace,
        dm: dm._id,
        sender: ctx.userId,
        ciphertext: enc.ciphertext,
        messageIv: enc.messageIv,
        isEncrypted: true,
    }, ioFrom(ctx));
    const recipient = await User.findById(recipientId).select('username').lean();
    return { success: true, to: recipient?.username || String(recipientId), dmSessionId: String(dm._id), messageId: String(saved._id) };
}

async function createTaskForUser({ title, description, dueDate, priority, assigneeIds }, ctx) {
    if (!title?.trim()) return fail('Task title is required');
    const { error } = await membership(ctx);
    if (error) return error;
    const tasksService = require('../src/features/tasks/tasks.service');
    const assignees = (Array.isArray(assigneeIds) ? assigneeIds : []).map(String).filter(oid);
    try {
        const created = await tasksService.createTask(ctx.userId, {
            workspaceId: String(ctx.workspaceId),
            title: title.trim().slice(0, 200),
            description: description ? String(description).slice(0, 4000) : '',
            priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
            dueDate: dueDate ? new Date(dueDate) : undefined,
            assignmentType: assignees.length ? 'individual' : 'self',
            assignedToIds: assignees,
            source: 'ai',
        }, ioFrom(ctx), ctx.req || undefined);
        const task = Array.isArray(created?.tasks) ? created.tasks[0] : (created?.task || created);
        return { success: true, taskId: String(task?._id || ''), title: task?.title || title.trim(), priority: task?.priority, dueDate: task?.dueDate || null };
    } catch (err) {
        return fail(err.message || 'Failed to create task');
    }
}

async function listMyTasks({ status, limit = 20 }, ctx) {
    const { error } = await membership(ctx);
    if (error) return error;
    const q = { workspace: ctx.workspaceId, deleted: { $ne: true }, $or: [{ assignedTo: ctx.userId }, { createdBy: ctx.userId }] };
    if (status && TASK_STATUSES.includes(status)) q.status = status;
    const tasks = await Task.find(q).sort({ dueDate: 1, updatedAt: -1 }).limit(Math.min(Number(limit) || 20, 50))
        .select('title status priority dueDate assignedTo').populate('assignedTo', 'username').lean();
    return {
        success: true,
        count: tasks.length,
        tasks: tasks.map(t => ({ id: String(t._id), title: t.title, status: t.status, priority: t.priority, dueDate: t.dueDate || null, assignees: (t.assignedTo || []).map(u => u.username) })),
    };
}

async function updateTaskStatus({ taskId, status }, ctx) {
    if (!oid(taskId) || !TASK_STATUSES.includes(status)) return fail('taskId and a valid status are required');
    const { error } = await membership(ctx);
    if (error) return error;
    const task = await Task.findOne({ _id: taskId, workspace: ctx.workspaceId }).select('_id').lean();
    if (!task) return fail('Task not found in this workspace');
    const tasksService = require('../src/features/tasks/tasks.service');
    try {
        const updated = await tasksService.updateTask(ctx.userId, String(taskId), { status }, ioFrom(ctx), ctx.req || undefined);
        const t = updated?.task || updated;
        return { success: true, taskId: String(taskId), status: t?.status || status };
    } catch (err) {
        return fail(err.message || 'Failed to update task');
    }
}

async function createNote({ title, content }, ctx) {
    if (!title?.trim()) return fail('Note title is required');
    const { ws, error } = await membership(ctx);
    if (error) return error;
    const note = await Note.create({
        workspace: ctx.workspaceId,
        company: ws.company || null,
        owner: ctx.userId,
        title: title.trim().slice(0, 200),
        content: String(content || '').slice(0, 50_000),
        type: 'note',
    });
    return { success: true, noteId: String(note._id), title: note.title };
}

async function listRecentNotes({ limit = 10 }, ctx) {
    const { error } = await membership(ctx);
    if (error) return error;
    const notes = await Note.find({ workspace: ctx.workspaceId, isArchived: { $ne: true }, $or: [{ owner: ctx.userId }, { sharedWith: ctx.userId }, { isPublic: true }] })
        .sort({ updatedAt: -1 }).limit(Math.min(Number(limit) || 10, 30)).select('title updatedAt owner').lean();
    return { success: true, notes: notes.map(n => ({ id: String(n._id), title: n.title, updatedAt: n.updatedAt, mine: String(n.owner) === String(ctx.userId) })) };
}

async function searchWorkspace({ query }, ctx) {
    if (!query?.trim()) return fail('query is required');
    const { error } = await membership(ctx);
    if (error) return error;
    const terms = query.trim().split(/\s+/).slice(0, 6).map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(terms.join('|'), 'i');
    let KnowledgePage = null;
    try { KnowledgePage = require('../src/features/knowledge/KnowledgePage'); } catch { /* optional */ }
    const [pages, notes, tasks] = await Promise.all([
        KnowledgePage ? KnowledgePage.find({ workspaceId: ctx.workspaceId, isDeleted: { $ne: true }, $or: [{ title: regex }, { content: regex }] }).limit(5).select('title content').lean() : [],
        Note.find({ workspace: ctx.workspaceId, isArchived: { $ne: true }, $or: [{ owner: ctx.userId }, { sharedWith: ctx.userId }, { isPublic: true }], $and: [{ $or: [{ title: regex }, { content: regex }] }] }).limit(5).select('title content').lean(),
        Task.find({ workspace: ctx.workspaceId, deleted: { $ne: true }, $or: [{ title: regex }, { description: regex }] }).limit(5).select('title status priority dueDate').lean(),
    ]);
    const snippet = (s) => String(s || '').replace(/\s+/g, ' ').slice(0, 240);
    return {
        success: true,
        results: [
            ...pages.map(p => ({ type: 'knowledge', id: String(p._id), title: p.title, snippet: snippet(p.content) })),
            ...notes.map(n => ({ type: 'note', id: String(n._id), title: n.title, snippet: snippet(n.content) })),
            ...tasks.map(t => ({ type: 'task', id: String(t._id), title: t.title, snippet: `${t.status} · ${t.priority}${t.dueDate ? ` · due ${new Date(t.dueDate).toISOString().slice(0, 10)}` : ''}` })),
        ],
    };
}

async function scheduleMeeting({ title, startsAt, durationMinutes = 30, participantIds = [] }, ctx) {
    if (!title?.trim() || !startsAt) return fail('title and startsAt are required');
    const start = new Date(startsAt);
    if (Number.isNaN(start.getTime())) return fail('startsAt must be an ISO date-time');
    const { ws, error } = await membership(ctx);
    if (error) return error;
    let ScheduledMeeting;
    try { ScheduledMeeting = require('../src/models/ScheduledMeeting'); } catch { return fail('Scheduling is not available'); }
    const memberIds = new Set((ws.members || []).map(m => String(m.user?._id || m.user)));
    const participants = (Array.isArray(participantIds) ? participantIds : []).map(String).filter(id => memberIds.has(id));
    const me = await User.findById(ctx.userId).select('companyId').lean();
    const meeting = await ScheduledMeeting.create({
        companyId: me?.companyId || null,
        workspaceId: ctx.workspaceId,
        createdBy: ctx.userId,
        title: title.trim().slice(0, 200),
        startTime: start,
        duration: Math.max(5, Math.min(Number(durationMinutes) || 30, 480)),
        participants,
        status: 'scheduled',
    });
    const io = ioFrom(ctx);
    if (io) io.to(`workspace:${ctx.workspaceId}`).emit('schedule:created', { meeting });
    try {
        const notificationService = require('../src/features/notifications/notificationService');
        await notificationService.scheduleCreated(io, {
            recipientIds: (participants.length ? participants : [...memberIds]).filter(id => id !== String(ctx.userId)),
            workspaceId: ctx.workspaceId, title: meeting.title, scheduledMeetingId: meeting._id,
        });
    } catch { /* non-fatal */ }
    return { success: true, meetingId: String(meeting._id), title: meeting.title, startTime: meeting.startTime, duration: meeting.duration };
}

module.exports = {
    getCurrentWorkspace,
    getUserChannels,
    getWorkspaceMembers,
    sendMessageToChannel,
    sendDirectMessage,
    createTaskForUser,
    listMyTasks,
    updateTaskStatus,
    createNote,
    listRecentNotes,
    searchWorkspace,
    scheduleMeeting,
};
