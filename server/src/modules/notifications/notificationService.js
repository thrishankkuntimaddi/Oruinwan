const Notification = require('./notification.model');
const Workspace = require('../../../models/Workspace');
const logger = require('../../../utils/logger');
const { isValidId } = require('../../shared/utils/workspaceAccess');

// Human labels for task enums shown in notification texts.
const TASK_STATUS_LABELS = {
    backlog: 'Backlog',
    todo: 'To do',
    in_progress: 'In progress',
    review: 'In review',
    blocked: 'Blocked',
    done: 'Done',
    cancelled: 'Cancelled',
};
const TASK_PRIORITY_LABELS = {
    lowest: 'Lowest',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    highest: 'Highest',
};

function humanize(key) {
    const s = String(key || '').replace(/_/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}
function statusLabel(status) {
    return TASK_STATUS_LABELS[status] || humanize(status);
}
function priorityLabel(priority) {
    return TASK_PRIORITY_LABELS[priority] || humanize(priority);
}

/** Client route for a task inside its workspace. */
function taskLink(workspaceId, taskId) {
    if (!workspaceId) return null;
    const ws = String(workspaceId?._id || workspaceId);
    return taskId ? `/workspace/${ws}/tasks/${taskId}` : `/workspace/${ws}/tasks`;
}

/**
 * Set of user ids that are active members of an active workspace, or null
 * when the id is malformed / the workspace does not exist.
 */
async function activeMemberIds(workspaceIdOrDoc) {
    const workspaceId = workspaceIdOrDoc && workspaceIdOrDoc._id ? workspaceIdOrDoc._id : workspaceIdOrDoc;
    if (!isValidId(workspaceId)) return null;
    const ws = await Workspace.findOne({ _id: workspaceId, isActive: { $ne: false } })
        .select('members.user members.status')
        .lean();
    if (!ws) return null;
    return new Set((ws.members || [])
        .filter(m => (m.status || 'active') === 'active')
        .map(m => String(m.user?._id || m.user)));
}

// Which per-workspace preference toggle governs each notification type.
// Types missing here are always delivered (digest, integration alerts...).
const PREF_KEY_BY_TYPE = {
    mention: 'message',
    dm: 'message',
    reaction: 'message',
    channel_pinned: 'message',
    huddle_started: 'message',
    thread_reply: 'threadReply',
    task_assigned: 'task',
    task_comment: 'task',
    task_status: 'task',
    task_due_soon: 'task',
    task_updated: 'task',
    task_removed: 'task',
    task_transfer: 'task',
    schedule_created: 'meeting',
    meeting_reminder: 'meeting',
};

const getPrefs = () => require('./notificationPreferenceService');
const getPush = () => require('../../features/push/push.service');
const getViewing = () => require('./viewingPresence');

async function loadPrefs(userId, workspaceId) {
    try {
        return await getPrefs().getUserPreferences(userId, workspaceId);
    } catch {
        return null;
    }
}

/** Deliver a socket event to every session of one user. */
function emitToUser(io, userId, event, payload) {
    if (!io || !userId) return;
    io.to(`user:${userId}`).emit(event, payload);
}

/**
 * Persist and deliver one notification. Honours the recipient's workspace
 * preferences (in-app toggle per category, push toggle). Returns null when
 * the recipient opted out or on error, so callers never need to guard.
 */
async function create(io, { recipient, workspaceId, type, title, body = '', link = null, meta = {}, push }, { members } = {}) {
    try {
        if (!recipient || !workspaceId) return null;

        // Workspace notifications only ever go to active members of that workspace.
        const memberSet = members !== undefined ? members : await activeMemberIds(workspaceId);
        if (!memberSet || !memberSet.has(String(recipient))) return null;

        const prefs = await loadPrefs(recipient, workspaceId);
        const prefKey = PREF_KEY_BY_TYPE[type];
        if (prefKey && prefs && prefs[prefKey] === false) return null;

        const notif = await Notification.create({
            recipient,
            workspaceId,
            type,
            title,
            body,
            link,
            meta,
            read: false,
        });

        emitToUser(io, recipient, 'notification:new', { notification: notif.toObject() });

        // Mobile push only when the user isn't actively using the web app: an
        // active tab shows its own in-app alert (or nothing, when on screen).
        if (push !== false && (!prefs || prefs.push !== false) && !getViewing().isActive(recipient)) {
            getPush().sendToUser(String(recipient), title, body || 'Oruinwan', {
                type,
                workspaceId: String(workspaceId),
                link,
                notificationId: String(notif._id),
                ...(meta.channelId && { channelId: String(meta.channelId) }),
                ...(meta.dmSessionId && { dmSessionId: String(meta.dmSessionId) }),
            }).catch(() => {});
        }

        return notif;
    } catch (err) {
        logger.error('[notificationService.create] Error:', err.message);
        return null;
    }
}

async function createMany(io, recipients, payload) {
    const unique = [...new Set((recipients || []).filter(Boolean).map(String))];
    if (!unique.length || !payload?.workspaceId) return [];
    let members;
    try {
        members = await activeMemberIds(payload.workspaceId);
    } catch (err) {
        logger.error('[notificationService.createMany] Error:', err.message);
        return [];
    }
    if (!members) return [];
    const results = await Promise.allSettled(
        unique.map(recipientId => create(io, { ...payload, recipient: recipientId }, { members }))
    );
    return results.filter(r => r.status === 'fulfilled' && r.value).map(r => r.value);
}

async function mention(io, { mentionedUserId, senderUsername, workspaceId, channelName, channelId, dmSessionId, snippet, preview, isEveryone = false }) {
    const where = channelName ? `in #${channelName}` : 'in a direct message';
    return create(io, {
        recipient: mentionedUserId,
        workspaceId,
        type: 'mention',
        title: isEveryone ? `${senderUsername} notified everyone` : `${senderUsername} mentioned you`,
        body: snippet ? `${where} — "${snippet}"` : where,
        link: channelId ? `/channel/${channelId}` : (dmSessionId ? `/dm/${dmSessionId}` : null),
        meta: { senderUsername, channelName, channelId, dmSessionId, preview, isEveryone },
    });
}

async function dmReceived(io, { recipientId, senderId, senderUsername, senderAvatar, workspaceId, dmSessionId, snippet, preview, kind = 'message' }) {
    return create(io, {
        recipient: recipientId,
        workspaceId,
        type: 'dm',
        title: `New message from ${senderUsername}`,
        body: snippet || 'Sent you a message',
        link: dmSessionId ? `/dm/${dmSessionId}` : null,
        meta: { senderId, senderUsername, senderAvatar, dmSessionId, preview, kind },
    });
}

async function reaction(io, { recipientId, reactorUsername, emoji, workspaceId, channelId, dmSessionId }) {
    return create(io, {
        recipient: recipientId,
        workspaceId,
        type: 'reaction',
        title: `${reactorUsername} reacted ${emoji}`,
        body: 'to your message',
        link: channelId ? `/channel/${channelId}` : (dmSessionId ? `/dm/${dmSessionId}` : null),
        meta: { reactorUsername, emoji, channelId, dmSessionId },
        push: false,
    });
}

async function taskAssigned(io, { assigneeId, assignerUsername, workspaceId, taskTitle, taskId }) {
    return create(io, {
        recipient: assigneeId,
        workspaceId,
        type: 'task_assigned',
        title: `${assignerUsername} assigned you a task`,
        body: taskTitle,
        link: taskLink(workspaceId, taskId),
        meta: { assignerUsername, taskTitle, taskId },
    });
}

async function taskComment(io, { recipientId, commenterUsername, workspaceId, taskTitle, taskId }) {
    return create(io, {
        recipient: recipientId,
        workspaceId,
        type: 'task_comment',
        title: `${commenterUsername} commented on a task`,
        body: taskTitle,
        link: taskLink(workspaceId, taskId),
        meta: { commenterUsername, taskTitle, taskId },
    });
}

async function taskStatusChanged(io, { recipientIds, changerUsername, workspaceId, taskTitle, taskId, from, to }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'task_status',
        title: `${changerUsername} moved "${taskTitle}"`,
        body: `${statusLabel(from || 'todo')} → ${statusLabel(to)}`,
        link: taskLink(workspaceId, taskId),
        meta: { changerUsername, taskTitle, taskId, from, to, fromLabel: statusLabel(from || 'todo'), toLabel: statusLabel(to), kind: 'status' },
        push: false,
    });
}

