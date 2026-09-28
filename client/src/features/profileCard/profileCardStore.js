// Profile cards for @mentions and message headers: fetched from
// GET /api/users/:id/card or /api/users/card?username=, cached per session with
// a short TTL, de-duplicated while in flight, and patched by live presence.

import api from '@services/api';

export const CARD_TTL_MS = 60 * 1000;

const cache = new Map();     // key -> { at, card } | { at, error }
const inflight = new Map();  // key -> Promise
const listeners = new Set();

const norm = (s) => String(s || '').trim().replace(/^@/, '').toLowerCase();

/** Special mentions that are not people. */
export function mentionKind(name) {
    const n = norm(name);
    if (n === 'here' || n === 'channel') return 'broadcast';
    if (/^(ai|oruinwan(?:[-_]?ai)?)$/.test(n)) return 'assistant';
    return 'person';
}

export function cardKey({ userId, username, workspaceId }) {
    if (userId) return `id:${userId}|ws:${workspaceId || ''}`;
    return `name:${norm(username)}|ws:${workspaceId || ''}`;
}

function emit() { listeners.forEach((fn) => { try { fn(); } catch { /* listener errors never break the store */ } }); }

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Cached entry if still fresh: { card } | { error } | null. */
export function peekCard(query) {
    const hit = cache.get(cardKey(query));
    if (!hit) return null;
    if (Date.now() - hit.at > CARD_TTL_MS) return null;
    return hit;
}

function remember(query, entry) {
    const at = Date.now();
    cache.set(cardKey(query), { ...entry, at });
    // A card found by name is also found by id (and the other way round).
    if (entry.card && query.workspaceId !== undefined) {
        cache.set(cardKey({ userId: entry.card.id, workspaceId: query.workspaceId }), { ...entry, at });
        cache.set(cardKey({ username: entry.card.username, workspaceId: query.workspaceId }), { ...entry, at });
    }
}

/**
 * Fetch (or reuse) a card. Resolves to { card } or { error: { status, message } };
 * never rejects.
 */
export function fetchCard(query, { force = false } = {}) {
    const key = cardKey(query);
    if (!force) {
        const hit = peekCard(query);
        if (hit) return Promise.resolve(hit);
    }
    if (inflight.has(key)) return inflight.get(key);

    const { userId, username, workspaceId } = query;
    const params = workspaceId ? { workspaceId } : {};
    let req;
    if (userId) req = api.get(`/api/users/${encodeURIComponent(userId)}/card`, { params });
    else if (username && workspaceId) req = api.get('/api/users/card', { params: { ...params, username: norm(username) } });
    else req = Promise.reject(Object.assign(new Error('No workspace'), { response: { status: 404 } }));

    const p = req
        .then((res) => {
            const entry = { card: res.data?.card || null };
            if (!entry.card) entry.error = { status: 404, message: 'User not found' };
            remember(query, entry);
            return peekCard(query) || entry;
        })
        .catch((err) => {
            const status = err?.response?.status || 0;
            const entry = { error: { status, message: err?.response?.data?.message || 'Could not load this profile' } };
            // Remember "not found / not allowed"; retry network errors next time.
            if (status === 403 || status === 404) remember(query, entry);
            return entry;
        })
        .finally(() => { inflight.delete(key); emit(); });
    inflight.set(key, p);
    return p;
}

let prefetchTimer = null;
/** Debounced warm-up on hover so the popover opens with data. */
export function prefetchCard(query, delay = 180) {
    clearTimeout(prefetchTimer);
    if (mentionKind(query.username) !== 'person' && !query.userId) return;
    if (peekCard(query)) return;
    prefetchTimer = setTimeout(() => { fetchCard(query); }, delay);
}
export function cancelPrefetch() { clearTimeout(prefetchTimer); }

const PRESENCE = { active: 'active', online: 'active', away: 'away', idle: 'away', dnd: 'dnd', busy: 'dnd' };

/** Apply a live presence event (`user-status-changed`) to every cached card of that user. */
export function applyPresence({ userId, status } = {}) {
    if (!userId) return;
    let changed = false;
    for (const [key, entry] of cache) {
        if (entry.card && String(entry.card.id) === String(userId)) {
            const s = String(status || '').toLowerCase();
            const isOnline = s !== 'offline';
            cache.set(key, {
                ...entry,
                card: { ...entry.card, isOnline, userStatus: PRESENCE[s] || entry.card.userStatus, lastSeen: isOnline ? entry.card.lastSeen : new Date().toISOString() },
            });
            changed = true;
        }
    }
    if (changed) emit();
}

/** Tests and sign-out. */
export function clearCardCache() {
    cache.clear();
    inflight.clear();
    emit();
}
