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

/** After a channel removal or exit: no live events, no key copy. */
async function evictFromChannel(io, channelId, userId) {
    leaveRooms(io, userId, [`channel:${channelId}`]);
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
            DMSession.find({ workspace: workspaceId, participants: userId }).select('_id').lean(),
        ]);
        leaveRooms(io, userId, [
            ...channels.map((c) => `channel:${c._id}`),
            ...dms.map((d) => `dm:${d._id}`),
            `workspace:${workspaceId}`,
            `workspace_${workspaceId}`,
        ]);
        const keys = require('./conversationKeys.service');
        await Promise.allSettled(channels.map((c) => keys.removeParticipant(String(c._id), 'channel', String(userId))));
    } catch (err) {
        logger.warn({ err: err?.message, workspaceId: String(workspaceId) }, '[rooms] could not evict from workspace');
    }
}

module.exports = { leaveRooms, evictFromChannel, evictFromWorkspace };
