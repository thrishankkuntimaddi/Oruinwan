'use strict';

/**
 * Queries for the company / admin / org / analytics area (group 3 of the
 * identity move). The repositories cover single-record reads and writes; this
 * file adds what reports and admin screens need:
 *
 *   - `users.find/findOne/count/updateMany`, and the same for companies,
 *     workspaces and departments, taking the Mongo-style filters these
 *     features already build ({ companyId, accountStatus: { $ne: 'removed' },
 *     _id: { $in }, $or: [...] }) and translating them to SQL. Unsupported
 *     operators throw, so a missed case fails loudly instead of matching
 *     everything.
 *   - `withOrg(users)`: the per-user `departments`, `managedDepartments` and
 *     `workspaces` arrays the Mongo user document used to carry, now derived
 *     from department_members / workspace_members.
 *   - department membership writes and the counting/grouping reports.
 *
 * Every function accepts an optional `{ tx }` (from withTransaction) so the
 * company-registration flow can run them in one transaction.
 */

const { query } = require('../../shared/postgres');
const users = require('../users.repo');
const companies = require('../companies.repo');
const workspaces = require('../workspaces.repo');
const { str, camelRow, buildUpdate, newId } = require('../sql');

const run = (tx, text, params) => (tx ? tx.query(text, params) : query(text, params));

// ── Mongo-style filter → SQL ───────────────────────────────────────────

const ENTITIES = {
    users: {
        table: 'users',
        columns: users.COLUMNS,
        arrays: new Set(['roles']),
        json: new Set(['profile', 'preferences', 'permissions', 'social', 'legal_hold', 'suspension', 'password_flags', 'login_guard', 'tokens', 'sso']),
        special: {
            departments: (v, p) => membershipExists('department_members', 'department_id', 'users.id', v, p),
            managedDepartments: (v, p) => membershipExists('department_members', 'department_id', 'users.id', v, p, "role = 'manager'"),
            'workspaces.workspace': (v, p) => membershipExists('workspace_members', 'workspace_id', 'users.id', v, p, "status = 'active'"),
            'legalHold': (v, p) => jsonFlag('legal_hold', 'enabled', v, p),
        },
    },
    companies: {
        table: 'companies',
        columns: { ...companies.COLUMNS, phone: 'phone' },
        arrays: new Set(['allowed_emails']),
        json: new Set(['settings', 'limits', 'sso', 'security_settings', 'invite_policy', 'metadata', 'domain_verification', 'phone', 'documents']),
        special: {
            'admins.user': (v, p) => membershipExists('company_admins', 'user_id', 'companies.id', v, p, null, 'company_id'),
            ssoEnabled: (v, p) => jsonFlag('sso', 'enabled', v, p),
            ownerPhone: (v, p) => { p.push(String(v)); return `(companies.phone ->> 'ownerPhone') = $${p.length}`; },
            ownerEmail: (v, p) => { p.push(String(v)); return `lower(companies.phone ->> 'ownerEmail') = lower($${p.length})`; },
        },
    },
    workspaces: {
        table: 'workspaces',
        columns: workspaces.COLUMNS,
        arrays: new Set(['default_channels']),
        json: new Set(['settings', 'analytics_cache', 'metadata']),
        special: {
            'members.user': (v, p) => membershipExists('workspace_members', 'user_id', 'workspaces.id', v, p, null, 'workspace_id'),
            members: (v, p) => {
                // { $elemMatch: { user, status, role } }
                if (!v || !v.$elemMatch) throw new Error('workspaces filter: members needs $elemMatch');
                const m = v.$elemMatch;
                const conds = ['wm.workspace_id = workspaces.id'];
                if (m.user !== undefined) conds.push(scalarOrIn('wm.user_id', m.user, p));
                if (m.status !== undefined) conds.push(scalarOrIn('wm.status', m.status, p));
                if (m.role !== undefined) conds.push(scalarOrIn('wm.role', m.role, p));
                return `EXISTS (SELECT 1 FROM workspace_members wm WHERE ${conds.join(' AND ')})`;
            },
        },
    },
    departments: {
        table: 'departments',
        columns: {
            _id: 'id', id: 'id', company: 'company_id', name: 'name', description: 'description', head: 'head_user_id',
            parentDepartment: 'parent_department_id', defaultWorkspaceId: 'default_workspace_id', workspaces: 'workspaces',
            isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at',
        },
        arrays: new Set(['workspaces']),
        json: new Set(['metadata']),
        special: {
            members: (v, p) => membershipExists('department_members', 'user_id', 'departments.id', v, p, null, 'department_id'),
            managers: (v, p) => membershipExists('department_members', 'user_id', 'departments.id', v, p, "role = 'manager'", 'department_id'),
        },
    },
};

function idValue(v) {
    if (v == null) return v;
    if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'object' && (v._id != null || typeof v.toHexString === 'function')) return String(v._id || v);
    return typeof v === 'object' ? String(v) : v;
}

function scalarOrIn(col, v, p) {
    if (v && typeof v === 'object' && Array.isArray(v.$in)) { p.push(v.$in.map((x) => String(idValue(x)))); return `${col} = ANY($${p.length})`; }
    p.push(String(idValue(v)));
    return `${col} = $${p.length}`;
}

/**
 * EXISTS on a join table. `ownerCol` is the join-table column pointing back at
 * the filtered row; `valueCol` the one compared with the filter value.
 */
