'use strict';

/**
 * Read receipts for channel and DM messages, shared by the socket (`mark-chat-read`,
 * `message-read`) and REST (`POST /api/chat/reset-unread`) paths so both record and announce a
 * read the same way.
 *
 *   readBy        ids of everyone who read the message (unread counts, message info)
 *   readReceipts  [{ user, at }] when each of them first read it (message info "read at");
 *                 `select: false` on the model, so it only leaves the server via message info.
 *
 * A reader with read receipts off (privacy) is still recorded, for their own unread counts,
 * but nobody else is told and message info hides them.
 */

const Message = require('./message.model');
const { canAccessMessage } = require('./messageAccess');
const privacyService = require('../../features/auth/privacy.service');
const logger = require('../../../utils/logger');

/** The update that records `readerId` reading a message (use with a `readBy: { $ne }` filter). */
function readUpdate(readerId, at = new Date()) {
    return {
        $addToSet: { readBy: readerId },
        $push: { readReceipts: { user: readerId, at } },
    };
}

/** False when the user turned read receipts off. Fails open. */
async function sharesReadReceipts(userId) {
    try {
        const privacy = await privacyService.getPrivacy(userId);
        return privacy.readReceipts !== false;
    } catch (err) {
        logger.warn({ err: err.message }, '[PRIVACY] read-receipt preference lookup failed');
        return true;
    }
}

/**
 * Marks every message in a conversation that someone else sent as read by `readerId`, then
 * tells the conversation (`read-update`, unless receipts are off) and the reader's other
 * tabs and devices (`conversation:read`), and clears the reader's notifications for it.
 *
 * Returns { ok: true, modified } or { ok: false, reason: 'invalid' | 'forbidden' }.
 */
async function markConversationRead(io, { readerId, type, id, receipts } = {}) {
    if (!readerId || !id || (type !== 'dm' && type !== 'channel')) return { ok: false, reason: 'invalid' };
    const scope = type === 'dm' ? { dm: id } : { channel: id };
    // Same rule as reading the messages: DM participant, channel member, or (public/default
    // channel) an active member of its workspace.
    if (!(await canAccessMessage(scope, readerId))) return { ok: false, reason: 'forbidden' };

    const result = await Message.updateMany(
        { ...scope, sender: { $ne: readerId }, readBy: { $ne: readerId } },
        readUpdate(readerId),
    );

    if (io) {
        const broadcast = receipts !== false && (await sharesReadReceipts(readerId));
        if (broadcast) {
            const room = type === 'dm' ? `dm:${id}` : `channel:${id}`;
            const payload = type === 'dm' ? { readerId, dmSessionId: id } : { readerId, channelId: id };
            io.to(room).emit('read-update', payload);
        }
        io.to(`user:${readerId}`).emit('conversation:read', { conversationType: type, conversationId: String(id) });
    }
    try {
        await require('../notifications/notificationService').markConversationRead(io, {
            userId: readerId, conversationType: type, conversationId: String(id),
        });
    } catch (err) {
        logger.warn({ err: err.message }, '[read] clearing notifications failed');
    }
    return { ok: true, modified: result?.modifiedCount ?? result?.nModified ?? 0 };
}

/**
 * Message info: readers (already privacy-filtered `{ _id, ... }` cards) with when they read it.
 * `readAt` is an ISO string, or null for reads recorded before read times were kept.
 */
function withReadTimes(readByUsers, readReceipts) {
    const firstAt = new Map();
    for (const r of readReceipts || []) {
        const uid = String(r?.user?._id ?? r?.user ?? '');
        if (!uid || !r.at) continue;
        const at = new Date(r.at);
        if (Number.isNaN(at.getTime())) continue;
        const prev = firstAt.get(uid);
        if (!prev || at < prev) firstAt.set(uid, at);
    }
    return (readByUsers || []).map(u => ({ ...u, readAt: firstAt.has(String(u._id)) ? firstAt.get(String(u._id)).toISOString() : null }));
}

module.exports = { readUpdate, sharesReadReceipts, markConversationRead, withReadTimes };
