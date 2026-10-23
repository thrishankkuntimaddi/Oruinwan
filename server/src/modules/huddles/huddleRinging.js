'use strict';

/**
 * Ringing for calls (docs/api/calls.md).
 *
 * A DM or group-DM call rings everyone else in the conversation: `huddle:ring` to each callee's
 * devices plus a high-priority phone push, for 45 seconds. A ring stops (`huddle:ring_cancel`) when
 * the callee answers on any device, declines, the call ends, or time runs out. Anyone who never
 * answered gets a "Missed call" notification. A channel huddle never rings: members get one
 * `huddle:ring` with `ring: false` (a "Join" banner) and the normal "huddle started" notification.
 *
 * Rings live in this process's memory: on a multi-instance deploy the instance that started the
 * call owns its rings (fine for one server today).
 */

const crypto = require('crypto');
const logger = require('../../../utils/logger');

// HUDDLE_RING_TIMEOUT_MS only shortens it for automated tests.
const RING_MS = Number(process.env.HUDDLE_RING_TIMEOUT_MS) > 0 ? Number(process.env.HUDDLE_RING_TIMEOUT_MS) : 45 * 1000;

const getPush = () => require('../../features/push/push.service');
const getNotifications = () => require('../notifications/notificationService');

// ── Decline without signing in ──────────────────────────────────────────────
// The Android ring notification's Decline button may run while the app is closed and has no
// sign-in token, so each ring carries its own short-lived, signed decline link:
// POST <BACKEND_URL>/api/v2/huddles/<huddleId>/decline-ring?token=<userId>.<expiresMs>.<signature>

function declineSecret() {
    const base = process.env.ACCESS_TOKEN_SECRET || process.env.SERVER_KEK || '';
    if (!base) return null;
    return crypto.createHmac('sha256', String(base)).update('oruinwan:huddle-decline:v1').digest();
}

function signature(huddleId, userId, exp, key) {
    return crypto.createHmac('sha256', key).update(`${huddleId}.${userId}.${exp}`).digest('base64url');
}

/** A token that lets this one person decline this one call until `exp` (ms). Null without a secret. */
function signDecline(huddleId, userId, exp) {
    const key = declineSecret();
    if (!key) return null;
    return `${userId}.${exp}.${signature(huddleId, userId, exp, key)}`;
}

/** { ok: true, userId } | { ok: false, error: 'invalid' | 'expired' } */
function verifyDecline(huddleId, token, now = Date.now()) {
    const key = declineSecret();
    const parts = typeof token === 'string' ? token.split('.') : [];
    if (!key || parts.length !== 3) return { ok: false, error: 'invalid' };
    const [userId, expText, sig] = parts;
    const exp = Number(expText);
    if (!userId || !Number.isFinite(exp)) return { ok: false, error: 'invalid' };
    const expected = Buffer.from(signature(huddleId, userId, exp, key));
    const given = Buffer.from(String(sig));
    if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return { ok: false, error: 'invalid' };
    if (now > exp) return { ok: false, error: 'expired' };
    return { ok: true, userId };
}