function membershipExists(table, valueCol, outerId, v, p, extra = null, ownerCol = 'user_id') {
    const conds = [`j.${ownerCol} = ${outerId}`];
    if (extra) conds.push(`j.${extra}`);
    let negate = false;
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.toHexString !== 'function' && v._id == null) {
        if (v.$in) { p.push(v.$in.map((x) => String(idValue(x)))); conds.push(`j.${valueCol} = ANY($${p.length})`); }
        else if (v.$ne !== undefined || v.$nin) { const list = v.$nin || [v.$ne]; p.push(list.map((x) => String(idValue(x)))); conds.push(`j.${valueCol} = ANY($${p.length})`); negate = true; }
        else if (v.$exists !== undefined || v.$size !== undefined) {
            const has = v.$exists !== undefined ? !!v.$exists : v.$size !== 0;
            return `${has ? '' : 'NOT '}EXISTS (SELECT 1 FROM ${table} j WHERE ${conds.join(' AND ')})`;
        } else throw new Error(`unsupported membership operator ${Object.keys(v).join(',')}`);
    } else {
        p.push(String(idValue(v)));
        conds.push(`j.${valueCol} = $${p.length}`);
    }
    return `${negate ? 'NOT ' : ''}EXISTS (SELECT 1 FROM ${table} j WHERE ${conds.join(' AND ')})`;
}

function jsonFlag(col, key, v, p) {
    const expr = `COALESCE((${col} ->> '${key}')::boolean, false)`;
    if (v && typeof v === 'object' && v.$ne !== undefined) { p.push(!!v.$ne); return `${expr} <> $${p.length}`; }
    p.push(!!v);
    return `${expr} = $${p.length}`;
}

function columnExpr(entity, key) {
    const def = ENTITIES[entity];
    if (def.columns[key]) return { expr: `${def.table}.${def.columns[key]}`, col: def.columns[key] };
    const [head, ...rest] = key.split('.');
    const col = def.columns[head];
    if (col && def.json.has(col) && rest.length) {
        return { expr: `(${def.table}.${col} #>> '{${rest.join(',')}}')`, col, jsonPath: true };
    }
    // Mongo-era aliases the user filters still use.
    if (entity === 'users' && head === 'name') return { expr: "(users.profile #>> '{name}')", col: 'profile', jsonPath: true };
    throw new Error(`${entity} filter: unsupported field "${key}"`);
}

function opClause(entity, key, value, p) {
    const def = ENTITIES[entity];
    if (def.special[key]) return def.special[key](value, p);
    const { expr, col, jsonPath } = columnExpr(entity, key);
    const isArray = def.arrays.has(col) && !jsonPath;
    const cast = (v) => (jsonPath && typeof v === 'boolean' ? String(v) : (jsonPath && typeof v === 'number' ? String(v) : v));

    const eq = (v) => {
        if (v === null) return `${expr} IS NULL`;
        if (v instanceof RegExp) { p.push(v.source); return `${expr} ${v.flags.includes('i') ? '~*' : '~'} $${p.length}`; }
        p.push(cast(idValue(v)));
        return isArray ? `$${p.length} = ANY(${expr})` : `${expr} = $${p.length}`;
    };

    if (value === null || value instanceof RegExp || typeof value !== 'object' || value instanceof Date
        || typeof value.toHexString === 'function' || (value._id != null && !Object.keys(value).some((k) => k.startsWith('$')))) {
        return eq(value);
    }
    if (Array.isArray(value)) throw new Error(`${entity} filter: array equality on "${key}" is not supported`);

    const parts = [];
    for (const [op, v] of Object.entries(value)) {
        switch (op) {
            case '$eq': parts.push(eq(v)); break;
            case '$ne':
                if (v === null) parts.push(`${expr} IS NOT NULL`);
                else { p.push(cast(idValue(v))); parts.push(isArray ? `NOT ($${p.length} = ANY(${expr}))` : `${expr} IS DISTINCT FROM $${p.length}`); }
                break;
            case '$in': {
                const hasNull = v.some((x) => x === null);
                const list = v.filter((x) => x !== null).map((x) => cast(idValue(x))).map((x) => (typeof x === 'string' ? x : x));
                p.push(list.map((x) => (x instanceof Date ? x : (typeof x === 'object' ? String(x) : x))));
                const c = isArray ? `${expr} && $${p.length}` : `${expr} = ANY($${p.length})`;
                parts.push(hasNull ? `(${c} OR ${expr} IS NULL)` : c);
                break;
            }
            case '$nin': {
                const hasNull = v.some((x) => x === null);
                p.push(v.filter((x) => x !== null).map((x) => cast(idValue(x))));
                const c = isArray ? `NOT (${expr} && $${p.length})` : `(${expr} IS NULL OR NOT (${expr} = ANY($${p.length})))`;
                parts.push(hasNull ? `(${c} AND ${expr} IS NOT NULL)` : c);
                break;
            }
            case '$gt': p.push(cast(v)); parts.push(`${expr} > $${p.length}`); break;
            case '$gte': p.push(cast(v)); parts.push(`${expr} >= $${p.length}`); break;
            case '$lt': p.push(cast(v)); parts.push(`${expr} < $${p.length}`); break;
            case '$lte': p.push(cast(v)); parts.push(`${expr} <= $${p.length}`); break;
            case '$exists': parts.push(v ? `${expr} IS NOT NULL` : `${expr} IS NULL`); break;
            case '$regex': {
                const src = v instanceof RegExp ? v.source : String(v);
                const ci = (value.$options || '').includes('i') || (v instanceof RegExp && v.flags.includes('i'));
                p.push(src);
                parts.push(`${expr} ${ci ? '~*' : '~'} $${p.length}`);
                break;
            }
            case '$options': break;
            case '$size':
                if (!isArray) throw new Error(`${entity} filter: $size on non-array "${key}"`);
                p.push(v); parts.push(`cardinality(${expr}) = $${p.length}`); break;
            default: throw new Error(`${entity} filter: unsupported operator ${op} on "${key}"`);
        }
    }
    return parts.length ? parts.join(' AND ') : 'TRUE';
}

