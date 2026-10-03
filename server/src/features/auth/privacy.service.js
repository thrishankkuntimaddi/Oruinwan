'use strict';

/**
 * Account privacy preferences (User.preferences.privacy) and their server-side enforcement.
 *
 *   readReceipts: false     -> the user's reads are not broadcast to others (socket `read-update`)
 *                              and their id is stripped from other viewers' `readBy` lists.
 *                              Their own unread counts keep working (readBy is still written).
 *   typingIndicators: false -> the server never relays the user's `typing` events.
 *   allowDiscovery: false   -> the user is left out of platform-wide people lists
 *                              (GET /api/auth/users, GET /api/chat/contacts) for anyone who does
 *                              not already share a workspace or company with them.
 *
 * Preferences are cached per process for CACHE_TTL_MS; the PUT handler refreshes the cache
 * immediately, so a change applies at once on this instance and within the TTL elsewhere.
 */

const logger = require('../../../utils/logger');

const PRIVACY_DEFAULTS = Object.freeze({
    readReceipts: true,
    typingIndicators: true,
    allowDiscovery: true,
});
const PRIVACY_FIELDS = Object.keys(PRIVACY_DEFAULTS);

const CACHE_TTL_MS = 60 * 1000;
const CACHE_MAX = 20000;
const cache = new Map(); // userId -> { value, expires }

function privacyWithDefaults(stored) {
    const out = { ...PRIVACY_DEFAULTS };
    for (const k of PRIVACY_FIELDS) {
        if (stored && typeof stored[k] === 'boolean') out[k] = stored[k];
    }
    return out;
}

function rememberPrivacy(userId, privacy) {
    if (!userId) return;
    if (cache.size >= CACHE_MAX) cache.clear();
    cache.set(String(userId), { value: privacyWithDefaults(privacy), expires: Date.now() + CACHE_TTL_MS });
}

function forgetPrivacy(userId) {
    if (userId) cache.delete(String(userId));
}

function cached(userId) {
    const hit = cache.get(String(userId));
    if (hit && hit.expires > Date.now()) return hit.value;
    return null;
}

/** Map<userId, privacy> for the given ids (defaults for unknown users). One query for cache misses. */
async function getPrivacyMany(userIds) {
    const ids = [...new Set((userIds || []).filter(Boolean).map(String))];
    const out = new Map();
    const missing = [];
    for (const id of ids) {
        const hit = cached(id);
        if (hit) out.set(id, hit);
        else missing.push(id);
    }
    if (missing.length) {
        const { query } = require('../../shared/postgres');
        const { rows } = await query("SELECT id, preferences->'privacy' AS privacy FROM users WHERE id = ANY($1)", [missing]);
        const byId = new Map((rows || []).map(r => [String(r.id), { preferences: { privacy: r.privacy } }]));
        for (const id of missing) {
            const privacy = privacyWithDefaults(byId.get(id)?.preferences?.privacy);
            rememberPrivacy(id, privacy);
            out.set(id, privacy);
        }
    }
    return out;
}

async function getPrivacy(userId) {
    const map = await getPrivacyMany([userId]);
    return map.get(String(userId)) || { ...PRIVACY_DEFAULTS };
}

/** Set of ids (strings) among `userIds` who turned read receipts off. */
async function readersHidingReceipts(userIds) {
    const map = await getPrivacyMany(userIds);
    const hidden = new Set();
    for (const [id, p] of map) if (p.readReceipts === false) hidden.add(id);
    return hidden;
}

function idOf(entry) {
    return String(entry?._id ?? entry);
}

/**
 * Remove, from each message's readBy, readers who hide their receipts — except the viewer
 * themself. Returns new message objects; fails open (logs) if preferences cannot be loaded.
 */
async function redactReadBy(messages, viewerId) {
    if (!Array.isArray(messages) || messages.length === 0) return messages;
    const viewer = viewerId ? String(viewerId) : null;
    const readerIds = new Set();
    for (const m of messages) for (const r of (m?.readBy || [])) readerIds.add(idOf(r));
    if (viewer) readerIds.delete(viewer);
    if (readerIds.size === 0) return messages;

    let hidden;
    try {
        hidden = await readersHidingReceipts([...readerIds]);
    } catch (err) {
        logger.warn({ err: err.message }, '[PRIVACY] Could not load read-receipt preferences');
        return messages;
    }
    if (hidden.size === 0) return messages;

    return messages.map((m) => {
        if (!m || !Array.isArray(m.readBy)) return m;
        const readBy = m.readBy.filter(r => {
            const id = idOf(r);
            return id === viewer || !hidden.has(id);
        });
        return readBy.length === m.readBy.length ? m : { ...m, readBy };
    });
}

/** Ids of users who share an active workspace with `viewerId`. */
async function sharedWorkspaceUserIds(viewerId) {
    const { query } = require('../../shared/postgres');
    const { rows } = await query(
        `SELECT DISTINCT other.user_id FROM workspace_members me
         JOIN workspace_members other ON other.workspace_id = me.workspace_id AND other.status = 'active'
         JOIN workspaces w ON w.id = me.workspace_id AND w.is_active = true
         WHERE me.user_id = $1 AND me.status = 'active'`,
        [String(viewerId)]
    );
    return rows.map((r) => r.user_id);
}

/**
 * Filter for platform-wide people lists shown to `viewerId`: users with
 * discovery off are only included when they share a workspace with the viewer.
 * Returned in the old Mongo filter shape for callers not yet on PostgreSQL;
 * new code should use `discoverablePeople`.
 */
async function discoverableFilter(viewerId) {
    const shared = await sharedWorkspaceUserIds(viewerId);
    return {
        $or: [
            { 'preferences.privacy.allowDiscovery': { $ne: false } },
            { _id: { $in: shared } },
        ],
    };
}

/**
 * People a viewer may see in platform-wide lists: their own company's members
 * for company accounts; for personal accounts other personal accounts that
 * allow discovery or share a workspace. [{ _id, username, email, profilePicture }]
 */
async function discoverablePeople(viewerId, { limit = 100, search = null } = {}) {
    const { query } = require('../../shared/postgres');
    const me = String(viewerId);
    const { rows: [viewer] } = await query('SELECT company_id FROM users WHERE id = $1', [me]);
    const params = [me];
    let where;
    if (viewer?.company_id) {
        params.push(viewer.company_id);
        where = 'id <> $1 AND company_id = $2';
    } else {
        params.push(await sharedWorkspaceUserIds(me));
        where = `id <> $1 AND company_id IS NULL AND (COALESCE((preferences->'privacy'->>'allowDiscovery')::boolean, true) OR id = ANY($2))`;
    }
    if (search) { params.push(`%${search}%`); where += ` AND (username ILIKE $${params.length} OR email ILIKE $${params.length})`; }
    params.push(limit);
    const { rows } = await query(
        `SELECT id, username, email, profile_picture FROM users WHERE ${where} AND account_status NOT IN ('removed', 'blocked')
         ORDER BY username LIMIT $${params.length}`,
        params
    );
    return rows.map((r) => ({ _id: r.id, username: r.username, email: r.email, profilePicture: r.profile_picture }));
}

module.exports = {
    PRIVACY_DEFAULTS,
    PRIVACY_FIELDS,
    privacyWithDefaults,
    rememberPrivacy,
    forgetPrivacy,
    getPrivacy,
    getPrivacyMany,
    readersHidingReceipts,
    redactReadBy,
    discoverableFilter,
    discoverablePeople,
    sharedWorkspaceUserIds,
};
