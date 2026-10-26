'use strict';

/**
 * Who may read and write in a conversation: the one rule every path uses (REST messages,
 * threads, reactions, pins, Socket.IO rooms and sends, AI, task discussions).
 *
 * Everyone must be an active member of the conversation's workspace. Then:
 *   - DM or group: a participant. A group member only sees messages from when they joined
 *     (`memberSince`); `since` carries that date. Nobody posts while either side of a DM blocked
 *     the other (codes YOU_BLOCKED / BLOCKED).
 *   - Channel: a member. Public channels can also be read by the workspace's members, and they
 *     may reply in threads there; starting a message at the top level needs membership
 *     (`topLevel`). Channel members read the whole history.
 *
 * Results: { ok: true, type, conversation, workspaceId, isMember, since, hideBefore }
 *       or { ok: false, status, error, code }.
 * `since`      — earliest message this person may see (group join date), or null.
 * `hideBefore` — `since` or their "Clear chat" time, whichever is later: for history lists.
 */

const Channel = require('../../features/channels/channel.model.js');
const DMSession = require('../../../models/DMSession');
const identity = require('../../identity');

const sid = (v) => (v == null ? null : String(v._id || v));
const memberIdOf = (m) => sid(m && typeof m === 'object' && 'user' in m ? m.user : m);

function deny(status, error, code) {
    return { ok: false, status, error, ...(code ? { code } : {}) };
}

function latest(...dates) {
    const valid = dates.filter(Boolean).map((d) => new Date(d)).filter((d) => !Number.isNaN(d.getTime()));
    if (!valid.length) return null;
    return valid.reduce((a, b) => (b > a ? b : a));
}

/** Whether userId is an active member of the workspace. */
async function isActiveWorkspaceMember(workspaceId, userId) {
    if (!workspaceId || !userId) return false;
    const ws = await identity.workspaces.findById(sid(workspaceId), { activeOnly: true });
    if (!ws || ws.isArchived || ws.isActive === false) return false;
    return (ws.members || []).some((m) => memberIdOf(m) === String(userId) && (m.status || 'active') === 'active');
}

/** When this person joined the group (null for 1:1 DMs and founding members of old groups). */
function groupJoinedAt(session, userId) {
    if (!session?.isGroup) return null;
    const row = (session.memberSince || []).find((m) => sid(m.user) === String(userId));
    return row?.at || null;
}

function clearedAtFor(session, userId) {
    const row = (session.clearedAt || []).find((c) => sid(c.user) === String(userId));
    return row?.clearedAt || null;
}

async function checkDM(dmId, uid, { forWrite }) {
    const session = await DMSession.findById(sid(dmId))
        .select('participants blockedBy workspace company isGroup memberSince clearedAt createdBy name')
        .lean();
    if (!session || !(session.participants || []).some((p) => sid(p) === uid)) {
        return deny(404, 'Conversation not found');
    }
    if (!(await isActiveWorkspaceMember(session.workspace, uid))) {
        return deny(403, 'You are no longer a member of this workspace', 'WORKSPACE_ACCESS_DENIED');
    }
    if (forWrite && (session.blockedBy || []).length > 0) {
        const mine = session.blockedBy.some((b) => sid(b.user) === uid);
        return mine
            ? deny(403, 'You blocked this person. Unblock them to send messages.', 'YOU_BLOCKED')
            : deny(403, "You can't send messages in this conversation.", 'BLOCKED');
    }
    const since = groupJoinedAt(session, uid);
    return {
        ok: true,
        type: 'dm',
        conversation: session,
        workspaceId: sid(session.workspace),
        isMember: true,
        since: since ? new Date(since) : null,
        hideBefore: latest(since, clearedAtFor(session, uid)),
    };
}

async function checkChannel(channelId, uid, { forWrite, topLevel }) {
    const channel = await Channel.findById(sid(channelId))
        .select('members isPrivate isDefault workspace company postingPolicy admins createdBy name')
        .lean();
    if (!channel) return deny(404, 'Conversation not found');
    // Outsiders learn nothing about the channel, not even that it exists.
    if (!(await isActiveWorkspaceMember(channel.workspace, uid))) return deny(404, 'Conversation not found');

    const isMember = (channel.members || []).some((m) => memberIdOf(m) === uid);
    if (!isMember) {
        if (channel.isPrivate) return deny(404, 'Conversation not found');
        if (forWrite && topLevel) return deny(403, 'Join the channel to post in it', 'NOT_A_CHANNEL_MEMBER');
    }
    return {
        ok: true,
        type: 'channel',
        conversation: channel,
        workspaceId: sid(channel.workspace),
        isMember,
        since: null,
        hideBefore: null,
    };
}

/**
 * Whether userId may use a conversation.
 * Options: forWrite (posting, reacting), topLevel (a new channel message, not a thread reply).
 */
async function checkConversationAccess({ channel, dm } = {}, userId, { forWrite = false, topLevel = false } = {}) {
    if (!userId) return deny(401, 'Sign in first');
    const uid = String(userId);
    if (dm) return checkDM(dm, uid, { forWrite });
    if (channel) return checkChannel(channel, uid, { forWrite, topLevel });
    return deny(404, 'Conversation not found');
}

/** When a message was written: createdAt, or the time inside its ObjectId when not loaded. */
function messageTime(message) {
    if (message?.createdAt) return new Date(message.createdAt);
    const id = message?._id;
    if (id && typeof id.getTimestamp === 'function') return id.getTimestamp();
    if (id && /^[0-9a-f]{24}$/i.test(String(id))) return new Date(parseInt(String(id).slice(0, 8), 16) * 1000);
    return null;
}

/** A message is visible when its conversation is, and it isn't older than the person's join date. */
async function checkMessageAccess(message, userId, options = {}) {
    if (!message) return deny(404, 'Message not found');
    const access = await checkConversationAccess({ channel: message.channel, dm: message.dm }, userId, options);
    if (!access.ok) return access.status === 404 ? deny(404, 'Message not found') : access;
    const at = messageTime(message);
    // ObjectId times have one-second precision: allow that second.
    if (access.since && at && at.getTime() + 999 < access.since.getTime()) {
        return deny(404, 'Message not found');
    }
    return { ...access, message };
}

/** Mongo filter for a history query: nothing before the person may see it. */
function historyFilter(access) {
    return access?.hideBefore ? { createdAt: { $gte: access.hideBefore } } : {};
}

module.exports = {
    checkConversationAccess,
    checkMessageAccess,
    isActiveWorkspaceMember,
    groupJoinedAt,
    historyFilter,
    latest,
    messageTime,
};
