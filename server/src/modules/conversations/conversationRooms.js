'use strict';

/**
 * Live (Socket.IO) side of losing access: when someone leaves or is removed from a channel, a
 * group or a workspace, every device of theirs leaves those rooms at once, so no further
 * messages reach them even before they reconnect. Their copy of a channel's key goes too.
 */

const logger = require('../../../utils/logger');

const userRooms = (userId) => [`user:${userId}`, `user_${userId}`];

function leaveRooms(io, userId, rooms) {
    if (!io || !userId || !rooms?.length) return;
    for (const room of userRooms(String(userId))) io.in(room).socketsLeave(rooms);
}

/**
 * A private channel or a group lost someone: a new key for the people still in it, so what is
 * said next can't be opened with a key the person kept. (Public channels don't: anyone in the
 * workspace may join and read them.) Called after they were taken off the member list.
 */
async function rotateWithout(io, conversationId, conversationType, userId) {
    try {
        let members = null;
        if (conversationType === 'channel') {
            const Channel = require('../../features/channels/channel.model.js');
            const ch = await Channel.findById(String(conversationId)).select('isPrivate members').lean();
            if (!ch?.isPrivate) return null;
            members = (ch.members || []).map((m) => String(m?.user?._id || m?.user || m));
        } else {
            const DMSession = require('../../../models/DMSession');
            const dm = await DMSession.findById(String(conversationId)).select('isGroup participants').lean();
            if (!dm?.isGroup) return null;
            members = (dm.participants || []).map(String);
        }
        members = members.filter((m) => m !== String(userId));
        if (!members.length) return null;
        // Only when they held its current key (never had it: nothing to protect against).
        const doc = await require('../../identity/queries/auth').conversationKeyDocs.findByConversation(String(conversationId), conversationType);
        if (!doc || !(doc.encryptedKeys || []).some((e) => String(e.userId) === String(userId))) return null;
        const keyEpochs = require('./keyEpochs');
        const r = await keyEpochs.rotate(conversationId, conversationType, { memberIds: members, keepOld: members });
        if (r.status !== 'ROTATED') return null;
        keyEpochs.announce(io, conversationId, conversationType, r.version);
        return r.version;
    } catch (err) {
        logger.error({ err: err?.message, conversationId: String(conversationId) }, '[rooms] could not give the conversation a new key');
        return null;
    }
}

/** After a channel removal or exit: no live events, no key copies; a private channel gets a new key. */
async function evictFromChannel(io, channelId, userId) {
    leaveRooms(io, userId, [`channel:${channelId}`]);
    await rotateWithout(io, channelId, 'channel', userId);
    try {
        await require('./conversationKeys.service').removeParticipant(String(channelId), 'channel', String(userId));
    } catch (err) {
        logger.warn({ err: err?.message, channelId: String(channelId) }, '[rooms] could not remove the channel key copy');
    }
}

/** After someone leaves or is removed from a workspace: out of all its channels and DMs. */
async function evictFromWorkspace(io, workspaceId, userId, { channelIds = null } = {}) {
    try {
        const Channel = require('../../features/channels/channel.model.js');
        const DMSession = require('../../../models/DMSession');
        const [channels, dms] = await Promise.all([
            channelIds ? Promise.resolve(channelIds.map((id) => ({ _id: id }))) : Channel.find({ workspace: workspaceId }).select('_id').lean(),
            DMSession.find({ workspace: workspaceId, participants: userId }).select('_id isGroup').lean(),
        ]);
        leaveRooms(io, userId, [
            ...channels.map((c) => `channel:${c._id}`),
            ...dms.map((d) => `dm:${d._id}`),
            `workspace:${workspaceId}`,
            `workspace_${workspaceId}`,
        ]);
        const keys = require('./conversationKeys.service');
        // Private channels and groups they were in get a new key first (it checks they held one).
        for (const c of channels) await rotateWithout(io, c._id, 'channel', userId);
        await Promise.allSettled(channels.map((c) => keys.removeParticipant(String(c._id), 'channel', String(userId))));
        for (const d of dms.filter((x) => x.isGroup)) {
            await rotateWithout(io, d._id, 'dm', userId);
            await keys.removeParticipant(String(d._id), 'dm', String(userId)).catch(() => {});
        }
    } catch (err) {
        logger.warn({ err: err?.message, workspaceId: String(workspaceId) }, '[rooms] could not evict from workspace');
    }
}

/**
 * Where a live event about a message goes. Channels and 1:1 DMs: the conversation's room. A group
 * where someone joined after the message was written (for a thread reply: after its parent was
 * written) must not tell them about it, so the event goes only to the members who may see it,
 * each through their own room. `anchor` is the message whose date decides (the thread's parent).
 * Returns a Socket.IO target, or null when nobody may receive it.
 */
async function messageAudience(io, message, { anchor = null } = {}) {
    if (!io || !message) return null;
    const channel = message.channel?._id || message.channel;
    const dm = message.dm?._id || message.dm;
    if (channel) return io.to(`channel:${channel}`);
    if (!dm) return null;
    const room = `dm:${dm}`;
    let session = null;
    try {
        const DMSession = require('../../../models/DMSession');
        session = await DMSession.findById(String(dm)).select('isGroup participants memberSince').lean();
    } catch (err) {
        logger.warn({ err: err?.message }, '[rooms] could not load the group for an event');
    }
    if (!session) return null;
    if (!session.isGroup) return io.to(room);
    const { messageTime } = require('./conversationAccess');
    const at = messageTime(anchor || message);
    const joinedAfter = new Set((session.memberSince || [])
        .filter((m) => m?.at && at && new Date(m.at).getTime() > at.getTime() + 999)
        .map((m) => String(m.user?._id || m.user)));
    if (!joinedAfter.size) return io.to(room);
    const allowed = (session.participants || []).map(String).filter((id) => !joinedAfter.has(id));
    if (!allowed.length) return null;
    return io.to(allowed.flatMap(userRooms));
}

/** Emits `event` about `message` to whoever may see it (see messageAudience). */
async function emitAboutMessage(io, message, event, payload, opts) {
    const target = await messageAudience(io, message, opts);
    if (target) target.emit(event, payload);
}

module.exports = { leaveRooms, evictFromChannel, evictFromWorkspace, rotateWithout, messageAudience, emitAboutMessage };
