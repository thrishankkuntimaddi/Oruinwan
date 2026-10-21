const Message = require('../messages/message.model.js');

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
    if (!io || !parent) return;
    const room = parent.channel ? `channel:${parent.channel._id || parent.channel}` : parent.dm ? `dm:${parent.dm._id || parent.dm}` : null;
    if (!room) return;
    io.to(room).emit('message-updated', {
        messageId: String(parent._id),
        // Which conversation, so clients that cache per conversation (the phone app) can refresh it.
        channelId: parent.channel ? String(parent.channel._id || parent.channel) : null,
        dmId: parent.dm ? String(parent.dm._id || parent.dm) : null,
        updates: { replyCount, lastReplyAt: lastReplyAt ? new Date(lastReplyAt).toISOString() : null },
    });
}

/**
 * Reply-side effects shared by the REST and socket send paths: the replier (and, on the
 * first reply, the parent's author) follow the thread, and every other follower is notified.
 */
/**
 * @handles in a thread reply, resolved against the people who can see the
 * conversation (channel members / DM participants), excluding the replier.
 * `mentionText` is the plaintext the client extracted (the reply itself is E2EE).
 */
async function resolveThreadMentions(parent, replierId, mentionText) {
    if (!mentionText || typeof mentionText !== 'string') return [];
    const { parseMentionHandles } = require('../../utils/mentionParser');
    const { userHandles } = parseMentionHandles(mentionText.slice(0, 4000));
    if (userHandles.length === 0) return [];

    let audience = [];
    if (parent.channel) {
        const Channel = require('../../features/channels/channel.model.js');
        const ch = await Channel.findById(parent.channel).select('members').lean();
        audience = (ch?.members || []).map((m) => String(m?.user?._id || m?.user || m));
    } else if (parent.dm) {
        const DMSession = require('../../../models/DMSession');
        const dm = await DMSession.findById(parent.dm).select('participants').lean();
        audience = (dm?.participants || []).map(String);
    }
    audience = audience.filter((id) => id && id !== String(replierId));
    if (audience.length === 0) return [];

    const identity = require('../../identity');
    const users = await identity.users.findManyByIds(audience);
    const handles = new Set(userHandles);
    return [...users.values()]
        .filter((u) => handles.has(String(u.username || '').toLowerCase()))
        .map((u) => String(u._id));
}

async function followAndNotify(io, { parent, replierId, senderUsername, mentionText = '', replyId = null }) {
    const notificationService = require('../notifications/notificationService');
    const Channel = require('../../features/channels/channel.model.js');
    const logger = require('../../../utils/logger');

    let mentionedIds = [];
    try {
        mentionedIds = await resolveThreadMentions(parent, replierId, mentionText);
    } catch (err) {
        logger.warn({ err: err.message }, '[threads] mention resolution failed');
    }

    const autoFollow = [String(replierId), ...mentionedIds];
    // replyCount is the value before this reply was counted.
    if ((parent.replyCount || 0) === 0 && parent.sender) autoFollow.push(String(parent.sender._id || parent.sender));
    await Message.updateOne({ _id: parent._id }, { $addToSet: { followers: { $each: autoFollow } } });
    if (replyId && mentionedIds.length > 0) {
        await Message.updateOne({ _id: replyId }, { $set: { mentions: mentionedIds } }).catch(() => {});
    }

    const mentionedSet = new Set(mentionedIds);
    // Mentioned people get a mention notification instead of the generic "new reply".
    const recipientIds = (await getFollowerIds(parent._id))
        .filter((id) => id !== String(replierId) && !mentionedSet.has(id));
    if (recipientIds.length === 0 && mentionedIds.length === 0) return 0;

    let channelName = null;
    if (parent.channel) {
        try {
            const channelDoc = await Channel.findById(parent.channel).select('name').lean();
            channelName = channelDoc?.name || null;
        } catch (_) { /* the notification still goes out, without the channel name */ }
    }

    if (mentionedIds.length > 0) {
        await Promise.allSettled(mentionedIds.map((userId) => notificationService.mention(io, {
            mentionedUserId: userId,
            senderUsername: senderUsername || 'Someone',
            workspaceId: parent.workspace,
            channelName,
            channelId: parent.channel ? String(parent.channel) : null,
            dmSessionId: parent.dm ? String(parent.dm) : null,
            snippet: 'in a thread',
        })));
    }
    if (recipientIds.length === 0) return mentionedIds.length;

    await notificationService.threadReply(io, {
        followerIds: recipientIds,
        senderUsername: senderUsername || 'Someone',
        workspaceId: parent.workspace,
        channelId: parent.channel ? String(parent.channel) : null,
        dmSessionId: parent.dm ? String(parent.dm) : null,
        channelName,
        parentMessageId: String(parent._id),
    });
    return recipientIds.length + mentionedIds.length;
}

module.exports.LIVE_REPLY = LIVE_REPLY;
module.exports.recountThread = recountThread;
module.exports.emitThreadCounters = emitThreadCounters;
module.exports.followAndNotify = followAndNotify;
