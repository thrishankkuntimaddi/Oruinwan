'use strict';

/**
 * What each app session (web tab, desktop, phone) is looking at, reported by the client with
 * `presence:viewing { conversationType, conversationId, conversations?, threadId?, visible, focused }`
 * on route / visibility / focus changes, and every minute while active.
 *
 * Used to skip notifications and push for a conversation the person already has on screen,
 * and to skip push while they are actively using an app. Kept in memory for this process and,
 * when Redis is configured, in a Redis hash per user so every server instance sees every session.
 */

const { getRedis } = require('../../shared/redis');
const logger = require('../../../utils/logger');

// A focused session must re-report within this window to count as active.
const ACTIVE_TTL_MS = 150 * 1000;
const REDIS_TTL_S = Math.ceil(ACTIVE_TTL_MS / 1000);
const MAX_CONVERSATIONS = 4; // main view plus split panes

const sessions = new Map(); // userId -> Map(socketId -> state)

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const TYPES = ['dm', 'channel'];

const redisKey = (userId) => `oruinwan:viewing:${userId}`;

function cleanConversation(c) {
    if (!c || typeof c !== 'object') return null;
    const id = String(c.conversationId || c.id || '');
    const type = c.conversationType || c.type;
    return TYPES.includes(type) && OBJECT_ID.test(id) ? { type, id } : null;
}

/** The state we keep for one session, from an untrusted client payload. */
function normalise(payload = {}, now = Date.now()) {
    const list = [cleanConversation(payload)];
    if (Array.isArray(payload.conversations)) {
        for (const c of payload.conversations.slice(0, MAX_CONVERSATIONS)) list.push(cleanConversation(c));
    }
    const conversations = [...new Set(list.filter(Boolean).map((c) => c.id))];
    const threadId = OBJECT_ID.test(String(payload.threadId || '')) ? String(payload.threadId) : null;
    return {
        conversations,
        threadId,
        visible: payload.visible === true,
        focused: payload.focused === true,
        // The phone app shows other conversations' messages as push banners even while open.
        mobile: payload.client === 'mobile',
        ts: now,
    };
}

function writeRedis(userId, socketId, state) {
    const redis = getRedis();
    if (!redis) return;
    const key = redisKey(userId);
    redis.multi().hset(key, String(socketId), JSON.stringify(state)).expire(key, REDIS_TTL_S).exec()
        .catch((err) => logger.warn({ err: err.message }, '[viewingPresence] redis write failed'));
}

function record(userId, socketId, payload = {}, now = Date.now()) {
    if (!userId || !socketId) return;
    const key = String(userId);
    const state = normalise(payload, now);
    if (!sessions.has(key)) sessions.set(key, new Map());
    sessions.get(key).set(String(socketId), state);
    writeRedis(key, socketId, state);
}

function clear(userId, socketId) {
    const key = String(userId || '');
    const map = sessions.get(key);
    if (map) {
        map.delete(String(socketId));
        if (map.size === 0) sessions.delete(key);
    }
    const redis = getRedis();
    if (redis && key) redis.hdel(redisKey(key), String(socketId)).catch(() => {});
}

const isLive = (s, now) => s && s.visible && s.focused && now - s.ts < ACTIVE_TTL_MS;

function localStates(userId, now = Date.now()) {
    const map = sessions.get(String(userId || ''));
    if (!map) return [];
    return [...map.values()].filter((s) => isLive(s, now));
}

/** Active sessions on every instance (Redis), falling back to this process. */
async function allStates(userId, now = Date.now()) {
    const redis = getRedis();
    if (!redis || !userId) return localStates(userId, now);
    try {
        const raw = await redis.hgetall(redisKey(String(userId)));
        const states = Object.values(raw || {}).map((v) => {
            try { return JSON.parse(v); } catch { return null; }
        });
        return states.filter((s) => isLive(s, now));
    } catch {
        return localStates(userId, now);
    }
}

const shows = (s, conversationId, threadId) => (threadId
    ? s.threadId === String(threadId)
    : (s.conversations || []).includes(String(conversationId)));

/** Is the user actively (visible + focused, recently) using the web or desktop app? This process only.
 * (An open phone app still gets push: it shows messages from other conversations as banners.) */
function isActive(userId, now = Date.now()) {
    return localStates(userId, now).some((s) => !s.mobile);
}

/**
 * Is that conversation (or, with threadId, that thread) on screen in one of the user's active
 * sessions? This process only; use isViewingAnywhere when several instances may be running.
 */
function isViewing(userId, conversationId, now = Date.now(), { threadId = null } = {}) {
    if (!conversationId && !threadId) return false;
    return localStates(userId, now).some((s) => shows(s, conversationId, threadId));
}

async function isActiveAnywhere(userId, now = Date.now()) {
    return (await allStates(userId, now)).some((s) => !s.mobile);
}

async function isViewingAnywhere(userId, conversationId, { threadId = null, now = Date.now() } = {}) {
    if (!conversationId && !threadId) return false;
    return (await allStates(userId, now)).some((s) => shows(s, conversationId, threadId));
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

module.exports = {
    record, clear, isActive, isViewing, isActiveAnywhere, isViewingAnywhere,
    registerViewingHandlers, normalise, ACTIVE_TTL_MS, _reset,
};
