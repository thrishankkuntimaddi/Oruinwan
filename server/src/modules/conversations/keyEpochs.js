'use strict';

/**
 * Conversation key epochs: what lets a group add someone "from now on" without that person being
 * able to decrypt what was said before, and stops removed people from reading what comes next.
 *
 *  - rotate():   a new key for the conversation. The current key becomes an earlier epoch kept by
 *                the people allowed to read that period; the new key goes to the current members.
 *  - grant():    copies of earlier epochs for someone (a channel's new member reads the whole
 *                history; a group can share "earlier messages" when adding someone). Only epochs
 *                the server holds a copy of can be granted.
 *  - checkSendVersion(): a message must be encrypted with the current key, so people who only hold
 *                the current key can read it. Sends with an older key are refused (KEY_ROTATED).
 *
 * The server holds a copy of each key wrapped under SERVER_KEK (as before), which is what lets it
 * hand keys to members who join later. Rotation does not revoke old keys someone already
 * downloaded: a removed person who kept an old key can still open messages from that period if
 * they ever get their ciphertext (the server no longer gives it to them).
 */

const crypto = require('crypto');
const logger = require('../../../utils/logger');
const cryptoUtils = require('./cryptoUtils');

const repo = () => require('../../identity/keys.repo').conversationKeyEpochs;
const docs = () => require('../../identity/queries/auth').conversationKeyDocs;
const publicKeys = () => require('./conversationKeys.service').publicKeys;

const sid = (v) => String(v?._id || v);

function fail(status, message, code, extra = {}) {
    return Object.assign(new Error(message), { status, statusCode: status, code, ...extra });
}

/** The current key's version, or null when the conversation has no key yet. */
async function currentVersion(conversationId, conversationType) {
    const doc = await docs().findByConversation(sid(conversationId), conversationType);
    return doc ? doc.version || 1 : null;
}

/** Wraps `keyBytes` for each user with a public key: { encryptedKeys, missing: [userId] }. */
async function wrapForUsers(userIds, keyBytes) {
    const ids = [...new Set(userIds.map(sid))];
    const found = await publicKeys().batchFindByUserIds(ids);
    const byUser = new Map(found.map((k) => [String(k.userId), k]));
    const encryptedKeys = [];
    const missing = [];
    for (const id of ids) {
        const k = byUser.get(id);
        if (!k?.publicKey) { missing.push(id); continue; }
        const wrapped = cryptoUtils.wrapForUser(keyBytes, k.publicKey);
        encryptedKeys.push({ userId: id, encryptedKey: wrapped.encryptedKey, algorithm: wrapped.algorithm });
    }
    return { encryptedKeys, missing };
}

/**
 * A new key for the conversation.
 *   memberIds: who gets the new key (the conversation's current members).
 *   keepOld:   who keeps the key being retired (default: memberIds). Removed people and people
 *              who join "from now on" are left out.
 * Returns { status: 'ROTATED', version } | { status: 'NO_KEY' }.
 */
async function rotate(conversationId, conversationType, { memberIds, keepOld = memberIds, createdBy = null } = {}) {
    const id = sid(conversationId);
    for (let attempt = 0; attempt < 3; attempt += 1) {
        const doc = await docs().findByConversation(id, conversationType);
        if (!doc) return { status: 'NO_KEY' };
        const keyBytes = crypto.randomBytes(32);
        const server = cryptoUtils.encryptWithWorkspaceKey(keyBytes, doc.workspaceId);
        const { encryptedKeys, missing } = await wrapForUsers(memberIds, keyBytes);
        const holders = new Set(doc.encryptedKeys.map((e) => String(e.userId)));
        try {
            const updated = await repo().rotate(id, conversationType, {
                expectedVersion: doc.version || 1,
                workspaceEncryptedKey: { key: server.ciphertext, iv: server.iv, authTag: server.authTag, createdBy: createdBy ? sid(createdBy) : (doc.createdBy || null) },
                encryptedKeys,
                keepOld: keepOld.map(sid).filter((u) => holders.has(u)),
            });
            if (missing.length) logger.warn({ conversationId: id, missing: missing.length }, '[E2EE] New key: some members have no public key yet (they get it when they set up encryption)');
            return { status: 'ROTATED', version: updated.version };
        } catch (err) {
            if (err?.code !== 'KEY_CHANGED') throw err;
        }
    }
    throw fail(409, 'The conversation key changed meanwhile. Try again.', 'KEY_CHANGED');
}

/**
 * Gives `userId` copies of earlier keys. `versions`: which (a Set), default all. Epochs they
 * already hold are kept unless `rewrap` (their identity key changed). Returns
 * { granted, unavailable: [version] } — unavailable: epochs the server has no copy of.
 */