/** Translate a filter object to { where, params }. `params` may be shared (for nested use). */
function toWhere(entity, filter = {}, params = []) {
    const clauses = [];
    for (const [key, value] of Object.entries(filter || {})) {
        if (value === undefined) continue;
        if (key === '$or' || key === '$and') {
            const sub = value.map((f) => `(${toWhere(entity, f, params).where})`);
            if (sub.length) clauses.push(`(${sub.join(key === '$or' ? ' OR ' : ' AND ')})`);
            continue;
        }
        clauses.push(opClause(entity, key, value, params));
    }
    return { where: clauses.length ? clauses.join(' AND ') : 'TRUE', params };
}

function orderBy(entity, sort) {
    if (!sort) return '';
    const def = ENTITIES[entity];
    const parts = [];
    for (const [k, dir] of Object.entries(typeof sort === 'string' ? parseSortString(sort) : sort)) {
        const { expr } = columnExpr(entity, k);
        parts.push(`${expr} ${dir === -1 || dir === 'desc' ? 'DESC' : 'ASC'}${def ? '' : ''}`);
    }
    return parts.length ? ` ORDER BY ${parts.join(', ')}` : '';
}

function parseSortString(s) {
    const out = {};
    for (const tok of String(s).split(/\s+/).filter(Boolean)) out[tok.replace(/^-/, '')] = tok.startsWith('-') ? -1 : 1;
    return out;
}

/** Keep only the listed fields (Mongo inclusion projection); `-field` removes. `_id` always kept. */
function project(obj, select) {
    if (!obj || !select) return obj;
    const tokens = String(select).split(/\s+/).filter(Boolean);
    const exclude = tokens.filter((t) => t.startsWith('-')).map((t) => t.slice(1));
    const include = tokens.filter((t) => !t.startsWith('-') && !t.startsWith('+'));
    let out;
    if (include.length) {
        out = { _id: obj._id };
        for (const f of include) {
            const top = f.split('.')[0];
            if (obj[top] !== undefined) out[top] = obj[top];
        }
    } else out = { ...obj };
    for (const f of exclude) delete out[f];
    return out;
}

/** User fields kept in jsonb (suspension, legal hold) surfaced under their old names. */
function flattenUser(u) {
    if (!u) return u;
    // Same jsonb keys as the auth document mapping (queries/auth.js expand/collapse).
    const sus = u.suspension || {};
    u.suspendedAt = sus.suspendedAt || null;
    u.suspendedBy = sus.suspendedBy || null;
    u.suspensionReason = sus.suspensionReason || null;
    const lh = u.legalHold && typeof u.legalHold === 'object' ? u.legalHold : null;
    if (lh) {
        u.legalHoldReason = lh.reason || null;
        u.legalHoldSetBy = lh.setBy || null;
        u.legalHoldAt = lh.at || null;
        u.legalHold = !!lh.enabled;
    } else u.legalHold = false;
    return u;
}

/** Translate Mongo-era user patch keys (suspendedAt, legalHold...) to the jsonb columns. */
function packUserPatch(patch) {
    const p = { ...patch };
    const sus = {};
    for (const [k, to] of [['suspendedAt', 'suspendedAt'], ['suspendedBy', 'suspendedBy'], ['suspensionReason', 'suspensionReason']]) {
        if (p[k] !== undefined) { sus[to] = p[k] == null ? null : (p[k] instanceof Date ? p[k] : String(p[k])); delete p[k]; }
    }
    if (Object.keys(sus).length) p.suspension = { $merge: true, ...sus };
    const lh = {};
    if (typeof p.legalHold === 'boolean') { lh.enabled = p.legalHold; delete p.legalHold; }
    for (const [k, to] of [['legalHoldReason', 'reason'], ['legalHoldSetBy', 'setBy'], ['legalHoldAt', 'at']]) {
        if (p[k] !== undefined) { lh[to] = p[k] == null ? null : (p[k] instanceof Date ? p[k] : String(p[k])); delete p[k]; }
    }
    if (Object.keys(lh).length) p.legalHold = { $merge: true, ...lh };
    for (const k of ['companyId', 'reportsTo', 'coOwnerOf']) if (p[k] != null && typeof p[k] === 'object') p[k] = String(p[k]);
    return p;
}

/** Partial user update with Mongo-era field names; returns the flattened user. */
async function updateUser(id, patch, { tx } = {}) {
    const { sets, params, next } = buildUpdate(packUserPatch(patch), users.COLUMNS);
    if (!sets.length) return q.users.findOne({ _id: id }, { tx });
    sets.push('updated_at = now()');
    const { rows } = await run(tx, `UPDATE users SET ${sets.join(', ')} WHERE id = $${next} RETURNING *`, [...params, str(id)]);
    return rows[0] ? flattenUser(users.toUser(rows[0])) : null;
}

/**
 * Company fields that live inside jsonb columns, surfaced under their old
 * names (ownerPhone, ownerEmail, phoneVerified, ssoEnabled, ...) so callers
 * and responses keep the Mongo-era shape.
 */
function flattenCompany(c) {
    if (!c) return c;
    const phone = (c.phone && typeof c.phone === 'object') ? c.phone : {};
    c.ownerPhone = phone.ownerPhone || null;
    c.ownerEmail = phone.ownerEmail || null;
    c.phoneVerified = !!phone.verified;
    const sso = c.sso || {};
    c.ssoEnabled = !!sso.enabled;
    c.ssoProvider = sso.provider || null;
    c.ssoMetadataUrl = sso.metadataUrl || null;
    c.ssoDomain = sso.domain || null;
    const dv = c.domainVerification || {};
    c.domainVerificationToken = dv.token || null;
    c.domainVerificationExpires = dv.expires || null;
    // Seat/workspace limits were part of settings in the Mongo document.
    c.settings = { ...(c.limits || {}), ...(c.settings || {}) };
    return c;
}

