'use strict';

const Message = require('../messages/message.model.js');
const Channel = require('../../features/channels/channel.model.js');
const DMSession = require('../../../models/DMSession');
const identity = require('../../identity');

/**
 * Whether a user may see (and, with forWrite, reply to) the thread under a message.
 * DMs: participants only, and nobody replies while either side has blocked the other.
 * Channels: members; public channels also admit members of the channel's workspace.
 * Returns { ok: true, message } or { ok: false, status, error }.
 */
/**
 * Whether a user may use a conversation (a channel or a DM).
 * DMs: participants only; with forWrite, nobody posts while either side has blocked the other.
 * Channels: members; public channels also admit members of the channel's workspace.
 * Returns { ok: true } or { ok: false, status, error }.
 */
async function checkConversationAccess({ channel, dm }, userId, { forWrite = false } = {}) {
    const uid = String(userId);
    if (dm) {
        const session = await DMSession.findById(dm).select('participants blockedBy').lean();
        if (!session || !(session.participants || []).map(String).includes(uid)) {
            return { ok: false, status: 404, error: 'Conversation not found' };
        }
        if (forWrite && (session.blockedBy || []).length > 0) {
            return { ok: false, status: 403, error: "You can't reply in this conversation." };
        }
        return { ok: true };
    }
    if (channel) {
        const doc = await Channel.findById(channel).select('members isPrivate workspace').lean();
        if (!doc) return { ok: false, status: 404, error: 'Conversation not found' };
        const isMember = (doc.members || []).some((m) => String(m?.user?._id || m?.user || m) === uid);
        if (isMember) return { ok: true };
        if (!doc.isPrivate) {
            const access = doc.workspace ? await identity.workspaces.membership(doc.workspace, uid) : null;
            if (access?.member) return { ok: true };
        }
        return { ok: false, status: 404, error: 'Conversation not found' };
    }
    return { ok: false, status: 404, error: 'Conversation not found' };
}

/** Thread access = access to the conversation the parent message lives in. */
async function checkThreadAccess(messageOrId, userId, options = {}) {
    const message = typeof messageOrId === 'object' && messageOrId?._id
        ? messageOrId
        : await Message.findById(messageOrId).select('dm channel workspace').lean();
    if (!message) return { ok: false, status: 404, error: 'Message not found' };
    const result = await checkConversationAccess({ channel: message.channel, dm: message.dm }, userId, options);
    if (!result.ok) return { ...result, error: result.status === 404 ? 'Message not found' : result.error };
    return { ok: true, message };
}

module.exports = { checkThreadAccess, checkConversationAccess };
