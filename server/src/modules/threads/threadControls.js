'use strict';

/**
 * Slack-style thread controls on top of the follower list on the parent message:
 *
 *   moderators   channel admins, the channel's creator and workspace owners/admins (group DMs:
 *                the group's creator). They lock/unlock threads, remove followers and delete
 *                any reply. A thread's starter may lock and unlock their own thread too.
 *   lock         a locked thread takes no new replies (REST and socket both refuse with 403
 *                THREAD_LOCKED); everyone can still read it.
 *   followers    anyone who can see the thread may follow it or add people who can see the
 *                conversation ("X added you to a thread"); a moderator may remove a follower.
 *   read state   opening or replying marks a thread read; replies from others since then are
 *                the person's unread count in the Threads view.
 */

const Message = require('../messages/message.model.js');
const ThreadRead = require('./threadRead.model');
const { checkConversationAccess } = require('./threadAccess');
const { LIVE_REPLY } = require('./threads.service');

// Overridable in tests (no database there).
const env = { dbReady: () => require('mongoose').connection.readyState === 1 };

const sid = (v) => (v == null ? null : String(v._id || v));
const httpError = (status, message, code) => Object.assign(new Error(message), { status, ...(code ? { code } : {}) });

/** Whether userId moderates the conversation the thread lives in. */
async function canModerateThread(parent, userId) {
    const uid = String(userId);
    if (parent.channel) {
        const Channel = require('../../features/channels/channel.model.js');
        const channel = await Channel.findById(sid(parent.channel)).select('admins createdBy workspace').lean();
        if (!channel) return false;
        if (sid(channel.createdBy) === uid) return true;
        const { canManageChannel } = require('../../features/channels/channelMute.controller');
        return canManageChannel(channel, uid);
    }
    if (parent.dm) {
        const DMSession = require('../../../models/DMSession');
        const dm = await DMSession.findById(sid(parent.dm)).select('isGroup createdBy').lean();
        return !!dm?.isGroup && sid(dm.createdBy) === uid;
    }
    return false;
}

/** What the caller may do with a thread: { canModerate, canLock }. */
async function threadPermissions(parent, userId) {
    const canModerate = await canModerateThread(parent, userId);
    const isStarter = sid(parent.sender) === String(userId);
    return { canModerate, canLock: canModerate || isStarter };
}

function lockInfo(parent) {
    if (!parent?.threadLockedAt) return { locked: false, lockedAt: null, lockedBy: null };
    return {
        locked: true,
        lockedAt: parent.threadLockedAt,
        lockedBy: parent.threadLockedBy ? { _id: sid(parent.threadLockedBy), username: parent.threadLockedByName || null } : null,
    };
}

/** null when the thread takes replies, else the error to send (403 THREAD_LOCKED). */
function lockedError(parent) {
    if (!parent?.threadLockedAt) return null;
    const who = parent.threadLockedByName ? ` by ${parent.threadLockedByName}` : '';
    return httpError(403, `This thread was locked${who}. New replies are turned off.`, 'THREAD_LOCKED');
}

function roomOf(parent) {
    if (parent.channel) return `channel:${sid(parent.channel)}`;
    if (parent.dm) return `dm:${sid(parent.dm)}`;
    return null;
}

async function loadParent(messageId) {
    if (!/^[a-f\d]{24}$/i.test(String(messageId))) throw httpError(404, 'Thread not found');
    const parent = await Message.findById(messageId).lean();
    if (!parent) throw httpError(404, 'Thread not found');
    if (parent.parentId) throw httpError(400, 'That message is a reply; open its thread instead');
    return parent;
}

async function assertAccess(parent, userId) {
    const access = await checkConversationAccess({ channel: parent.channel, dm: parent.dm }, userId);
    if (!access.ok) throw httpError(access.status === 404 ? 404 : access.status, 'Thread not found');
}