/** Strip what never leaves the server (OTPs, verification tokens, SSO secrets). */
function publicCompany(c, { documents = true, metadata = true } = {}) {
    if (!c) return c;
    const out = { ...c };
    for (const k of Object.keys(out)) if (typeof out[k] === 'function') delete out[k];
    delete out.phone; delete out.domainVerification; delete out.domainVerificationToken; delete out.domainVerificationExpires;
    if (out.sso) out.sso = { enabled: !!out.sso.enabled, provider: out.sso.provider || null, domain: out.sso.domain || null };
    delete out.ssoConfig;
    if (!documents) delete out.documents;
    if (!metadata) delete out.metadata;
    return out;
}

/** Pack Mongo-era top-level company fields into their jsonb columns before writing. */
function packCompany(obj) {
    const o = { ...obj };
    const phone = { ...(o.phone && typeof o.phone === 'object' ? o.phone : {}) };
    if (o.ownerPhone !== undefined) { phone.ownerPhone = o.ownerPhone; delete o.ownerPhone; }
    if (o.ownerEmail !== undefined) { phone.ownerEmail = o.ownerEmail; delete o.ownerEmail; }
    if (o.phoneVerified !== undefined) { phone.verified = !!o.phoneVerified; delete o.phoneVerified; }
    if (Object.keys(phone).length) o.phone = phone;
    const sso = { ...(o.sso || {}) };
    for (const [k, to] of [['ssoEnabled', 'enabled'], ['ssoProvider', 'provider'], ['ssoMetadataUrl', 'metadataUrl'], ['ssoDomain', 'domain'], ['ssoConfig', 'config']]) {
        if (o[k] !== undefined) { sso[to] = o[k]; delete o[k]; }
    }
    if (Object.keys(sso).length) o.sso = sso;
    const dv = { ...(o.domainVerification || {}) };
    if (o.domainVerificationToken !== undefined) { dv.token = o.domainVerificationToken; delete o.domainVerificationToken; }
    if (o.domainVerificationExpires !== undefined) { dv.expires = o.domainVerificationExpires; delete o.domainVerificationExpires; }
    if (Object.keys(dv).length) o.domainVerification = dv;
    return o;
}

/** Partial company update with Mongo-era field names (jsonb fields are merged). */
async function updateCompany(id, patch, { tx } = {}) {
    // 'settings.timezone' style keys (Mongo $set paths) merge into their jsonb column.
    const folded = {};
    for (const [k, v] of Object.entries(patch || {})) {
        const dot = k.indexOf('.');
        if (dot > 0) {
            const head = k.slice(0, dot);
            folded[head] = { ...(folded[head] || {}), [k.slice(dot + 1)]: v };
        } else folded[k] = folded[k] && typeof v === 'object' && v ? { ...folded[k], ...v } : v;
    }
    const packed = packCompany(folded);
    for (const k of ['phone', 'sso', 'domainVerification', 'metadata', 'settings', 'invitePolicy', 'limits', 'securitySettings']) {
        if (packed[k] && typeof packed[k] === 'object' && !packed[k].$merge) packed[k] = { $merge: true, ...packed[k] };
    }
    const { phone, ...rest } = packed;
    const cols = { ...companies.COLUMNS };
    delete cols.phone;
    const { sets: fixed, params, next: n0 } = buildUpdate(rest, cols);
    let next = n0;
    if (phone) {
        const { $merge, ...fields } = phone;
        fixed.push(`phone = COALESCE(phone, '{}'::jsonb) || $${next}::jsonb`);
        params.push(JSON.stringify(fields));
        next += 1;
    }
    if (!fixed.length) return q.companies.findOne({ _id: id }, { tx });
    fixed.push('updated_at = now()');
    const { rows } = await run(tx, `UPDATE companies SET ${fixed.join(', ')} WHERE id = $${next} RETURNING *`, [...params, str(id)]);
    return rows[0] ? flattenCompany(companies.toCompany(rows[0], await companyAdmins(id, { tx }))) : null;
}

async function companyAdmins(companyId, { tx } = {}) {
    const { rows } = await run(tx, 'SELECT user_id, role, assigned_at FROM company_admins WHERE company_id = $1', [str(companyId)]);
    return rows;
}

const MAPPERS = {
    users: (r, o) => flattenUser(users.toUser(r, o)),
    companies: (r) => flattenCompany(companies.toCompany(r)),
    workspaces: (r) => workspaces.toWorkspace(r),
    departments: (r) => {
        const d = camelRow(r);
        d.company = d.companyId; delete d.companyId;
        d.head = d.headUserId; delete d.headUserId;
        d.parentDepartment = d.parentDepartmentId; delete d.parentDepartmentId;
        return d;
    },
};

