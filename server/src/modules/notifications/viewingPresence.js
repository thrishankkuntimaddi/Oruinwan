'use strict';

/**
 * What each web session is looking at, reported by the client with
 * `presence:viewing { conversationType, conversationId, visible, focused }`
 * (on route / visibility / focus changes, and every minute while active).
 *
 * Used to skip mobile push for a user who is actively using the web app:
 * the web client already shows an in-app toast (or nothing, when that
 * conversation is on screen). In memory, per process: with several
 * instances a user on another instance simply still gets push (safe default).
 */

// A focused session must re-report within this window to count as active.
const ACTIVE_TTL_MS = 150 * 1000;

const sessions = new Map(); // userId -> Map(socketId -> state)

const OBJECT_ID = /^[a-f0-9]{24}$/i;

function record(userId, socketId, payload = {}, now = Date.now()) {
    if (!userId || !socketId) return;
    const conversationId = OBJECT_ID.test(String(payload.conversationId || '')) ? String(payload.conversationId) : null;
    const conversationType = ['dm', 'channel'].includes(payload.conversationType) ? payload.conversationType : null;
    const key = String(userId);
    if (!sessions.has(key)) sessions.set(key, new Map());
    sessions.get(key).set(String(socketId), {
        conversationId: conversationType ? conversationId : null,
        conversationType,
        visible: payload.visible === true,
        focused: payload.focused === true,
        ts: now,
    });
}

function clear(userId, socketId) {
    const key = String(userId || '');
    const map = sessions.get(key);
    if (!map) return;
    map.delete(String(socketId));
    if (map.size === 0) sessions.delete(key);
}

function activeStates(userId, now = Date.now()) {
    const map = sessions.get(String(userId || ''));
    if (!map) return [];
    return [...map.values()].filter(s => s.visible && s.focused && now - s.ts < ACTIVE_TTL_MS);
}

/** Is the user actively (visible + focused, recently) using the web app? */
function isActive(userId, now = Date.now()) {
    return activeStates(userId, now).length > 0;
}

/** Is that conversation on screen in one of the user's active sessions? */
function isViewing(userId, conversationId, now = Date.now()) {
    if (!conversationId) return false;
    return activeStates(userId, now).some(s => s.conversationId === String(conversationId));
}

/** Wire the socket event (call once per connection). */
function registerViewingHandlers(socket, userId) {
    socket.on('presence:viewing', (payload) => {
        record(userId, socket.id, payload && typeof payload === 'object' ? payload : {});
    });
    socket.on('disconnect', () => clear(userId, socket.id));
}

function _reset() {
    sessions.clear();
}

module.exports = { record, clear, isActive, isViewing, registerViewingHandlers, ACTIVE_TTL_MS, _reset };
