'use strict';

/**
 * Put a user into a workspace the way joining by invite does: workspace membership, the
 * workspace's default channels, and the channel keys where they can be shared now (the
 * rest are granted when the person first unlocks encryption). Safe to call twice.
 */
const identity = require('../../identity');
const Channel = require('../channels/channel.model');
const logger = require('../../../utils/logger');

async function addUserToWorkspace(workspaceId, userId, { role = 'member' } = {}) {
    if (!workspaceId || !userId) return false;
    const workspace = await identity.workspaces.findById(workspaceId);
    if (!workspace) return false;
    const uid = String(userId);
    const isMember = (workspace.members || []).some((m) => String(m.user?._id || m.user) === uid);
    if (!isMember) await identity.workspaces.addMember(workspace._id, uid, { role: role === 'admin' ? 'admin' : 'member' });

    const channels = await Channel.find({ workspace: workspace._id, isDefault: true });
    for (const channel of channels) {
        const inChannel = (channel.members || []).some((m) => String(m.user || m) === uid);
        if (!inChannel) {
            channel.members.push({ user: uid, joinedAt: new Date() });
            await channel.save();
        }
        try {
            const keys = require('../../modules/conversations/conversationKeys.service');
            if (await keys.hasConversationKeys(channel._id, 'channel')) await keys.distributeKeyToNewMember(channel._id, 'channel', uid);
        } catch (err) {
            logger.warn({ err: err.message, channel: String(channel._id) }, '[Workspace] key share deferred until first unlock');
        }
    }
    return true;
}

module.exports = { addUserToWorkspace };
