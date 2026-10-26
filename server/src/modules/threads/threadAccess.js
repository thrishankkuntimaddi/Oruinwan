'use strict';

const Message = require('../messages/message.model.js');
const { checkConversationAccess, checkMessageAccess } = require('../conversations/conversationAccess');

/**
 * Thread access = access to the thread's parent message (its conversation, and the parent is
 * not older than the person's group join date). With forWrite, blocked DMs refuse replies.
 * Public channels: workspace members may read and reply in threads without joining.
 * Returns { ok: true, message, ... } or { ok: false, status, error }.
 */
async function checkThreadAccess(messageOrId, userId, options = {}) {
    const message = typeof messageOrId === 'object' && messageOrId?._id
        ? messageOrId
        : await Message.findById(messageOrId).select('dm channel workspace createdAt parentId').lean();
    if (!message) return { ok: false, status: 404, error: 'Message not found' };
    const result = await checkMessageAccess(message, userId, options);
    if (!result.ok) return { ...result, error: result.status === 404 ? 'Message not found' : result.error };
    return { ...result, message };
}

// checkConversationAccess lives in conversations/conversationAccess.js (one rule for every path).
module.exports = { checkThreadAccess, checkConversationAccess };
