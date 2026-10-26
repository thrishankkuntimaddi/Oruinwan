const Message = require('../messages/message.model.js');
const { emitAboutMessage, messageAudience } = require('../conversations/conversationRooms');

async function followThread(messageId, userId) {
    const updated = await Message.findByIdAndUpdate(
        messageId,
        { $addToSet: { followers: userId } },
        { new: true, select: 'followers' }
    ).lean();

    if (!updated) throw Object.assign(new Error('Thread not found'), { status: 404 });

    return { following: true, followerCount: updated.followers.length };
}

async function unfollowThread(messageId, userId) {
    const updated = await Message.findByIdAndUpdate(
        messageId,
        { $pull: { followers: userId } },
        { new: true, select: 'followers' }
    ).lean();

    if (!updated) throw Object.assign(new Error('Thread not found'), { status: 404 });

    return { following: false, followerCount: updated.followers.length };
}

async function getFollowStatus(messageId, userId) {
    const msg = await Message.findById(messageId).select('followers').lean();
    if (!msg) throw Object.assign(new Error('Thread not found'), { status: 404 });

    const followerStrings = (msg.followers || []).map(String);
    return {
        following: followerStrings.includes(String(userId)),
        followerCount: followerStrings.length,
    };
}

async function getFollowerIds(messageId) {
    const msg = await Message.findById(messageId).select('followers').lean();
    return (msg?.followers || []).map(String);
}

module.exports = { followThread, unfollowThread, getFollowStatus, getFollowerIds };

/** Replies that still count: not deleted for everyone. */
const LIVE_REPLY = { isDeletedUniversally: { $ne: true }, isDeleted: { $ne: true }, type: { $ne: 'system' } };

/**
 * Recount a thread from its live replies and store replyCount / lastReplyAt on the parent.
 * Used after a reply is deleted, so the count and "last reply" never drift.
 */
async function recountThread(parentId) {
    const [count, last] = await Promise.all([
        Message.countDocuments({ parentId, ...LIVE_REPLY }),
        Message.findOne({ parentId, ...LIVE_REPLY }).sort({ createdAt: -1 }).select('createdAt').lean(),
    ]);
    const lastReplyAt = last?.createdAt || null;
    await Message.updateOne({ _id: parentId }, { $set: { replyCount: count, lastReplyAt } });
    return { replyCount: count, lastReplyAt };
}

/** Tell the parent's conversation its thread counters changed. */
function emitThreadCounters(io, parent, { replyCount, lastReplyAt }) {
    if (!io || !parent) return Promise.resolve();
    if (!parent.channel && !parent.dm) return Promise.resolve();
    // Only to people who may see the thread (in a group, not those who joined after the parent).
    return emitAboutMessage(io, parent, 'message-updated', {
        messageId: String(parent._id),
        // Which conversation, so clients that cache per conversation (the phone app) can refresh it.
        channelId: parent.channel ? String(parent.channel._id || parent.channel) : null,
        dmId: parent.dm ? String(parent.dm._id || parent.dm) : null,
        updates: { replyCount, lastReplyAt: lastReplyAt ? new Date(lastReplyAt).toISOString() : null },
    }).catch(() => {});
}

/**
 * Mentions in a thread reply, resolved against the people who can see the conversation
 * (channel members / DM participants), excluding the replier. `mentionText` is the plaintext
 * the client extracted (the reply itself is E2EE).
 *
 *   userIds       @handles
 *   broadcastIds  @channel (every channel member) / @here (members online now), channels only,
 *                 and only when the channel's broadcastMentions policy lets the replier use them
 *                 ('admins' → channel managers only), same rule as top-level messages. Members who
 *                 muted the channel are left out of broadcasts (a direct @handle still reaches them).
 */
