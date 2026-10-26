'use strict';

/**
 * The checks for sending a message, shared by REST (POST /v2/messages/channel and /direct) and
 * Socket.IO (send-message), so both enforce the same rules:
 *
 *   - the conversation: workspace member, channel member (top level) or DM participant
 *     (conversations/conversationAccess.js); no sending in a blocked DM;
 *   - announcement channels: only channel admins (and workspace owners/admins) start messages;
 *   - a thread reply's parent is a top-level message of the same conversation that the sender
 *     can see, the thread isn't locked and threads are on in the workspace;
 *   - a quoted message is in the same conversation and visible to the sender;
 *   - attachments are files the sender uploaded (attachmentSanitizer).
 *
 * Errors carry `status` and, where the apps act on it, `code`.
 */

const mongoose = require('mongoose');
const Message = require('./message.model');
const DMSession = require('../../../models/DMSession');
const { checkConversationAccess } = require('../conversations/conversationAccess');
const { sanitizeAttachments } = require('../uploads/attachmentSanitizer');

const sid = (v) => (v == null ? null : String(v._id || v));

function fail(status, message, code) {
    return Object.assign(new Error(message), { status, statusCode: status, ...(code ? { code } : {}) });
}

function assertId(value, what) {
    if (!mongoose.isValidObjectId(String(value))) throw fail(400, `Invalid ${what}`, 'INVALID_ID');
}

function denied(access) {
    return fail(access.status, access.error, access.code);
}

async function checkPostingPolicy(channel, senderId) {
    if (channel.postingPolicy !== 'admins') return;
    const { canManageChannel } = require('../../features/channels/channelMute.controller');
    if (!(await canManageChannel(channel, senderId))) {
        throw fail(403, 'Only channel admins can post in this channel.', 'POSTING_RESTRICTED');
    }
}

function sameConversation(msg, target) {
    return target.channel ? sid(msg.channel) === sid(target.channel) : sid(msg.dm) === sid(target.dm);
}

function visibleTo(msg, access) {
    return !access.since || !msg.createdAt || new Date(msg.createdAt) >= access.since;
}

async function checkParent(parentId, target, access) {
    assertId(parentId, 'parent message');
    const parent = await Message.findById(parentId)
        .select('channel dm parentId sender workspace company createdAt threadLockedAt threadLockedByName replyCount')
        .lean();
    if (!parent || !sameConversation(parent, target) || !visibleTo(parent, access)) {
        throw fail(404, 'Parent message not found in this conversation', 'INVALID_PARENT');
    }
    if (parent.parentId) throw fail(400, 'Reply in the original thread instead', 'INVALID_PARENT');
    const locked = require('../threads/threadControls').lockedError(parent);
    if (locked) throw fail(403, locked.message, locked.code);
    if (target.workspace) {
        const { isFeatureEnabled } = require('../../shared/workspaceFeatures');
        if (!(await isFeatureEnabled(target.workspace, 'threads'))) {
            throw fail(403, 'Threads are turned off in this workspace.', 'FEATURE_DISABLED');
        }
    }
    return parent;
}

async function checkQuote(quotedMessageId, target, access) {
    assertId(quotedMessageId, 'quoted message');
    const quoted = await Message.findById(quotedMessageId).select('channel dm createdAt').lean();
    if (!quoted || !sameConversation(quoted, target) || !visibleTo(quoted, access)) {
        throw fail(404, 'Quoted message not found in this conversation', 'INVALID_QUOTE');
    }
}

/**
 * Where the message goes and whether the sender may put it there.
 * Target: { channelId } | { dmSessionId } | { receiverId, workspaceId } (a 1:1 DM, made when missing).
 * Returns { target: { channel, dm, workspace, company, participants }, parent, attachments, access, newDM }.
 */
async function prepareSend(senderId, input = {}, io = null) {
    const uid = String(senderId);
    const { channelId, dmSessionId, receiverId, workspaceId, parentId = null, quotedMessageId = null, attachments = [] } = input;

    let access;
    let newDM = null;
    if (channelId) {
        assertId(channelId, 'channel');
        access = await checkConversationAccess({ channel: channelId }, uid, { forWrite: true, topLevel: !parentId });
        if (!access.ok) throw denied(access);
        if (!parentId) await checkPostingPolicy(access.conversation, uid);
    } else if (dmSessionId) {
        assertId(dmSessionId, 'conversation');
        access = await checkConversationAccess({ dm: dmSessionId }, uid, { forWrite: true });
        if (!access.ok) throw denied(access);
    } else if (receiverId) {
        assertId(receiverId, 'person');
        if (!workspaceId) throw fail(400, 'workspaceId required when using receiverId', 'MISSING_WORKSPACE');
        // Checks that both people are active members of the workspace.
        newDM = await require('./messages.service').findOrCreateDMSession(uid, receiverId, workspaceId);
        access = await checkConversationAccess({ dm: newDM._id }, uid, { forWrite: true });
        if (!access.ok) throw denied(access);
    } else {
        throw fail(400, 'channelId, dmSessionId or receiverId is required', 'MISSING_TARGET');
    }

    const conv = access.conversation;
    const target = {
        channel: access.type === 'channel' ? conv._id : null,
        dm: access.type === 'dm' ? conv._id : null,
        workspace: conv.workspace || null,
        company: conv.company || null,
        participants: access.type === 'dm' ? (conv.participants || []).map(sid) : null,
    };

    const parent = parentId ? await checkParent(parentId, target, access) : null;
    if (quotedMessageId) await checkQuote(quotedMessageId, target, access);
    const cleanAttachments = await sanitizeAttachments(Array.isArray(attachments) ? attachments : [], uid);

    // A new message brings a deleted (hidden) DM back for everyone in it.
    if (target.dm) {
        await DMSession.updateOne({ _id: target.dm, 'hiddenFor.0': { $exists: true } }, { $set: { hiddenFor: [] } });
    }
    if (newDM && io) {
        for (const p of target.participants) {
            const other = target.participants.find((x) => x !== p) || null;
            io.to(`user:${p}`).emit('new-dm-session', { dmSessionId: String(target.dm), otherUserId: other });
        }
    }

    return { target, parent, attachments: cleanAttachments, access, newDM };
}

/**
 * Rooms that hear about a new message: the conversation, plus each DM participant's own room
 * (every socket joins `user:<id>` on connect), so a brand-new DM reaches devices that haven't
 * joined its room yet. Socket.IO delivers once per socket however many of these it is in.
 */
function roomsFor(target) {
    if (target.channel) return [`channel:${sid(target.channel)}`];
    return [`dm:${sid(target.dm)}`, ...(target.participants || []).map((p) => `user:${sid(p)}`)];
}

module.exports = { prepareSend, roomsFor, fail };
