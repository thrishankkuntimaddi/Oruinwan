'use strict';

/**
 * Idempotent sends for offline queues.
 *
 * A client may attach a `clientMessageId` (its own id for the message, e.g. a
 * UUID generated when the message was queued). The server stores it with the
 * message under a unique (sender, clientMessageId) index, so resending the same
 * queued message — after a timeout, a reconnect or an app restart — returns the
 * message that was already stored instead of creating a second copy.
 */

const CLIENT_MESSAGE_ID_RE = /^[A-Za-z0-9_\-:.]{8,100}$/;

/** The id when it is usable, otherwise null (a bad id never fails the send; it is just ignored). */
function normalizeClientMessageId(value) {
    if (typeof value !== 'string') return null;
    const v = value.trim();
    return CLIENT_MESSAGE_ID_RE.test(v) ? v : null;
}

function isDuplicateKeyError(err) {
    return Boolean(err && (err.code === 11000 || err.code === 11001));
}

/** The message this sender already stored under this clientMessageId, or null. */
async function findByClientMessageId(Message, senderId, clientMessageId) {
    if (!clientMessageId || !senderId) return null;
    return Message.findOne({ sender: senderId, clientMessageId });
}

/** Mark a returned message as a replay of an earlier send (not serialised to JSON). */
function markDuplicate(obj) {
    if (obj && typeof obj === 'object') {
        Object.defineProperty(obj, 'isDuplicateSend', { value: true, enumerable: false, configurable: true });
    }
    return obj;
}

function isDuplicateSend(obj) {
    return Boolean(obj && obj.isDuplicateSend);
}

module.exports = {
    normalizeClientMessageId,
    isDuplicateKeyError,
    findByClientMessageId,
    markDuplicate,
    isDuplicateSend,
    CLIENT_MESSAGE_ID_RE,
};
