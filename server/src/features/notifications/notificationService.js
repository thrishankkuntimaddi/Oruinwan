/**
 * notificationService.js
 *
 * Central helper for creating and push-delivering notifications.
 * Usage: await notificationService.create(io, { recipient, workspaceId, type, title, body, link, meta })
 *
 * Also exposes helper methods for common notification patterns:
 *   - mention(io, { mentionedUserId, senderUsername, workspaceId, channelName, channelId, snippet })
 *   - dmReceived(io, { recipientId, senderUsername, workspaceId, dmSessionId, snippet })
 *   - taskAssigned(io, { assigneeId, assignerUsername, workspaceId, taskTitle, taskId })
 *   - taskComment(io, { recipientId, commenterUsername, workspaceId, taskTitle, taskId })
 *   - memberJoined(io, { newUserId, newUsername, workspaceId, recipientIds })
 *   - channelPinned(io, { recipientIds, workspaceId, channelName, channelId, pinnedBy })
 *   - huddleStarted(io, { recipientIds, workspaceId, channelId, channelName, startedBy })
 *   - scheduleCreated(io, { recipientIds, workspaceId, title, scheduledMeetingId })
 */

const Notification = require('../../models/Notification');
const logger = require('../../../utils/logger');

/**
 * Core create function. Saves to DB and emits via socket.
 */
async function create(io, { recipient, workspaceId, type, title, body = '', link = null, meta = {} }) {
    try {
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

        // Push to user's personal room
        if (io) {
            io.to(`user:${recipient}`).emit('notification:new', {
                notification: notif.toObject(),
            });
        }

        return notif;
    } catch (err) {
        logger.error('[notificationService.create] Error:', err.message);
        return null;
    }
}

/**
 * Create notifications for multiple recipients at once.
 */
async function createMany(io, recipients, payload) {
    const results = await Promise.allSettled(
        recipients.map(recipientId => create(io, { ...payload, recipient: recipientId }))
    );
    return results.filter(r => r.status === 'fulfilled').map(r => r.value);
}

// ── Typed helpers ──────────────────────────────────────────────────────────

async function mention(io, { mentionedUserId, senderUsername, workspaceId, channelName, channelId, snippet }) {
    return create(io, {
        recipient: mentionedUserId,
        workspaceId,
        type: 'mention',
        title: `${senderUsername} mentioned you`,
        body: `in #${channelName} — "${snippet}"`,
        link: channelId ? `/channel/${channelId}` : null,
        meta: { senderUsername, channelName, channelId },
    });
}

async function dmReceived(io, { recipientId, senderUsername, workspaceId, dmSessionId, snippet }) {
    return create(io, {
        recipient: recipientId,
        workspaceId,
        type: 'dm',
        title: `New message from ${senderUsername}`,
        body: snippet ? `"${snippet}"` : 'Sent you a message',
        link: dmSessionId ? `/dm/${dmSessionId}` : null,
        meta: { senderUsername, dmSessionId },
    });
}

async function taskAssigned(io, { assigneeId, assignerUsername, workspaceId, taskTitle, taskId }) {
    return create(io, {
        recipient: assigneeId,
        workspaceId,
        type: 'task_assigned',
        title: `${assignerUsername} assigned you a task`,
        body: taskTitle,
        link: taskId ? `/tasks/${taskId}` : null,
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
        link: taskId ? `/tasks/${taskId}` : null,
        meta: { commenterUsername, taskTitle, taskId },
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
    });
}

async function huddleStarted(io, { recipientIds, workspaceId, channelId, channelName, startedBy }) {
    return createMany(io, recipientIds, {
        workspaceId,
        type: 'huddle_started',
        title: '🎙 Huddle started',
        body: `${startedBy} started a huddle in #${channelName}`,
        link: channelId ? `/channel/${channelId}` : null,
        meta: { channelId, channelName, startedBy },
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

/**
 * Notify all thread followers (except the sender) when a new reply is posted.
 *
 * @param {object} io
 * @param {{ followerIds: string[], senderUsername: string, workspaceId: string, channelId: string|null, channelName: string, parentMessageId: string }} opts
 */
async function threadReply(io, { followerIds, senderUsername, workspaceId, channelId, channelName, parentMessageId }) {
    if (!followerIds || followerIds.length === 0) return;
    return createMany(io, followerIds, {
        workspaceId,
        type: 'thread_reply',
        title: `${senderUsername} replied to a thread`,
        body: channelName ? `in #${channelName}` : 'View thread',
        link: channelId ? `/channel/${channelId}` : null,
        meta: { senderUsername, channelId, channelName, parentMessageId },
    });
}

module.exports = {
    create,
    createMany,
    mention,
    dmReceived,
    taskAssigned,
    taskComment,
    memberJoined,
    channelPinned,
    huddleStarted,
    scheduleCreated,
    threadReply,
};
