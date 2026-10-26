'use strict';

/**
 * Message access for the v2 messages module and the bookmark / reminder routes. The rule itself
 * is conversations/conversationAccess.js: an active workspace member who can read the
 * conversation, and (in groups) not a message from before they joined.
 */

const mongoose = require('mongoose');
const { checkMessageAccess } = require('../conversations/conversationAccess');

async function canAccessMessage(message, userId) {
    if (!message || !userId) return false;
    const access = await checkMessageAccess(message, userId);
    return access.ok;
}

// The access check needs these; an inclusion projection must carry them.
const ACCESS_FIELDS = ['channel', 'dm', 'createdAt'];
function withAccessFields(select) {
    if (typeof select !== 'string' || !select.trim()) return select;
    const tokens = select.trim().split(/\s+/);
    const inclusion = tokens.some((t) => !t.startsWith('+') && !t.startsWith('-'));
    if (!inclusion) return select;
    return [...new Set([...tokens, ...ACCESS_FIELDS])].join(' ');
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
    if (select && query.select) query = query.select(withAccessFields(select));
    if (populate && query.populate) {
        for (const p of [].concat(populate)) query = query.populate(p);
    }
    if (lean && query.lean) query = query.lean();
    const message = await query;
    if (!message) throw Object.assign(new Error('Message not found'), { status: 404 });
    const access = await checkMessageAccess(message, userId);
    if (!access.ok) {
        throw Object.assign(new Error('You do not have access to this message'), { status: 403 });
    }
    return message;
}

module.exports = { canAccessMessage, loadAccessibleMessage, withAccessFields };