function publicBase() {
    return String(process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 8080}`).replace(/\/+$/, '');
}

/** The absolute decline link for one callee, or null when the server has no secret. */
function declineUrlFor(huddleId, userId, exp) {
    const token = signDecline(huddleId, userId, exp);
    if (!token) return null;
    return `${publicBase()}/api/v2/huddles/${encodeURIComponent(huddleId)}/decline-ring?token=${encodeURIComponent(token)}`;
}

/** huddleId -> { callerId, payload, callees: Set, answered: Set, timer, workspaceId } */
const rings = new Map();

function emitToUser(io, userId, event, payload) {
    if (io && userId) io.to(`user:${userId}`).emit(event, payload);
}

/** Phone push for a ringing call: data only, so the app shows its own call screen. */
function pushCall(userId, payload) {
    return getPush().sendCallToUser(String(userId), 'call', payload).catch(() => {});
}

function pushCancel(userId, huddleId, reason) {
    return getPush().sendCallToUser(String(userId), 'call_cancel', { huddleId, reason }).catch(() => {});
}

function missedCall(io, ring, userIds) {
    const ids = [...userIds].filter(Boolean);
    if (!ids.length || !ring.workspaceId) return;
    const { payload } = ring;
    const who = payload.from?.name || 'Someone';
    getNotifications().missedCall(io, {
        recipientIds: ids,
        workspaceId: ring.workspaceId,
        dmSessionId: payload.dmId,
        callerName: who,
        title: payload.kind === 'group_dm' ? payload.title : null,
        video: !!payload.video,
        huddleId: payload.huddleId,
    }).catch(err => logger.warn('[huddle] missed-call notification failed:', err.message));
}

/** Stop ringing one callee. */
function cancelFor(io, ring, userId, reason) {
    if (!ring.callees.delete(userId)) return false;
    emitToUser(io, userId, 'huddle:ring_cancel', { huddleId: ring.payload.huddleId, reason });
    pushCancel(userId, ring.payload.huddleId, reason);
    return true;
}

function clear(huddleId) {
    const ring = rings.get(huddleId);
    if (!ring) return null;
    clearTimeout(ring.timer);
    rings.delete(huddleId);
    return ring;
}

/**
 * Start ringing for a new call.
 * kind: 'dm' | 'group_dm' | 'channel'. callees: user ids to ring (not the caller, not busy).
 * onNoAnswer(huddleId): called when a 1:1 call times out with nobody else in it.
 */
function start(io, { huddleId, kind, callerId, callees, workspaceId, dmId = null, channelId = null, title, from, video, meetingId, onNoAnswer, timeoutMs = RING_MS }) {
    const list = [...new Set((callees || []).map(String))].filter(id => id && id !== String(callerId));
    // Milliseconds since 1970, so phones can compare it with their own clock directly.
    const expiresAt = Date.now() + timeoutMs;
    const payload = {
        huddleId,
        kind,
        ...(dmId ? { dmId } : {}),
        ...(channelId ? { channelId } : {}),
        workspaceId: workspaceId || null,
        title: title || null,
        from,
        video: !!video,
        meetingId: meetingId || null,
        ring: kind !== 'channel',
        expiresAt,
    };

    // A channel huddle is an announcement: one banner each, no ringing, nothing to cancel.
    if (kind === 'channel') {
        for (const id of list) emitToUser(io, id, 'huddle:ring', payload);
        return payload;
    }
    if (!list.length) return payload;

    clear(huddleId);
    const ring = { callerId: String(callerId), payload, callees: new Set(list), answered: new Set(), workspaceId, timer: null };
    rings.set(huddleId, ring);
    for (const id of list) {
        // Each person's ring carries their own decline link.
        const mine = { ...payload, declineUrl: declineUrlFor(huddleId, id, expiresAt) };
        emitToUser(io, id, 'huddle:ring', mine);
        pushCall(id, mine);
    }
    ring.timer = setTimeout(() => {
        const r = clear(huddleId);
        if (!r) return;
        const unanswered = [...r.callees];
        for (const id of unanswered) {
            r.callees.add(id); // cancelFor removes it again
            cancelFor(io, r, id, 'timeout');
        }
        missedCall(io, r, unanswered);
        if (!r.answered.size) {
            emitToUser(io, r.callerId, 'huddle:no_answer', { huddleId });
            if (kind === 'dm' && typeof onNoAnswer === 'function') onNoAnswer(huddleId);
        }
    }, timeoutMs);
    if (ring.timer.unref) ring.timer.unref();
    return payload;
}

/** The callee joined the call (on some device): stop ringing on all their devices. */
function answered(io, huddleId, userId) {
    const ring = rings.get(huddleId);
    if (!ring) return;
    const id = String(userId);
    if (cancelFor(io, ring, id, 'answered_elsewhere')) ring.answered.add(id);
    if (!ring.callees.size) clear(huddleId);
}

/**
 * The callee declined. Returns { declined, endCall } — endCall is true for a 1:1 call that nobody
 * answered, so the caller's call can be hung up.
 */
function decline(io, huddleId, userId, name) {
    const ring = rings.get(huddleId);
    const id = String(userId);
    if (!ring || !ring.callees.has(id)) return { declined: false, endCall: false };
    cancelFor(io, ring, id, 'declined');
    emitToUser(io, ring.callerId, 'huddle:declined', { huddleId, userId: id, name: name || null });
    const endCall = ring.payload.kind === 'dm' && !ring.answered.size && !ring.callees.size;
    if (!ring.callees.size) clear(huddleId);
    return { declined: true, endCall };
}

/** The call ended: stop every ring; those who never answered missed it. */
function ended(io, huddleId) {
    const ring = clear(huddleId);
    if (!ring) return;
    const unanswered = [...ring.callees];
    for (const id of unanswered) {
        ring.callees.add(id);
        cancelFor(io, ring, id, 'ended');
    }
    missedCall(io, ring, unanswered);
}

/** Whether this user's devices are ringing for this call (tests and the decline route). */
function isRinging(huddleId, userId) {
    return !!rings.get(huddleId)?.callees.has(String(userId));
}

function _reset() {
    for (const r of rings.values()) clearTimeout(r.timer);
    rings.clear();
}

module.exports = { RING_MS, start, answered, decline, ended, isRinging, signDecline, verifyDecline, declineUrlFor, _reset };