async function taskUpdated(io, { recipientIds, actorUsername, workspaceId, taskTitle, taskId, summary, kind = 'update' }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'task_updated',
        title: `${actorUsername} updated "${taskTitle}"`,
        body: summary || 'Task details changed',
        link: taskLink(workspaceId, taskId),
        meta: { actorUsername, taskTitle, taskId, kind },
        push: false,
    });
}

async function taskRemoved(io, { recipientIds, actorUsername, workspaceId, taskTitle, taskId, reason = 'unassigned' }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'task_removed',
        title: reason === 'deleted' ? `${actorUsername} deleted "${taskTitle}"` : `${actorUsername} unassigned you from "${taskTitle}"`,
        body: reason === 'deleted' ? 'The task was removed' : 'You are no longer assigned to this task',
        link: reason === 'deleted' ? taskLink(workspaceId, null) : taskLink(workspaceId, taskId),
        meta: { actorUsername, taskTitle, taskId, reason },
    });
}

async function taskTransfer(io, { recipientIds, requesterUsername, workspaceId, taskTitle, taskId, toUsername, note }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'task_transfer',
        title: `${requesterUsername} requested a transfer`,
        body: `"${taskTitle}" → ${toUsername}${note ? ` · ${note}` : ''}`,
        link: taskLink(workspaceId, taskId),
        meta: { requesterUsername, toUsername, taskTitle, taskId, note },
    });
}