async function finalize(entity, rows, opts) {
    const rawById = new Map(rows.map((r) => [r.id, r]));
    let list = rows.map((r) => MAPPERS[entity](r, opts));
    if (entity === 'workspaces' && list.length && opts.members !== false) {
        list = await workspaces.findManyByIds(list.map((w) => w._id)).then((full) => {
            const byId = new Map(full.map((w) => [String(w._id), w]));
            return list.map((w) => byId.get(String(w._id)) || w);
        });
    }
    if (entity === 'departments' && list.length && opts.members !== false) {
        const { rows: m } = await run(opts.tx, 'SELECT * FROM department_members WHERE department_id = ANY($1)', [list.map((d) => d._id)]);
        const by = new Map();
        for (const r of m) { if (!by.has(r.department_id)) by.set(r.department_id, []); by.get(r.department_id).push(r); }
        for (const d of list) {
            const mem = by.get(d._id) || [];
            d.managers = mem.filter((x) => x.role === 'manager').map((x) => x.user_id);
            d.members = mem.map((x) => x.user_id);
        }
    }
    if (entity === 'companies' && list.length && opts.admins !== false) {
        const { rows: a } = await run(opts.tx, 'SELECT company_id, user_id, role, assigned_at FROM company_admins WHERE company_id = ANY($1)', [list.map((c) => c._id)]);
        const by = new Map();
        for (const r of a) { if (!by.has(r.company_id)) by.set(r.company_id, []); by.get(r.company_id).push(r); }
        list = list.map((c) => flattenCompany(companies.toCompany(rawById.get(c._id), by.get(c._id) || [])));
    }
    if (entity === 'users' && opts.org) list = await withOrg(list, opts);
    return opts.select ? list.map((x) => project(x, opts.select)) : list;
}