/** Lock or unlock a thread. Moderators, or the thread's starter. */
async function setLock(messageId, userId, locked, io) {
    const parent = await loadParent(messageId);
    await assertAccess(parent, userId);
    const { canLock } = await threadPermissions(parent, userId);
    if (!canLock) throw httpError(403, 'Only channel admins or the person who started this thread can lock it');

    let update;
    if (locked) {
        const identity = require('../../identity');
        const me = await identity.users.findById(userId).catch(() => null);
        update = { threadLockedAt: new Date(), threadLockedBy: userId, threadLockedByName: me?.username || null };
    } else {
        update = { threadLockedAt: null, threadLockedBy: null, threadLockedByName: null };
    }
    const saved = await Message.findByIdAndUpdate(parent._id, { $set: update }, { new: true }).lean();
    const info = lockInfo(saved);
    const room = roomOf(parent);
    if (io && room) {
        io.to(room).emit('thread:locked', {
            messageId: String(parent._id),
            channelId: parent.channel ? sid(parent.channel) : null,
            dmId: parent.dm ? sid(parent.dm) : null,
            ...info,
        });
    }
    return info;
}

/** Followers with names: [{ _id, username, profilePicture }]. */
async function listFollowers(messageId, userId) {
    const parent = await loadParent(messageId);
    await assertAccess(parent, userId);
    const ids = [...new Set((parent.followers || []).map(sid))];
    const identity = require('../../identity');
    const users = ids.length ? await identity.users.findManyByIds(ids) : new Map();
    const followers = ids.map((id) => {
        const u = users.get ? users.get(id) : null;
        return { _id: id, username: u?.username || null, profilePicture: u?.profilePicture || null };
    });
    const perms = await threadPermissions(parent, userId);
    return { followers, ...perms };
}

/**
 * Add people as followers. They must be able to see the conversation (channel members, or
 * DM participants); people who cannot are reported back in `skipped`. Each newly added
 * person is notified "X added you to a thread".
 */
async function addFollowers(messageId, actorId, userIds, io) {
    const parent = await loadParent(messageId);
    await assertAccess(parent, actorId);
    const wanted = [...new Set((Array.isArray(userIds) ? userIds : []).map(String))]
        .filter((id) => /^[a-f\d]{24}$/i.test(id));
    if (wanted.length === 0) throw httpError(400, 'Choose at least one person to add');
    if (wanted.length > 100) throw httpError(400, 'Add at most 100 people at a time');

    const current = new Set((parent.followers || []).map(sid));
    const added = [];
    const skipped = [];
    for (const id of wanted) {
        if (current.has(id)) continue;
        const access = await checkConversationAccess({ channel: parent.channel, dm: parent.dm }, id);
        if (access.ok) added.push(id); else skipped.push(id);
    }
    if (added.length) {
        await Message.updateOne({ _id: parent._id }, { $addToSet: { followers: { $each: added } } });
        const others = added.filter((id) => id !== String(actorId));
        if (others.length) {
            notifyAdded(io, parent, actorId, others).catch(() => {});
        }
    }
    const followerCount = (await Message.findById(parent._id).select('followers').lean())?.followers?.length || 0;
    return { added, skipped, followerCount };
}

async function notifyAdded(io, parent, actorId, recipientIds) {
    const identity = require('../../identity');
    const notificationService = require('../notifications/notificationService');
    const actor = await identity.users.findById(actorId).catch(() => null);
    let channelName = null;
    if (parent.channel) {
        const Channel = require('../../features/channels/channel.model.js');
        channelName = (await Channel.findById(sid(parent.channel)).select('name').lean())?.name || null;
    }
    await notificationService.threadAdded(io, {
        recipientIds,
        adderUsername: actor?.username || 'Someone',
        workspaceId: parent.workspace,
        channelId: parent.channel ? sid(parent.channel) : null,
        dmSessionId: parent.dm ? sid(parent.dm) : null,
        channelName,
        parentMessageId: String(parent._id),
    });
}

