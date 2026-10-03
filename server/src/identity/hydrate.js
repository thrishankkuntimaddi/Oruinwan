'use strict';

/**
 * Cross-store references. MongoDB documents (messages, channels, notes,
 * notifications...) keep user / workspace / company / department ids, but
 * those rows now live in PostgreSQL, so Mongoose `populate('sender')` can no
 * longer resolve them. `hydrate` does the same job on plain (lean) objects:
 *
 *   const msgs = await Message.find(q).lean();
 *   await hydrate(msgs, { sender: USER_CARD, 'readBy.user': USER_CARD });
 *
 * Paths may point at a single id, an array of ids, or go through arrays of
 * sub-documents ('members.user', 'messages.sender'). Each referenced id is
 * replaced by the selected fields of the target (or left as the bare id when
 * not found, like populate leaves null). One query per entity type, however
 * many documents and paths.
 *
 * A selector is { type: 'user'|'workspace'|'company'|'department'|'team', fields: [...] }.
 * Use the presets below; `_id` is always included.
 */

const USER_CARD = { type: 'user', fields: ['username', 'email', 'profilePicture', 'profile'] };
const USER_MIN = { type: 'user', fields: ['username', 'profilePicture'] };
const USER_FULL = { type: 'user', fields: null }; // every non-secret field
const WORKSPACE_MIN = { type: 'workspace', fields: ['name', 'icon', 'color', 'company', 'type'] };
const COMPANY_MIN = { type: 'company', fields: ['name', 'displayName', 'logo', 'domain'] };
const DEPARTMENT_MIN = { type: 'department', fields: ['name', 'company'] };
const TEAM_MIN = { type: 'team', fields: ['name', 'company'] };

/** 'username profilePicture' (populate's select string) → selector. */
function userSelect(selectString) {
    if (!selectString) return USER_FULL;
    return { type: 'user', fields: String(selectString).split(/\s+/).filter((f) => f && !f.startsWith('-')) };
}

const idOf = (v) => {
    if (v == null) return null;
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v._id != null) return String(v._id);
    return String(v);
};

/** Walk `path` in `doc`, calling visit(container, key) for each leaf slot holding an id or ids. */
function walk(doc, parts, visit) {
    if (doc == null || typeof doc !== 'object') return;
    const [head, ...rest] = parts;
    if (Array.isArray(doc)) {
        for (const item of doc) walk(item, parts, visit);
        return;
    }
    if (!(head in doc)) return;
    if (!rest.length) { visit(doc, head); return; }
    walk(doc[head], rest, visit);
}

function loaders() {
    const id = require('./index');
    return {
        user: (ids) => id.users.findManyByIds(ids),
        company: (ids) => id.companies.findManyByIds(ids),
        workspace: async (ids) => new Map((await id.workspaces.findManyByIds(ids)).map((w) => [String(w._id), w])),
        department: async (ids) => {
            const out = new Map();
            for (const d of await Promise.all(ids.map((x) => id.departments.findById(x)))) if (d) out.set(String(d._id), d);
            return out;
        },
        team: async (ids) => {
            const out = new Map();
            for (const t of await Promise.all(ids.map((x) => id.teams.findById(x)))) if (t) out.set(String(t._id), t);
            return out;
        },
    };
}

function project(entity, fields) {
    if (!entity) return null;
    if (!fields) {
        const copy = { ...entity };
        for (const k of Object.keys(copy)) if (typeof copy[k] === 'function') delete copy[k];
        return copy;
    }
    const out = { _id: String(entity._id) };
    for (const f of fields) {
        const top = f.split('.')[0];
        if (entity[top] !== undefined) out[top] = entity[top];
    }
    return out;
}

/**
 * Replace ids at `paths` (object of path → selector) with the referenced
 * records. Works on one document or an array; returns the same reference.
 */
async function hydrate(docs, paths, { load = loaders() } = {}) {
    const list = Array.isArray(docs) ? docs : [docs];
    if (!list.length || !paths) return docs;
    const wanted = new Map(); // type -> Set(ids)
    const slots = []; // [container, key, selector]
    for (const [path, selector] of Object.entries(paths)) {
        const parts = path.split('.');
        for (const doc of list) {
            walk(doc, parts, (container, key) => {
                slots.push([container, key, selector]);
                const v = container[key];
                const ids = Array.isArray(v) ? v.map(idOf) : [idOf(v)];
                if (!wanted.has(selector.type)) wanted.set(selector.type, new Set());
                for (const x of ids) if (x) wanted.get(selector.type).add(x);
            });
        }
    }
    const found = new Map();
    await Promise.all([...wanted.entries()].map(async ([type, ids]) => {
        found.set(type, ids.size ? await load[type]([...ids]) : new Map());
    }));
    for (const [container, key, selector] of slots) {
        const byId = found.get(selector.type) || new Map();
        const resolve = (v) => {
            const x = idOf(v);
            if (!x) return v;
            const entity = byId.get(x);
            return entity ? project(entity, selector.fields) : null;
        };
        const v = container[key];
        container[key] = Array.isArray(v) ? v.map(resolve).filter((e) => e !== null) : resolve(v);
    }
    return docs;
}

module.exports = { hydrate, userSelect, USER_CARD, USER_MIN, USER_FULL, WORKSPACE_MIN, COMPANY_MIN, DEPARTMENT_MIN, TEAM_MIN };