async function grant(conversationId, conversationType, userId, { versions = null, rewrap = false } = {}) {
    const id = sid(conversationId);
    const uid = sid(userId);
    const epochs = await repo().list(id, conversationType);
    const wanted = epochs.filter((e) => !versions || versions.has(e.version)).filter((e) => rewrap ? e.holders.has(uid) : !e.holders.has(uid));
    if (!wanted.length) return { granted: 0, unavailable: [] };
    const pub = await publicKeys().findByUserId(uid);
    if (!pub?.publicKey) return { granted: 0, unavailable: wanted.map((e) => e.version) };
    let granted = 0;
    const unavailable = [];
    for (const e of wanted) {
        const w = e.workspaceEncryptedKey;
        if (!w?.key) { unavailable.push(e.version); continue; }
        try {
            const bytes = cryptoUtils.unwrapWithServerKEK(w.key, w.iv, w.authTag);
            const wrapped = cryptoUtils.wrapForUser(bytes, pub.publicKey);
            await repo().addMemberKey(id, conversationType, e.version, { userId: uid, encryptedKey: wrapped.encryptedKey, algorithm: wrapped.algorithm });
            granted += 1;
        } catch (err) {
            logger.warn({ err: err?.message, conversationId: id, version: e.version }, '[E2EE] Could not give an earlier key');
            unavailable.push(e.version);
        }
    }
    return { granted, unavailable };
}

/**
 * A group member's earlier keys, per their row in the group (DMSession.memberSince
 * fromKeyVersion, missing = 1): every earlier key from that version on. Used when they get the
 * current key later (e.g. they set up encryption after being added).
 */
async function grantEntitled(dmId, userId) {
    const DMSession = require('../../../models/DMSession');
    const dm = await DMSession.findById(sid(dmId)).select('isGroup participants memberSince').lean();
    if (!dm?.isGroup || !(dm.participants || []).some((p) => sid(p) === sid(userId))) return { granted: 0, unavailable: [] };
    const row = (dm.memberSince || []).find((m) => sid(m.user) === sid(userId));
    const from = Number(row?.fromKeyVersion) || 1;
    const versions = new Set((await list(dmId, 'dm')).map((e) => e.version).filter((v) => v >= from));
    return grant(dmId, 'dm', userId, { versions });
}

/** Tells the conversation's open apps to fetch its new key. */
function announce(io, conversationId, conversationType, version) {
    if (!io) return;
    const room = conversationType === 'channel' ? `channel:${sid(conversationId)}` : `dm:${sid(conversationId)}`;
    io.to(room).emit('conversation:key_rotated', { conversationId: sid(conversationId), conversationType, version });
}

/** Earlier keys `userId` holds, as sent to their devices (newest first). */
async function earlierKeysFor(conversationId, conversationType, userId) {
    try {
        return await repo().listForUser(sid(conversationId), conversationType, sid(userId));
    } catch (err) {
        // Before migration 0018 has run: no earlier keys yet.
        if (/conversation_key_epoch/.test(String(err?.message))) return [];
        throw err;
    }
}

/** Every earlier key's version and who holds it. */
async function list(conversationId, conversationType) {
    return repo().list(sid(conversationId), conversationType);
}

/** Takes away every earlier key `userId` holds in the conversation. */
async function removeUser(conversationId, conversationType, userId) {
    try {
        await repo().removeUser(sid(conversationId), conversationType, sid(userId));
    } catch (err) {
        if (!/conversation_key_epoch/.test(String(err?.message))) throw err;
    }
}

/**
 * The key version a new message must use: the conversation's current one. Messages from apps
 * that don't send a version are accepted while the conversation is still on its first key.
 * Throws 409 KEY_ROTATED (with currentVersion) otherwise. Returns the version to store.
 */
async function checkSendVersion(conversationId, conversationType, keyVersion) {
    const current = await currentVersion(conversationId, conversationType);
    if (current == null) return keyVersion == null ? undefined : Number(keyVersion);
    const sent = keyVersion == null || keyVersion === '' ? null : Number(keyVersion);
    if ((sent == null && current === 1) || sent === current) return current;
    throw fail(409, "This conversation's key changed. Your app is fetching the new one; send it again.", 'KEY_ROTATED', {
        currentVersion: current, conversationId: sid(conversationId), conversationType,
    });
}

module.exports = { currentVersion, rotate, grant, grantEntitled, announce, earlierKeysFor, list, removeUser, checkSendVersion, wrapForUsers };