async function resolveThreadMentions(parent, replierId, mentionText) {
    const none = { userIds: [], broadcastIds: [] };
    if (!mentionText || typeof mentionText !== 'string') return none;
    const { parseMentionHandles } = require('../../utils/mentionParser');
    const { userHandles, isHere, isChannel } = parseMentionHandles(mentionText.slice(0, 4000));
    if (userHandles.length === 0 && !isHere && !isChannel) return none;

    let audience = [];
    let channelDoc = null;
    if (parent.channel) {
        const Channel = require('../../features/channels/channel.model.js');
        channelDoc = await Channel.findById(parent.channel).select('members mutedBy broadcastMentions admins workspace company').lean();
        audience = (channelDoc?.members || []).map((m) => String(m?.user?._id || m?.user || m));
    } else if (parent.dm) {
        const DMSession = require('../../../models/DMSession');
        const dm = await DMSession.findById(parent.dm).select('participants').lean();
        audience = (dm?.participants || []).map(String);
    }
    audience = [...new Set(audience.filter((id) => id && id !== String(replierId)))];
    if (audience.length === 0) return none;

    let userIds = [];
    if (userHandles.length > 0) {
        const identity = require('../../identity');
        const users = await identity.users.findManyByIds(audience);
        const handles = new Set(userHandles);
        userIds = [...users.values()]
            .filter((u) => handles.has(String(u.username || '').toLowerCase()))
            .map((u) => String(u._id));
    }

    let broadcastIds = [];
    if (channelDoc && (isHere || isChannel)) {
        let allowed = true;
        if (channelDoc.broadcastMentions === 'admins') {
            const { canManageChannel } = require('../../features/channels/channelMute.controller');
            allowed = await canManageChannel(channelDoc, String(replierId));
        }
        if (allowed) {
            const muted = new Set((channelDoc.mutedBy || []).map((m) => String(m?.user || m)));
            let targets = audience.filter((id) => !muted.has(id));
            if (!isChannel) {
                // @here reaches only people who are online right now.
                const { getBulkPresenceAsync } = require('../../features/presence/presence.service');
                const live = await getBulkPresenceAsync(targets);
                targets = targets.filter((id) => live[id] && live[id].status !== 'offline');
            }
            const direct = new Set(userIds);
            broadcastIds = targets.filter((id) => !direct.has(id));
        }
    }
    return { userIds, broadcastIds };
}

/** A filter keeping the people who may see this thread now (conversations/conversationAccess.js). */
async function audienceFilter(parent) {
    const { checkMessageAccess } = require('../conversations/conversationAccess');
    const msg = { _id: parent._id, channel: parent.channel?._id || parent.channel, dm: parent.dm?._id || parent.dm, createdAt: parent.createdAt };
    const cache = new Map();
    return async (ids) => {
        const out = [];
        for (const id of ids || []) {
            const key = String(id);
            if (!cache.has(key)) cache.set(key, (await checkMessageAccess(msg, key)).ok);
            if (cache.get(key)) out.push(key);
        }
        return out;
    };
}

/**
 * Reply-side effects shared by the REST and socket send paths: the replier (and, on the
 * first reply, the parent's author) follow the thread, and every other follower is notified.
 */
async function followAndNotify(io, { parent, replierId, senderUsername, mentionText = '', replyId = null }) {
    const notificationService = require('../notifications/notificationService');
    const Channel = require('../../features/channels/channel.model.js');
    const logger = require('../../../utils/logger');

    let mentionedIds = [];
    let broadcastIds = [];
    try {
        ({ userIds: mentionedIds, broadcastIds } = await resolveThreadMentions(parent, replierId, mentionText));
    } catch (err) {
        logger.warn({ err: err.message }, '[threads] mention resolution failed');
    }

    // @handles follow the thread; @channel/@here only notify (they would make everyone follow).
    const autoFollow = [String(replierId), ...mentionedIds];
    // replyCount is the value before this reply was counted.
    if ((parent.replyCount || 0) === 0 && parent.sender) autoFollow.push(String(parent.sender._id || parent.sender));
    // DMs and group DMs: everyone in the conversation follows its threads from the first reply
    // (and may unfollow afterwards), the way Slack treats DM threads.
    if ((parent.replyCount || 0) === 0 && parent.dm) {
        try {
            const DMSession = require('../../../models/DMSession');
            const dm = await DMSession.findById(parent.dm._id || parent.dm).select('participants').lean();
            (dm?.participants || []).forEach((p) => autoFollow.push(String(p._id || p)));
        } catch (err) {
            logger.warn({ err: err.message }, '[threads] DM participants not auto-followed');
        }
    }
    // Only people who can still see the thread follow it or hear about it (not people who left
    // the conversation or the workspace, nor group members who joined after the parent was posted).
    const canSee = await audienceFilter(parent);
    const followNow = (await canSee([...new Set(autoFollow)])).concat(String(replierId));
    await Message.updateOne({ _id: parent._id }, { $addToSet: { followers: { $each: [...new Set(followNow)] } } });
    // Replying reads the thread for the replier (their own reply is never unread).
    require('./threadControls').markRead(parent._id, replierId).catch(() => {});
    if (replyId && mentionedIds.length > 0) {
        await Message.updateOne({ _id: replyId }, { $set: { mentions: mentionedIds } }).catch(() => {});
    }

    mentionedIds = await canSee(mentionedIds);
    broadcastIds = await canSee(broadcastIds);
    const mentionedSet = new Set([...mentionedIds, ...broadcastIds]);
    // Mentioned people get a mention notification instead of the generic "new reply".
    const recipientIds = await canSee((await getFollowerIds(parent._id))
        .filter((id) => id !== String(replierId) && !mentionedSet.has(id)));
    if (recipientIds.length === 0 && mentionedSet.size === 0) return 0;

    let channelName = null;
    if (parent.channel) {
        try {
            const channelDoc = await Channel.findById(parent.channel).select('name').lean();
            channelName = channelDoc?.name || null;
        } catch (_) { /* the notification still goes out, without the channel name */ }
    }

    const notifyMention = (userId, isEveryone) => notificationService.mention(io, {
        mentionedUserId: userId,
        senderUsername: senderUsername || 'Someone',
        workspaceId: parent.workspace,
        channelName,
        channelId: parent.channel ? String(parent.channel) : null,
        dmSessionId: parent.dm ? String(parent.dm) : null,
        snippet: 'in a thread',
        parentMessageId: String(parent._id),
        ...(isEveryone ? { isEveryone: true } : {}),
    });
    if (mentionedSet.size > 0) {
        await Promise.allSettled([
            ...mentionedIds.map((userId) => notifyMention(userId, false)),
            ...broadcastIds.map((userId) => notifyMention(userId, true)),
        ]);
    }
    if (recipientIds.length === 0) return mentionedSet.size;

    await notificationService.threadReply(io, {
        followerIds: recipientIds,
        senderUsername: senderUsername || 'Someone',
        workspaceId: parent.workspace,
        channelId: parent.channel ? String(parent.channel) : null,
        dmSessionId: parent.dm ? String(parent.dm) : null,
        channelName,
        parentMessageId: String(parent._id),
    });
    return recipientIds.length + mentionedSet.size;
}