async function noteShared(io, { recipientIds, sharerUsername, workspaceId, noteTitle, noteId }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'note_shared',
        title: `${sharerUsername} shared a note with you`,
        body: noteTitle,
        link: noteId ? `/notes/${noteId}` : null,
        meta: { sharerUsername, noteTitle, noteId, kind: 'note_shared' },
    });
}

async function aiSuggestion(io, { userId, workspaceId, title, body, link = null, meta = {} }) {
    return create(io, {
        recipient: userId,
        workspaceId,
        type: 'ai_suggestion',
        title,
        body,
        link,
        meta: { ...meta, kind: meta.kind || 'ai' },
        push: false,
    });
}

async function memberJoined(io, { newUserId, newUsername, workspaceId, recipientIds }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'member_joined',
        title: 'New member joined',
        body: `${newUsername} joined the workspace`,
        link: null,
        meta: { newUserId, newUsername },
        push: false,
    });
}

async function channelPinned(io, { recipientIds, workspaceId, channelName, channelId, pinnedBy }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'channel_pinned',
        title: 'Message pinned',
        body: `${pinnedBy} pinned a message in #${channelName}`,
        link: channelId ? `/channel/${channelId}` : null,
        meta: { channelName, channelId, pinnedBy },
        push: false,
    });
}

async function huddleStarted(io, { recipientIds, workspaceId, channelId, dmSessionId, channelName, startedBy }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'huddle_started',
        title: '🎙 Huddle started',
        body: channelName ? `${startedBy} started a huddle in #${channelName}` : `${startedBy} started a huddle`,
        link: channelId ? `/channel/${channelId}` : (dmSessionId ? `/dm/${dmSessionId}` : null),
        meta: { channelId, dmSessionId, channelName, startedBy },
    });
}

async function scheduleCreated(io, { recipientIds, workspaceId, title, scheduledMeetingId }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'schedule_created',
        title: 'Meeting Scheduled',
        body: title,
        link: `/huddles`,
        meta: { scheduledMeetingId, meetingTitle: title },
    });
}

async function threadReply(io, { followerIds, senderUsername, workspaceId, channelId, dmSessionId, channelName, parentMessageId }) {
    if (!followerIds || followerIds.length === 0) return [];
    return createMany(io, followerIds, {
        workspaceId,
        type: 'thread_reply',
        title: `${senderUsername} replied to a thread`,
        body: channelName ? `in #${channelName}` : 'View thread',
        link: channelId ? `/channel/${channelId}` : (dmSessionId ? `/dm/${dmSessionId}` : null),
        meta: { senderUsername, channelId, dmSessionId, channelName, parentMessageId },
    });
}

module.exports = {
    PREF_KEY_BY_TYPE,
    TASK_STATUS_LABELS,
    TASK_PRIORITY_LABELS,
    statusLabel,
    priorityLabel,
    taskLink,
    activeMemberIds,
    emitToUser,
    create,
    createMany,
    mention,
    dmReceived,
    reaction,
    taskAssigned,
    taskComment,
    taskStatusChanged,
    taskUpdated,
    taskRemoved,
    taskTransfer,
    noteShared,
    aiSuggestion,
    memberJoined,
    channelPinned,
    huddleStarted,
    scheduleCreated,
    threadReply,
};