function makeEntity(entity) {
    const { table } = ENTITIES[entity];
    return {
        /** opts: { sort, limit, skip, select, withSecrets, org (users), members (workspaces/departments), tx } */
        async find(filter = {}, opts = {}) {
            const { where, params } = toWhere(entity, filter);
            let sql = `SELECT ${table}.* FROM ${table} WHERE ${where}${orderBy(entity, opts.sort)}`;
            if (opts.limit) { params.push(opts.limit); sql += ` LIMIT $${params.length}`; }
            if (opts.skip) { params.push(opts.skip); sql += ` OFFSET $${params.length}`; }
            const { rows } = await run(opts.tx, sql, params);
            return finalize(entity, rows, opts);
        },
        async findOne(filter = {}, opts = {}) {
            const [first] = await this.find(filter, { ...opts, limit: 1 });
            return first || null;
        },
        async count(filter = {}, opts = {}) {
            const { where, params } = toWhere(entity, filter);
            const { rows } = await run(opts.tx, `SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params);
            return rows[0].n;
        },
        async exists(filter = {}, opts = {}) {
            return (await this.count(filter, opts)) > 0;
        },
        async ids(filter = {}, opts = {}) {
            const { where, params } = toWhere(entity, filter);
            const { rows } = await run(opts.tx, `SELECT ${table}.id FROM ${table} WHERE ${where}`, params);
            return rows.map((r) => r.id);
        },
        /** Set columns (camelCase keys) on every matching row. Returns { modifiedCount }. */
        async updateMany(filter, patch, opts = {}) {
            const { where, params } = toWhere(entity, filter);
            const packed = entity === 'users' ? packUserPatch(patch) : patch;
            const { sets, params: setParams } = buildUpdate(packed, ENTITIES[entity].columns, { startAt: params.length + 1 });
            if (!sets.length) return { modifiedCount: 0 };
            sets.push('updated_at = now()');
            const { rowCount } = await run(opts.tx, `UPDATE ${table} SET ${sets.join(', ')} WHERE ${where}`, [...params, ...setParams]);
            return { modifiedCount: rowCount };
        },
    };
}

/** INSERT one row from a camelCase object (json columns stringified) → mapped record. Accepts { tx }. */
async function insert(entity, obj, { tx } = {}) {
    const def = ENTITIES[entity];
    const data = { ...(entity === 'companies' ? packCompany(obj) : obj), id: str(obj._id || obj.id) || newId() };
    delete data._id;
    const cols = [];
    const params = [];
    const seen = new Set();
    for (const [key, value] of Object.entries(data)) {
        const col = def.columns[key];
        if (!col || value === undefined || seen.has(col)) continue;
        seen.add(col);
        cols.push(col);
        if (def.json.has(col)) params.push(value === null ? null : JSON.stringify(value));
        else if (def.arrays.has(col)) params.push((value || []).map(String));
        else params.push(value === null || value instanceof Date || typeof value !== 'object' ? value : String(value));
    }
    const { rows } = await run(tx, `INSERT INTO ${def.table} (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`, params);
    return MAPPERS[entity](rows[0]);
}

/** Add workspace members inside a transaction (upsert). */
async function addWorkspaceMembers(workspaceId, members, { tx } = {}) {
    for (const m of members || []) {
        await run(tx,
            `INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES ($1, $2, $3, $4)
             ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status, removed_at = NULL, removed_by = NULL`,
            [str(workspaceId), str(m.user), m.role || 'member', m.status || 'active']);
    }
}

async function addCompanyAdmin(companyId, userId, role = 'admin', { tx } = {}) {
    await run(tx,
        `INSERT INTO company_admins (company_id, user_id, role) VALUES ($1, $2, $3)
         ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role`, [str(companyId), str(userId), role]);
}

async function addUserEmail(userId, email, { verified = false, isPrimary = false, tx } = {}) {
    await run(tx,
        `INSERT INTO user_emails (id, user_id, email, verified, is_primary) VALUES ($1, $2, lower($3), $4, $5)
         ON CONFLICT (user_id, email) DO NOTHING`, [newId(), str(userId), email, verified, isPrimary]);
}

/** Users whose primary or secondary emails match (lower-cased). */
async function userIdsByAnyEmail(email) {
    const { rows } = await query(
        `SELECT id FROM users WHERE lower(email) = lower($1) OR lower(personal_email) = lower($1)
         UNION SELECT user_id FROM user_emails WHERE lower(email) = lower($1)`, [String(email)]);
    return rows.map((r) => r.id);
}

const q = {
    users: makeEntity('users'),
    companies: makeEntity('companies'),
    workspaces: makeEntity('workspaces'),
    departments: makeEntity('departments'),
};

// ── Per-user org arrays ────────────────────────────────────────────────

/**
 * Attach `departments`, `managedDepartments` (ids) and `workspaces`
 * ([{ workspace, role, joinedAt }]) to user objects, the arrays the Mongo
 * user document carried. One query per table for any number of users.
 */
async function withOrg(list, opts = {}) {
    const arr = Array.isArray(list) ? list : [list];
    const ids = arr.filter(Boolean).map((u) => String(u._id));
    if (!ids.length) return list;
    const [{ rows: dm }, { rows: wm }] = await Promise.all([
        run(opts.tx, `SELECT dm.user_id, dm.department_id, dm.role FROM department_members dm
                      JOIN departments d ON d.id = dm.department_id AND d.is_active = true WHERE dm.user_id = ANY($1)`, [ids]),
        run(opts.tx, `SELECT user_id, workspace_id, role, joined_at FROM workspace_members WHERE user_id = ANY($1) AND status = 'active'`, [ids]),
    ]);
    const deps = new Map();
    const managed = new Map();
    const wss = new Map();
    for (const r of dm) {
        if (!deps.has(r.user_id)) deps.set(r.user_id, []);
        deps.get(r.user_id).push(r.department_id);
        if (r.role === 'manager') {
            if (!managed.has(r.user_id)) managed.set(r.user_id, []);
            managed.get(r.user_id).push(r.department_id);
        }
    }
    for (const r of wm) {
        if (!wss.has(r.user_id)) wss.set(r.user_id, []);
        wss.get(r.user_id).push({ workspace: r.workspace_id, role: r.role, joinedAt: r.joined_at });
    }
    for (const u of arr) {
        if (!u) continue;
        const id = String(u._id);
        u.departments = deps.get(id) || [];
        u.managedDepartments = managed.get(id) || [];
        u.workspaces = wss.get(id) || [];
    }
    return list;
}

/** A user by id with the org arrays attached, or null. */
async function userWithOrg(id, opts = {}) {
    const u = await users.findById(id, opts);
    if (u) await withOrg(u, opts);
    return u;
}

// ── Department membership writes ──────────────────────────────────────

/** Add users to a department; role 'manager' upgrades, 'member' never downgrades a manager. */
async function addDepartmentMembers(departmentId, userIds, role = 'member', { tx } = {}) {
    const ids = [...new Set((userIds || []).map(str).filter(Boolean))];
    if (!ids.length) return;
    await run(tx,
        `INSERT INTO department_members (department_id, user_id, role)
         SELECT $1, u, $3 FROM unnest($2::text[]) AS u
         ON CONFLICT (department_id, user_id) DO UPDATE SET role = CASE WHEN $3 = 'manager' THEN 'manager' ELSE department_members.role END`,
        [str(departmentId), ids, role]);
}

async function removeDepartmentMembers(departmentId, userIds, { tx } = {}) {
    await run(tx, 'DELETE FROM department_members WHERE department_id = $1 AND user_id = ANY($2)', [str(departmentId), (userIds || []).map(str)]);
}

/** Turn managers back into plain members (the manager role is dropped, membership kept). */
async function demoteDepartmentManagers(departmentId, userIds, { tx } = {}) {
    await run(tx, "UPDATE department_members SET role = 'member' WHERE department_id = $1 AND user_id = ANY($2)", [str(departmentId), (userIds || []).map(str)]);
}

/** Replace the manager set of a department (others keep membership as plain members). */
async function setDepartmentManagers(departmentId, managerIds, { tx } = {}) {
    const ids = [...new Set((managerIds || []).map(str).filter(Boolean))];
    await run(tx, "UPDATE department_members SET role = 'member' WHERE department_id = $1 AND role = 'manager' AND NOT (user_id = ANY($2))", [str(departmentId), ids]);
    await addDepartmentMembers(departmentId, ids, 'manager', { tx });
}

/** Remove a user from every department of a company (e.g. when they leave). */
async function removeUserFromCompanyDepartments(userId, companyId, { tx } = {}) {
    await run(tx, 'DELETE FROM department_members WHERE user_id = $1 AND department_id IN (SELECT id FROM departments WHERE company_id = $2)', [str(userId), str(companyId)]);
}

/** Replace a user's department set within a company. */
async function setUserDepartments(userId, companyId, departmentIds, { tx } = {}) {
    const ids = [...new Set((departmentIds || []).map(str).filter(Boolean))];
    await run(tx,
        `DELETE FROM department_members WHERE user_id = $1 AND department_id IN (SELECT id FROM departments WHERE company_id = $2) AND NOT (department_id = ANY($3))`,
        [str(userId), str(companyId), ids]);
    for (const d of ids) await addDepartmentMembers(d, [userId], 'member', { tx });
}

/** Set (or clear) which departments a user manages; keeps them as members. */
async function setUserManagedDepartments(userId, departmentIds, { tx, companyId = null } = {}) {
    const ids = [...new Set((departmentIds || []).map(str).filter(Boolean))];
    await run(tx,
        `UPDATE department_members SET role = 'member' WHERE user_id = $1 AND role = 'manager' AND NOT (department_id = ANY($2))${companyId ? ' AND department_id IN (SELECT id FROM departments WHERE company_id = $3)' : ''}`,
        companyId ? [str(userId), ids, str(companyId)] : [str(userId), ids]);
    for (const d of ids) await addDepartmentMembers(d, [userId], 'manager', { tx });
}

async function departmentMemberIds(departmentIds, { role = null, tx } = {}) {
    const ids = (Array.isArray(departmentIds) ? departmentIds : [departmentIds]).map(str).filter(Boolean);
    if (!ids.length) return [];
    const { rows } = await run(tx,
        `SELECT DISTINCT user_id FROM department_members WHERE department_id = ANY($1)${role ? ' AND role = $2' : ''}`,
        role ? [ids, role] : [ids]);
    return rows.map((r) => r.user_id);
}

/** Add a department's id to its workspaces array (idempotent). */
async function addDepartmentWorkspace(departmentId, workspaceId, { setDefault = false, tx } = {}) {
    await run(tx,
        `UPDATE departments SET workspaces = CASE WHEN $2 = ANY(workspaces) THEN workspaces ELSE array_append(workspaces, $2) END,
            default_workspace_id = CASE WHEN $3 THEN $2 ELSE default_workspace_id END, updated_at = now() WHERE id = $1`,
        [str(departmentId), str(workspaceId), !!setDefault]);
}

/** Set a user's company id (and role) — used when a user joins or leaves a company. */
async function setUserCompany(userId, { companyId, companyRole, userType }, { tx } = {}) {
    const patch = {};
    if (companyId !== undefined) patch.companyId = companyId ? str(companyId) : null;
    if (companyRole !== undefined) patch.companyRole = companyRole;
    if (userType !== undefined) patch.userType = userType;
    const { sets, params, next } = buildUpdate(patch, users.COLUMNS);
    if (!sets.length) return;
    await run(tx, `UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${next}`, [...params, str(userId)]);
}

// ── Reports ───────────────────────────────────────────────────────────

/** Counts for one company: users by status/role, online, workspaces, departments, teams. */
async function companyUserStats(companyId, { since = null } = {}) {
    const cid = str(companyId);
    const [{ rows: [u] }, { rows: [w] }, { rows: [d] }, { rows: [t] }] = await Promise.all([
        query(`SELECT
                count(*)::int AS total,
                count(*) FILTER (WHERE account_status = 'active')::int AS active,
                count(*) FILTER (WHERE account_status = 'suspended')::int AS suspended,
                count(*) FILTER (WHERE account_status = 'removed')::int AS removed,
                count(*) FILTER (WHERE account_status = 'invited' OR (verified = false AND account_status <> 'removed'))::int AS pending,
                count(*) FILTER (WHERE is_online AND account_status <> 'removed')::int AS online,
                count(*) FILTER (WHERE company_role = 'owner')::int AS owners,
                count(*) FILTER (WHERE company_role = 'admin')::int AS admins,
                count(*) FILTER (WHERE company_role = 'manager')::int AS managers,
                count(*) FILTER (WHERE company_role = 'member')::int AS members,
                count(*) FILTER (WHERE company_role = 'guest')::int AS guests,
                count(*) FILTER (WHERE $2::timestamptz IS NOT NULL AND created_at >= $2)::int AS new_since,
                count(*) FILTER (WHERE $2::timestamptz IS NOT NULL AND last_activity_at >= $2 AND account_status <> 'removed')::int AS active_since
               FROM users WHERE company_id = $1`, [cid, since]),
        query('SELECT count(*)::int AS total, count(*) FILTER (WHERE is_archived)::int AS archived FROM workspaces WHERE company_id = $1 AND is_active = true', [cid]),
        query('SELECT count(*)::int AS total FROM departments WHERE company_id = $1 AND is_active = true', [cid]),
        query('SELECT count(*)::int AS total FROM teams WHERE company_id = $1 AND is_active = true', [cid]),
    ]);
    return {
        users: { total: u.total, active: u.active, suspended: u.suspended, removed: u.removed, pending: u.pending, online: u.online, newSince: u.new_since, activeSince: u.active_since },
        roles: { owner: u.owners, admin: u.admins, manager: u.managers, member: u.members, guest: u.guests },
        workspaces: { total: w.total, archived: w.archived },
        departments: d.total,
        teams: t.total,
    };
}

/** New users per period for a company (or all companies when companyId is null). */
async function userGrowth({ companyId = null, since, unit = 'day' } = {}) {
    const u = ['day', 'week', 'month'].includes(unit) ? unit : 'day';
    const params = [since || new Date(Date.now() - 30 * 86400000)];
    let where = 'created_at >= $1';
    if (companyId) { params.push(str(companyId)); where += ` AND company_id = $${params.length}`; }
    const { rows } = await query(
        `SELECT date_trunc('${u}', created_at) AS period, count(*)::int AS count FROM users WHERE ${where} GROUP BY 1 ORDER BY 1`, params);
    return rows.map((r) => ({ period: r.period, count: r.count }));
}

/** Members per department of a company: [{ _id, name, members, managers }]. */
async function departmentSizes(companyId) {
    const { rows } = await query(
        `SELECT d.id, d.name, count(m.user_id)::int AS members, count(m.user_id) FILTER (WHERE m.role = 'manager')::int AS managers
         FROM departments d LEFT JOIN department_members m ON m.department_id = d.id
         LEFT JOIN users u ON u.id = m.user_id AND u.account_status <> 'removed'
         WHERE d.company_id = $1 AND d.is_active = true GROUP BY d.id, d.name ORDER BY d.name`, [str(companyId)]);
    return rows.map((r) => ({ _id: r.id, name: r.name, members: r.members, managers: r.managers }));
}

/** Users per role in a company: { owner: n, admin: n, ... }. */
async function roleDistribution(companyId) {
    const { rows } = await query(
        "SELECT company_role AS role, count(*)::int AS n FROM users WHERE company_id = $1 AND account_status <> 'removed' GROUP BY 1", [str(companyId)]);
    return Object.fromEntries(rows.map((r) => [r.role || 'member', r.n]));
}

/** Platform-wide counts for the platform admin. */
async function platformStats({ since = null } = {}) {
    const { rows: [r] } = await query(`SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM users WHERE account_status = 'active') AS active_users,
        (SELECT count(*)::int FROM users WHERE is_online) AS online_users,
        (SELECT count(*)::int FROM users WHERE $1::timestamptz IS NOT NULL AND created_at >= $1) AS new_users,
        (SELECT count(*)::int FROM companies) AS companies,
        (SELECT count(*)::int FROM companies WHERE verification_status = 'verified') AS verified_companies,
        (SELECT count(*)::int FROM companies WHERE verification_status = 'pending') AS pending_companies,
        (SELECT count(*)::int FROM companies WHERE verification_status = 'rejected') AS rejected_companies,
        (SELECT count(*)::int FROM companies WHERE is_active) AS active_companies,
        (SELECT count(*)::int FROM departments) AS departments,
        (SELECT count(*)::int FROM workspaces) AS workspaces`, [since]);
    return {
        users: r.users, activeUsers: r.active_users, onlineUsers: r.online_users, newUsers: r.new_users,
        companies: r.companies, verifiedCompanies: r.verified_companies, pendingCompanies: r.pending_companies,
        rejectedCompanies: r.rejected_companies, activeCompanies: r.active_companies,
        departments: r.departments, workspaces: r.workspaces,
    };
}

/** Users and workspaces per company, for company lists: Map(companyId → { users, activeUsers, workspaces }). */
async function companyCounts(companyIds) {
    const ids = (companyIds || []).map(str).filter(Boolean);
    if (!ids.length) return new Map();
    const [{ rows: u }, { rows: w }] = await Promise.all([
        query(`SELECT company_id, count(*)::int AS users, count(*) FILTER (WHERE account_status = 'active')::int AS active
               FROM users WHERE company_id = ANY($1) GROUP BY 1`, [ids]),
        query('SELECT company_id, count(*)::int AS n FROM workspaces WHERE company_id = ANY($1) AND is_active = true GROUP BY 1', [ids]),
    ]);
    const out = new Map(ids.map((id) => [id, { users: 0, activeUsers: 0, workspaces: 0 }]));
    for (const r of u) Object.assign(out.get(r.company_id), { users: r.users, activeUsers: r.active });
    for (const r of w) out.get(r.company_id).workspaces = r.n;
    return out;
}

/** Workspace member counts: Map(workspaceId → active member count). */
async function workspaceMemberCounts(workspaceIds) {
    const ids = (workspaceIds || []).map(str).filter(Boolean);
    if (!ids.length) return new Map();
    const { rows } = await query("SELECT workspace_id, count(*)::int AS n FROM workspace_members WHERE workspace_id = ANY($1) AND status = 'active' GROUP BY 1", [ids]);
    return new Map(rows.map((r) => [r.workspace_id, r.n]));
}

/** True when making `managerId` the manager of `employeeId` would close a loop (one recursive query). */
async function wouldCreateReportingLoop(employeeId, managerId) {
    if (String(employeeId) === String(managerId)) return true;
    const { rows } = await query(
        `WITH RECURSIVE chain(id, depth) AS (
            SELECT $1::text, 0
            UNION ALL
            SELECT u.reports_to, c.depth + 1 FROM chain c JOIN users u ON u.id = c.id
            WHERE u.reports_to IS NOT NULL AND c.depth < 500
         ) SELECT 1 FROM chain WHERE id = $2 LIMIT 1`,
        [str(managerId), str(employeeId)]);
    return rows.length > 0;
}

/** Active login sessions in a company since `since`, newest first, with the user's name and email. */
async function companySessions(companyId, { since, limit = 50 } = {}) {
    const { rows } = await query(
        `SELECT s.*, u.username, u.email FROM user_sessions s JOIN users u ON u.id = s.user_id
         WHERE s.company_id = $1 AND s.is_active = true AND s.last_activity_at >= $2
         ORDER BY s.last_activity_at DESC LIMIT $3`,
        [str(companyId), since || new Date(0), limit]);
    return rows.map((r) => ({ ...camelRow(r), userId: { _id: r.user_id, username: r.username, email: r.email } }));
}

/** Expire a person's not-yet-accepted invites to a company (before a resend). */
async function expirePendingInvites(email, companyId) {
    const { rowCount } = await query(
        `UPDATE invites SET expires_at = now() WHERE lower(email) = lower($1) AND company_id = $2 AND accepted_at IS NULL`,
        [String(email), str(companyId)]);
    return rowCount;
}

/** Direct reports of a manager in a company, and the reverse chain. */
async function directReports(userId, companyId, opts = {}) {
    return q.users.find({ reportsTo: str(userId), companyId: str(companyId), accountStatus: { $ne: 'removed' } }, opts);
}

module.exports = {
    ...q,
    insert, updateUser, flattenUser, packUserPatch, updateCompany, flattenCompany, publicCompany, packCompany, addWorkspaceMembers, addCompanyAdmin, addUserEmail, userIdsByAnyEmail,
    toWhere, project, withOrg, userWithOrg,
    addDepartmentMembers, removeDepartmentMembers, demoteDepartmentManagers, setDepartmentManagers,
    removeUserFromCompanyDepartments, setUserDepartments, setUserManagedDepartments, departmentMemberIds, addDepartmentWorkspace,
    setUserCompany,
    companyUserStats, userGrowth, departmentSizes, roleDistribution, platformStats, companyCounts, workspaceMemberCounts, directReports, wouldCreateReportingLoop, expirePendingInvites, companySessions,
};
