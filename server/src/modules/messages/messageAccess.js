'use strict';

/**
 * Message access control shared by the v2 messages module and the legacy
 * bookmark / reminder routes.
 *
 * A user can access a message when they can read the conversation it lives in:
 *   - channel: an explicit channel member, or (for public / default channels)
 *     an active member of the channel's workspace;
 *   - DM: a participant of the DM session.
 * Messages that belong to neither are not accessible through these endpoints.
 */

const mongoose = require('mongoose');
const Channel = require('../../features/channels/channel.model.js');
const DMSession = require('../../../models/DMSession');
const identity = require('../../identity');

function sameId(a, b) {
    return a != null && b != null && String(a._id || a) === String(b._id || b);
}

async function canAccessMessage(message, userId) {
    if (!message || !userId) return false;

    if (message.channel) {
        const channel = await Channel.findById(message.channel._id || message.channel)
            .select('members isPrivate isDefault workspace')
            .lean();
        if (!channel) return false;

        const explicitMember = (channel.members || []).some(m => sameId(m && m.user ? m.user : m, userId));
        if (explicitMember) return true;
        if (channel.isPrivate && !channel.isDefault) return false;

        // Public/default channel: any active member of the owning workspace may read it.
        if (!channel.workspace) return false;
        const ws = await identity.workspaces.findById(channel.workspace);
        return !!ws && ws.members.some(m => sameId(m.user, userId) && m.status !== 'removed');
    }

    if (message.dm) {
        const dm = await DMSession.findById(message.dm._id || message.dm).select('participants').lean();
        return !!dm && (dm.participants || []).some(p => sameId(p, userId));
    }

    return false;
}

/**
 * Load a message by id and assert the caller may access it.
 * Throws errors carrying `status` (400 invalid id, 404 missing, 403 no access).
 */
async function loadAccessibleMessage(Message, messageId, userId, { select, populate, lean = false } = {}) {
    if (!mongoose.Types.ObjectId.isValid(String(messageId))) {
        throw Object.assign(new Error('Invalid message id'), { status: 400 });
    }
    let query = Message.findById(messageId);
    if (select && query.select) query = query.select(select);
    if (populate && query.populate) {
        for (const p of [].concat(populate)) query = query.populate(p);
    }
    if (lean && query.lean) query = query.lean();
    const message = await query;
    if (!message) throw Object.assign(new Error('Message not found'), { status: 404 });
    if (!(await canAccessMessage(message, userId))) {
        throw Object.assign(new Error('You do not have access to this message'), { status: 403 });
    }
    return message;
}

module.exports = { canAccessMessage, loadAccessibleMessage };
