'use strict';

/**
 * Identity references on task objects. Users and workspaces live in
 * PostgreSQL (src/identity), so `populate('createdBy', ...)` on a task no
 * longer resolves; these helpers attach the same shapes populate produced,
 * for tasks from either store (lean Mongo docs or tasks.repository objects).
 * One identity query per call however many tasks and fields.
 */

const identity = () => require('../../identity');

const str = (v) => (v == null ? null : String(v._id || v));

const DEFAULT_USER_FIELDS = ['createdBy', 'assignedTo', 'transferRequest.requestedTo', 'transferRequest.requestedBy', 'user'];

const get = (o, path) => path.split('.').reduce((v, k) => (v == null ? v : v[k]), o);
function set(o, path, val) {
    const ks = path.split('.');
    const last = ks.pop();
    const parent = ks.reduce((v, k) => (v == null ? v : v[k]), o);
    if (parent) parent[last] = val;
}

function collectIds(items, fields) {
    const ids = new Set();
    for (const o of items) {
        for (const f of fields) {
            const v = get(o, f);
            for (const x of Array.isArray(v) ? v : [v]) { const s = str(x); if (s) ids.add(s); }
        }
    }
    return [...ids];
}

/** The card a populated task user always had: id, username, avatar, display name. */
function userCard(u) {
    return { _id: String(u._id), username: u.username, profilePicture: u.profilePicture || null, profile: u.profile && u.profile.name ? { name: u.profile.name } : undefined };
}

/**
 * Replace user ids at `fields` with user cards. Unknown users stay as ids,
 * the way the store-agnostic clients already tolerate a dangling reference.
 */
async function hydrateTaskUsers(items, fields = DEFAULT_USER_FIELDS) {
    const list = (items || []).filter(Boolean);
    const ids = collectIds(list, fields);
    if (!ids.length) return list;
    const users = await identity().users.findManyByIds(ids);
    const sub = (v) => {
        if (v == null) return v;
        const u = users.get(str(v));
        return u ? userCard(u) : v;
    };
    for (const o of list) {
        for (const f of fields) {
            const v = get(o, f);
            if (v === undefined) continue;
            set(o, f, Array.isArray(v) ? v.map(sub) : sub(v));
        }
    }
    return list;
}

/** `workspace` → { _id, name, icon } like populate('workspace', 'name icon'). */
async function hydrateTaskWorkspaces(items) {
    const list = (items || []).filter(Boolean);
    const ids = collectIds(list, ['workspace']);
    if (!ids.length) return list;
    const rows = await identity().workspaces.findManyByIds(ids);
    const map = new Map(rows.map((w) => [String(w._id), { _id: String(w._id), name: w.name, icon: w.icon }]));
    for (const t of list) if (t.workspace) t.workspace = map.get(str(t.workspace)) || t.workspace;
    return list;
}

module.exports = { hydrateTaskUsers, hydrateTaskWorkspaces, userCard, DEFAULT_USER_FIELDS };