/** Remove a follower: yourself (unfollow), or anyone when you moderate the conversation. */
async function removeFollower(messageId, actorId, targetId) {
    const parent = await loadParent(messageId);
    await assertAccess(parent, actorId);
    if (String(targetId) !== String(actorId)) {
        const { canModerate } = await threadPermissions(parent, actorId);
        if (!canModerate) throw httpError(403, 'Only channel admins can remove someone from a thread');
    }
    const updated = await Message.findByIdAndUpdate(parent._id, { $pull: { followers: targetId } }, { new: true, select: 'followers' }).lean();
    return { removed: String(targetId), followerCount: (updated?.followers || []).length };
}

/** Mark a thread read for one person (opening it, or replying in it). */
async function markRead(threadId, userId, at = new Date()) {
    if (!env.dbReady()) return;
    await ThreadRead.updateOne(
        { user: userId, thread: threadId },
        { $max: { readAt: at } },
        { upsert: true },
    );
}

/** { [threadId]: unread replies from others since the person last read it }. */
async function unreadCounts(userId, threadIds) {
    const ids = [...new Set((threadIds || []).map(String))].slice(0, 200);
    if (ids.length === 0) return {};
    const reads = await ThreadRead.find({ user: userId, thread: { $in: ids } }).select('thread readAt').lean();
    const readAt = new Map(reads.map((r) => [sid(r.thread), r.readAt]));
    const out = {};
    await Promise.all(ids.map(async (id) => {
        const q = { parentId: id, sender: { $ne: userId }, hiddenFor: { $ne: userId }, ...LIVE_REPLY };
        if (readAt.has(id)) q.createdAt = { $gt: readAt.get(id) };
        out[id] = await Message.countDocuments(q);
    }));
    return out;
}

/**
 * Threads the person follows (newest activity first), limited to conversations they can
 * still see, each with `unread`, `following: true` and, for channels, `channelName`.
 */
async function followedThreads(userId, { workspaceId = null, channelId = null, limit = 50 } = {}) {
    const q = { followers: userId, parentId: null, replyCount: { $gt: 0 } };
    if (workspaceId && /^[a-f\d]{24}$/i.test(String(workspaceId))) q.workspace = workspaceId;
    if (channelId && /^[a-f\d]{24}$/i.test(String(channelId))) q.channel = channelId;
    const candidates = await Message.find(q).sort({ lastReplyAt: -1 }).limit(Math.min(Number(limit) || 50, 100) * 2).lean();

    const allowed = new Map();
    const visible = [];
    for (const m of candidates) {
        const key = m.channel ? `c:${sid(m.channel)}` : `d:${sid(m.dm)}`;
        if (!allowed.has(key)) {
            const access = await checkConversationAccess({ channel: m.channel, dm: m.dm }, userId);
            allowed.set(key, access.ok ? { since: access.since } : null);
        }
        const access = allowed.get(key);
        // Not threads from before the person joined the group.
        if (access && (!access.since || new Date(m.createdAt) >= access.since)) visible.push(m);
        if (visible.length >= (Number(limit) || 50)) break;
    }

    const unread = await unreadCounts(userId, visible.map((m) => m._id));
    const channelIds = [...new Set(visible.filter((m) => m.channel).map((m) => sid(m.channel)))];
    const names = new Map();
    if (channelIds.length) {
        const Channel = require('../../features/channels/channel.model.js');
        const docs = await Channel.find({ _id: { $in: channelIds } }).select('name').lean();
        docs.forEach((c) => names.set(sid(c._id), c.name));
    }
    return visible.map((m) => ({
        ...m,
        following: true,
        unread: unread[String(m._id)] || 0,
        channelName: m.channel ? names.get(sid(m.channel)) || null : null,
        ...lockInfo(m),
    }));
}

module.exports = {
    _env: env,
    canModerateThread,
    threadPermissions,
    lockInfo,
    lockedError,
    setLock,
    listFollowers,
    addFollowers,
    removeFollower,
    markRead,
    unreadCounts,
    followedThreads,
};