module.exports.LIVE_REPLY = LIVE_REPLY;
module.exports.recountThread = recountThread;
module.exports.emitThreadCounters = emitThreadCounters;
module.exports.followAndNotify = followAndNotify;

/**
 * Store an already-encrypted thread reply from `senderId` and broadcast it exactly like
 * POST /messages/thread/:id does (thread:created on the first reply, thread-reply,
 * message-updated), then follow and notify (mentions, @here / @channel, followers).
 * Used by server-side senders such as the assistant's reply_in_thread / create_thread tools.
 * `parent` is the lean parent message (channel/dm, workspace, company, sender, replyCount).
 */
async function postEncryptedReply(io, { parent, senderId, ciphertext, messageIv, mentionText = '' }) {
    const { hydrate, USER_MIN } = require('../../identity/hydrate');
    const logger = require('../../../utils/logger');
    const parentId = parent._id;
    const reply = await Message.create({
        type: 'message',
        sender: senderId,
        payload: { ciphertext, messageIv, isEncrypted: true },
        attachments: [],
        parentId,
        readBy: [senderId],
        workspace: parent.workspace,
        company: parent.company,
        ...(parent.dm ? { dm: parent.dm } : { channel: parent.channel }),
    });
    const replyOut = await hydrate(reply.toObject(), { sender: USER_MIN });
    const lastReplyAt = replyOut.createdAt || new Date();
    const updatedParent = await Message.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 }, $set: { lastReplyAt } }, { new: true })
        .lean().then((doc) => (doc ? hydrate(doc, { sender: USER_MIN }) : doc));

    if (io && updatedParent) {
        // The thread's audience: in a group, not people who joined after its parent was written.
        const target = await messageAudience(io, parent);
        const lastReplyIso = new Date(lastReplyAt).toISOString();
        if (target && updatedParent.replyCount === 1) {
            target.emit('thread:created', {
                parentMessageId: String(parentId), channelId: parent.channel || null, dmId: parent.dm || null,
                replyCount: 1, lastReplyAt: lastReplyIso, parentMessage: updatedParent,
            });
        }
        if (target) target.emit('thread-reply', { parentId: String(parentId), reply: replyOut });
        if (target) target.emit('message-updated', {
            messageId: String(parentId),
            channelId: parent.channel ? String(parent.channel) : null,
            dmId: parent.dm ? String(parent.dm) : null,
            updates: { replyCount: updatedParent.replyCount, lastReplyAt: lastReplyIso },
            fullMessage: updatedParent,
        });
    }

    // Same as the REST path: following and notifications never fail the reply.
    await followAndNotify(io, { parent, replierId: senderId, senderUsername: replyOut.sender?.username, mentionText, replyId: reply._id })
        .catch((err) => logger.error('[THREADS] Follow/notify error (non-fatal):', err.message));
    return replyOut;
}

module.exports.postEncryptedReply = postEncryptedReply;
