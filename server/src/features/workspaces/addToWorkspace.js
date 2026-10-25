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
    // A removed or suspended person is added back (active); an active member keeps their role.
    const isMember = (workspace.members || []).some((m) => String(m.user?._id || m.user) === uid && (m.status || 'active') === 'active');
    if (!isMember) await identity.workspaces.addMember(workspace._id, uid, { role: role === 'admin' ? 'admin' : 'member' });

    await joinDefaultChannels(await Channel.find({ workspace: workspace._id, isDefault: true }), uid);
    return true;
}

/** Put `uid` into each channel they're not in yet and share the channel key where it can be. */
async function joinDefaultChannels(channels, uid) {
    let joined = 0;
    for (const channel of channels) {
        const inChannel = (channel.members || []).some((m) => String(m.user || m) === uid);
        if (!inChannel) {
            channel.members.push({ user: uid, joinedAt: new Date() });
            await channel.save();
            joined += 1;
        }
        try {
            const keys = require('../../modules/conversations/conversationKeys.service');
            if (await keys.hasConversationKeys(channel._id, 'channel')) await keys.distributeKeyToNewMember(channel._id, 'channel', uid);
        } catch (err) {
            logger.warn({ err: err.message, channel: String(channel._id) }, '[Workspace] key share deferred until first unlock');
        }
    }
    return joined;
}

/**
 * The default channels an active workspace member is missing (they were added by a path that
 * skipped them), joined now. Cheap when there's nothing to do: one indexed query.
 */
async function joinMissingDefaultChannels(workspaceId, userId) {
    if (!workspaceId || !userId) return 0;
    const uid = String(userId);
    const missing = await Channel.find({
        workspace: workspaceId, isDefault: true, isArchived: { $ne: true },
        'members.user': { $ne: uid },
    });
    return missing.length ? joinDefaultChannels(missing, uid) : 0;
}

module.exports = { addUserToWorkspace, joinMissingDefaultChannels };
