'use strict';

/**
 * Auth-specific identity queries on PostgreSQL.
 *
 * `userDocs` loads a user as one mutable object shaped like the old Mongo
 * document (emails, refreshTokens and otpCodes as arrays, flat token and
 * password fields, workspaces/departments from their membership tables) with
 * a `save()` that writes back only what changed. The auth flows mutate many
 * fields across one request (login lockout, OTPs, email lists, profile
 * edits); keeping that shape keeps those flows reviewable line by line.
 * Concurrency-sensitive paths (refresh rotation) use the row-level repo calls
 * instead of whole-document saves.
 *
 * Also here: invites (table `invites`) and a few company lookups signup needs.
 */

const { query, withTransaction } = require('../../shared/postgres');
const users = require('../users.repo');
const companies = require('../companies.repo');
const { newId, camelRow, str } = require('../sql');

const DATE_FIELDS = ['verificationTokenExpires', 'resetPasswordExpires', 'inviteTokenExpiry', 'lastUnverifiedLoginAttempt',
    'lastVerificationEmailSent', 'suspendedAt', 'legalHoldAt', 'passwordSetAt'];
const toDate = (v) => (v == null || v === '' ? v : (v instanceof Date ? v : new Date(v)));
const REF_FIELDS = ['companyId', 'coOwnerOf', 'reportsTo', 'personalWorkspace'];
const idOf = (v) => (v == null ? null : String(v._id || v));

// Column-backed keys (users.repo COLUMNS) that a doc may change, minus composite ones handled below.
const PLAIN_KEYS = Object.keys(users.COLUMNS).filter((k) => !['_id', 'id', 'createdAt', 'updatedAt', 'passwordFlags', 'sso', 'tokens',
    'loginGuard', 'suspension', 'legalHold', 'social'].includes(k));

/** Row (camelCase, with secrets) + child rows → Mongo-shaped document. */
function expand(u, { emails = [], refreshTokens = [], otpCodes = [], workspaces = [], departments = [] } = {}) {
    const t = u.tokens || {};
    const g = u.loginGuard || {};
    const s = u.suspension || {};
    const lh = u.legalHold || {};
    const so = u.social || {};
    const doc = {
        ...u,
        passwordSetAt: u.passwordSetAt,
        verificationTokenHash: t.verificationTokenHash, verificationTokenExpires: t.verificationTokenExpires,
        resetPasswordTokenHash: t.resetPasswordTokenHash, resetPasswordExpires: t.resetPasswordExpires,
        inviteToken: t.inviteToken, inviteTokenExpiry: t.inviteTokenExpiry,
        unverifiedLoginAttempts: g.unverifiedLoginAttempts || 0, lastUnverifiedLoginAttempt: g.lastUnverifiedLoginAttempt,
        lastVerificationEmailSent: g.lastVerificationEmailSent,
        suspendedAt: s.suspendedAt, suspendedBy: s.suspendedBy, suspensionReason: s.suspensionReason,
        legalHold: !!lh.enabled, legalHoldReason: lh.reason, legalHoldSetBy: lh.setBy, legalHoldAt: lh.at,
        favorites: so.favorites || [], blockedUsers: so.blockedUsers || [], mutedChats: so.mutedChats || [],
        deviceTokens: Array.isArray(u.deviceTokens) ? u.deviceTokens : [],
        devices: Array.isArray(so.devices) ? so.devices : [],
        googleAccount: !!(u.passwordFlags || {}).googleAccount,
        profile: u.profile || {},
        preferences: u.preferences || {},
        emails: emails.map((e) => ({ _id: e.id, email: e.email, verified: e.verified, isPrimary: e.is_primary,
            verificationTokenHash: e.token_hash || undefined, verificationTokenExpires: e.token_expires || undefined, addedAt: e.added_at })),
        // Sessions are listed and revoked by `_id`; a prefix of the stored hash is stable and reveals nothing.
        refreshTokens: refreshTokens.map((r) => ({ _id: r.token_hash.slice(0, 24), tokenHash: r.token_hash, expiresAt: r.expires_at, deviceInfo: r.device_info,
            ip: r.ip, startedAt: r.started_at, createdAt: r.created_at })),
        otpCodes: otpCodes.map((o) => ({ _id: String(o.id), code: o.code, type: o.type, expiresAt: o.expires_at, used: o.used })),
        workspaces: workspaces.map((w) => ({ workspace: w.workspace_id, role: w.role, joinedAt: w.joined_at })),
        departments: departments.map((d) => d.department_id),
        managedDepartments: departments.filter((d) => d.role === 'manager').map((d) => d.department_id),
    };
    for (const f of DATE_FIELDS) if (doc[f] != null) doc[f] = toDate(doc[f]);
    delete doc.tokens; delete doc.loginGuard; delete doc.suspension; delete doc.social;
    return doc;
}

/** Document → column-keyed object for users.update / users.create. */
function collapse(doc) {
    const out = {};
    for (const k of PLAIN_KEYS) if (doc[k] !== undefined) out[k] = doc[k];
    for (const k of REF_FIELDS) if (k in out) out[k] = out[k] == null ? null : idOf(out[k]);
    if (out.preferences && typeof out.preferences.toObject === 'function') out.preferences = out.preferences.toObject();
    out.passwordFlags = {
        setAt: doc.passwordSetAt || null, loginEnabled: doc.passwordLoginEnabled !== false, skipped: !!doc.passwordSkipped,
        temporary: !!doc.isTemporaryPassword, initialized: !!doc.passwordInitialized, googleAccount: !!doc.googleAccount,
    };
    // The old schema kept profile.name in step with username on every save.
    if (doc.username) out.profile = { ...(out.profile || {}), name: doc.username };
    out.sso = doc.ssoProvider || doc.ssoId ? { provider: doc.ssoProvider || null, id: doc.ssoId || null } : null;
    out.tokens = {
        verificationTokenHash: doc.verificationTokenHash, verificationTokenExpires: doc.verificationTokenExpires,
        resetPasswordTokenHash: doc.resetPasswordTokenHash, resetPasswordExpires: doc.resetPasswordExpires,
        inviteToken: doc.inviteToken, inviteTokenExpiry: doc.inviteTokenExpiry,
    };
    out.loginGuard = {
        unverifiedLoginAttempts: doc.unverifiedLoginAttempts || 0, lastUnverifiedLoginAttempt: doc.lastUnverifiedLoginAttempt,
        lastVerificationEmailSent: doc.lastVerificationEmailSent,
    };
    out.suspension = doc.suspendedAt || doc.suspendedBy || doc.suspensionReason
        ? { suspendedAt: doc.suspendedAt || null, suspendedBy: idOf(doc.suspendedBy), suspensionReason: doc.suspensionReason || null } : null;
    out.legalHold = doc.legalHold || doc.legalHoldReason
        ? { enabled: !!doc.legalHold, reason: doc.legalHoldReason || null, setBy: idOf(doc.legalHoldSetBy), at: doc.legalHoldAt || null } : null;
    out.social = { favorites: doc.favorites || [], blockedUsers: doc.blockedUsers || [], mutedChats: doc.mutedChats || [], devices: doc.devices || [] };
    out.deviceTokens = doc.deviceTokens || [];
    return out;
}

const SECRET = ['passwordHash', 'refreshTokens', 'twoFactorSecret', 'otpCodes', 'inviteToken', 'resetPasswordTokenHash', 'verificationTokenHash', 'deviceTokens'];
const json = (v) => JSON.stringify(v === undefined ? null : v);

/** Mongoose sub-document array helpers the auth code uses: emails.id(x), emails.pull(x); push assigns an _id. */
function decorateArray(arr) {
    if (!Array.isArray(arr) || arr.__decorated) return arr;
    const def = (name, value) => Object.defineProperty(arr, name, { value, enumerable: false, configurable: true, writable: true });
    def('__decorated', true);
    def('id', (x) => arr.find((e) => e && String(e._id) === String(x)) || null);
    def('pull', (x) => {
        const target = String(x && x._id ? x._id : x);
        for (let i = arr.length - 1; i >= 0; i -= 1) if (arr[i] && String(arr[i]._id) === target) arr.splice(i, 1);
        return arr;
    });
    def('push', (...items) => {
        for (const it of items) if (it && typeof it === 'object' && !it._id) it._id = newId();
        return Array.prototype.push.apply(arr, items);
    });
    return arr;
}

function attachMethods(doc, snapshot) {
    for (const k of ['emails', 'otpCodes', 'refreshTokens']) doc[k] = decorateArray(doc[k] || []);
    const hidden = (name, value) => Object.defineProperty(doc, name, { value, enumerable: false, writable: true, configurable: true });
    hidden('__snapshot', snapshot);
    hidden('isNew', !snapshot);
    hidden('markModified', () => {});
    // Mongoose-style dotted path setter/getter used by the preference endpoints.
    hidden('set', (path, value) => {
        const parts = String(path).split('.');
        let o = doc;
        for (const p of parts.slice(0, -1)) { if (o[p] == null || typeof o[p] !== 'object') o[p] = {}; o = o[p]; }
        o[parts[parts.length - 1]] = value;
        return doc;
    });
    hidden('get', (path) => String(path).split('.').reduce((o, p) => (o == null ? undefined : o[p]), doc));
    hidden('toObject', () => {
        const o = {};
        for (const k of Object.keys(doc)) if (typeof doc[k] !== 'function') o[k] = doc[k];
        return o;
    });
    hidden('toJSON', () => {
        const o = doc.toObject();
        for (const f of SECRET) delete o[f];
        if (o.encryption && typeof o.encryption === 'object') { o.encryption = { ...o.encryption }; delete o.encryption.encryptedPrivateKey; }
        if (Array.isArray(o.emails)) o.emails = o.emails.map(({ verificationTokenHash: _h, verificationTokenExpires: _x, ...e }) => e);
        return o;
    });
    hidden('save', () => saveDoc(doc));
    return doc;
}

function snapshotOf(doc) {
    const c = collapse(doc);
    return {
        cols: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, json(v)])),
        emails: json(doc.emails), refreshTokens: json(doc.refreshTokens), otpCodes: json(doc.otpCodes),
        workspaces: (doc.workspaces || []).map((w) => idOf(w.workspace)),
        departments: [...(doc.departments || []).map(idOf)],
    };
}

async function loadChildren(userId) {
    const [emails, tokens, otps, ws, deps] = await Promise.all([
        query('SELECT * FROM user_emails WHERE user_id = $1 ORDER BY added_at', [userId]),
        query('SELECT * FROM user_refresh_tokens WHERE user_id = $1 ORDER BY created_at', [userId]),
        query('SELECT * FROM user_otp_codes WHERE user_id = $1 ORDER BY created_at', [userId]),
        query("SELECT workspace_id, role, joined_at FROM workspace_members WHERE user_id = $1 AND status = 'active' ORDER BY joined_at", [userId]),
        query('SELECT department_id, role FROM department_members WHERE user_id = $1', [userId]),
    ]);
    return { emails: emails.rows, refreshTokens: tokens.rows, otpCodes: otps.rows, workspaces: ws.rows, departments: deps.rows };
}

async function docFromRow(row) {
    if (!row) return null;
    const u = users.toUser(row, { withSecrets: true });
    const doc = expand(u, await loadChildren(u._id));
    return attachMethods(doc, snapshotOf(doc));
}

async function saveDoc(doc) {
    // ── new user ──
    if (!doc.__snapshot) {
        const c = collapse(doc);
        const created = await users.create({ ...c, _id: doc._id, userType: c.userType || 'personal' });
        doc._id = created._id;
        doc.id = created._id;
        const fresh = await docFromRow((await query('SELECT * FROM users WHERE id = $1', [created._id])).rows[0]);
        // Children supplied at creation (extra emails, workspaces, departments) are written below.
        fresh.__snapshot.emails = json(fresh.emails);
        const pending = { ...doc };
        Object.assign(doc, fresh, {
            workspaces: pending.workspaces || [], departments: pending.departments || [],
            refreshTokens: pending.refreshTokens || [], otpCodes: pending.otpCodes || [],
            emails: pending.emails && pending.emails.length ? pending.emails : fresh.emails,
        });
        Object.defineProperty(doc, '__snapshot', { value: fresh.__snapshot, enumerable: false, writable: true, configurable: true });
        Object.defineProperty(doc, 'isNew', { value: false, enumerable: false, writable: true, configurable: true });
    }
    const snap = doc.__snapshot;
    const id = String(doc._id);
    const c = collapse(doc);
    const patch = {};
    for (const [k, v] of Object.entries(c)) if (json(v) !== snap.cols[k]) patch[k] = v;

    await withTransaction(async (tx) => {
        if (Object.keys(patch).length) {
            const { buildUpdate } = require('../sql');
            const { sets, params, next } = buildUpdate(patch, users.COLUMNS);
            if (sets.length) await tx.query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${next}`, [...params, id]);
        }
        if (json(doc.emails) !== snap.emails) {
            for (const e of doc.emails) if (!e._id) e._id = newId();
            await tx.query('DELETE FROM user_emails WHERE user_id = $1', [id]);
            for (const e of doc.emails) {
                await tx.query(
                    `INSERT INTO user_emails (id, user_id, email, verified, is_primary, token_hash, token_expires, added_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id, email) DO NOTHING`,
                    [String(e._id), id, String(e.email).toLowerCase(), !!e.verified, !!e.isPrimary, e.verificationTokenHash || null,
                        e.verificationTokenExpires || null, e.addedAt || new Date()]
                );
            }
        }
        if (json(doc.refreshTokens) !== snap.refreshTokens) {
            const keep = (doc.refreshTokens || []).map((t) => t.tokenHash);
            await tx.query('DELETE FROM user_refresh_tokens WHERE user_id = $1 AND NOT (token_hash = ANY($2))', [id, keep]);
            for (const t of doc.refreshTokens || []) {
                await tx.query(
                    `INSERT INTO user_refresh_tokens (token_hash, user_id, expires_at, device_info, ip, started_at)
                     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
                    [t.tokenHash, id, t.expiresAt, t.deviceInfo || null, t.ip || null, t.startedAt || t.createdAt || new Date()]
                );
            }
        }
        if (json(doc.otpCodes) !== snap.otpCodes) {
            await tx.query('DELETE FROM user_otp_codes WHERE user_id = $1', [id]);
            for (const o of doc.otpCodes || []) {
                await tx.query('INSERT INTO user_otp_codes (user_id, code, type, expires_at, used) VALUES ($1,$2,$3,$4,$5)',
                    [id, String(o.code), o.type, o.expiresAt, !!o.used]);
            }
        }
        for (const w of doc.workspaces || []) {
            const wid = idOf(w.workspace);
            if (wid && !snap.workspaces.includes(wid)) {
                await tx.query(
                    `INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES ($1,$2,$3,'active')
                     ON CONFLICT (workspace_id, user_id) DO UPDATE SET status = 'active', role = EXCLUDED.role, removed_at = NULL`,
                    [wid, id, w.role || 'member']
                );
            }
        }
        for (const d of doc.departments || []) {
            const did = idOf(d);
            if (did && !snap.departments.includes(did)) {
                await tx.query("INSERT INTO department_members (department_id, user_id, role) VALUES ($1,$2,'member') ON CONFLICT DO NOTHING", [did, id]);
            }
        }
    });
    Object.defineProperty(doc, '__snapshot', { value: snapshotOf(doc), enumerable: false, writable: true, configurable: true });
    return doc;
}

async function findRow(where, params) {
    const { rows } = await query(`SELECT * FROM users WHERE ${where} LIMIT 1`, params);
    return rows[0] || null;
}

const userDocs = {
    /** A new, unsaved user document (Mongo `new User({...})`). */
    build(data = {}) {
        const doc = {
            roles: ['user'], verified: false, accountStatus: 'active', isActive: true, phoneCode: '+1', userType: 'personal',
            profile: {}, preferences: {}, emails: [], refreshTokens: [], otpCodes: [], workspaces: [], departments: [],
            managedDepartments: [], favorites: [], blockedUsers: [], mutedChats: [], deviceTokens: [], devices: [],
            passwordLoginEnabled: true, failedLoginAttempts: 0,
            ...data,
        };
        doc._id = str(data._id) || newId();
        doc.id = doc._id;
        if (doc.email) doc.email = String(doc.email).toLowerCase();
        return attachMethods(doc, null);
    },
    async create(data) { const d = userDocs.build(data); await d.save(); return d; },
    async findById(id) { return id ? docFromRow(await findRow('id = $1', [idOf(id)])) : null; },
    async findByEmail(email) { return email ? docFromRow(await findRow('lower(email) = lower($1)', [String(email)])) : null; },
    async findByUsername(username) { return docFromRow(await findRow('lower(username) = lower($1)', [String(username)])); },
    async findByPhone(phone) { return docFromRow(await findRow('phone = $1', [String(phone)])); },
    async findByProvider(provider, providerId) {
        const col = { google: 'google_id', github: 'github_id', linkedin: 'linkedin_id' }[provider];
        return col ? docFromRow(await findRow(`${col} = $1`, [String(providerId)])) : null;
    },
    async findByRefreshTokenHash(hash) {
        const { rows } = await query('SELECT u.* FROM user_refresh_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1', [hash]);
        return docFromRow(rows[0]);
    },
    /** Live (unexpired) verification token on the main account email. */
    async findByVerificationToken(email, tokenHash) {
        return docFromRow(await findRow(
            "lower(email) = lower($1) AND tokens->>'verificationTokenHash' = $2", [String(email), tokenHash]
        )).then((d) => (d && d.verificationTokenExpires && d.verificationTokenExpires > new Date() ? d : null));
    },
    async findByResetToken(tokenHash) {
        return docFromRow(await findRow("tokens->>'resetPasswordTokenHash' = $1", [tokenHash]))
            .then((d) => (d && d.resetPasswordExpires && d.resetPasswordExpires > new Date() ? d : null));
    },
    async findByInviteToken(token) {
        return docFromRow(await findRow("tokens->>'inviteToken' = $1", [String(token)]));
    },
};

/** Is `email` used as the main or a secondary address by someone other than `exceptUserId`? */
async function emailTaken(email, exceptUserId = null) {
    const { rows } = await query(
        `SELECT id FROM users WHERE lower(email) = lower($1) AND ($2::text IS NULL OR id <> $2)
         UNION SELECT user_id FROM user_emails WHERE lower(email) = lower($1) AND ($2::text IS NULL OR user_id <> $2) LIMIT 1`,
        [String(email), exceptUserId ? String(exceptUserId) : null]
    );
    return rows.length > 0;
}

// ── Companies (signup auto-join) ──────────────────────────────────────
async function companyByAllowedEmail(email) {
    const { rows } = await query('SELECT id FROM companies WHERE $1 = ANY(allowed_emails) AND is_active = true LIMIT 1', [String(email).toLowerCase()]);
    return rows[0] ? companies.findById(rows[0].id) : null;
}

async function companyForAutoJoin(domain) {
    const { rows } = await query(
        'SELECT id FROM companies WHERE lower(domain) = lower($1) AND domain_verified = true AND auto_join_by_domain = true AND is_active = true LIMIT 1',
        [String(domain)]
    );
    return rows[0] ? companies.findById(rows[0].id) : null;
}

// ── Invites ───────────────────────────────────────────────────────────
// The table keeps searchable columns; the rest of the old Invite document
// (department, used/usedBy/usedAt, revocation, inviteType, metadata) is in meta.
function toInvite(row) {
    if (!row) return null;
    const m = row.meta || {};
    return {
        _id: row.id, id: row.id, email: row.email, tokenHash: row.token_hash, workspace: row.workspace_id, company: row.company_id,
        department: m.department || null, role: row.role, invitedBy: row.invited_by, status: row.status, expiresAt: row.expires_at,
        used: !!m.used, usedBy: m.usedBy || null, usedAt: m.usedAt ? new Date(m.usedAt) : null, revokedBy: m.revokedBy || null,
        revokedAt: m.revokedAt ? new Date(m.revokedAt) : null, revokeReason: m.revokeReason || null, metadata: m.metadata || {},
        inviteType: m.inviteType || 'link', createdAt: row.created_at,
    };
}

const META_KEYS = ['department', 'used', 'usedBy', 'usedAt', 'revokedBy', 'revokedAt', 'revokeReason', 'metadata', 'inviteType'];

const invites = {
    toInvite,
    async create({ email = null, tokenHash, workspace, company = null, department = null, role = 'member', invitedBy = null,
        expiresAt, metadata = {}, inviteType = 'link', status = 'pending' }) {
        const meta = { department: idOf(department), used: false, metadata, inviteType };
        const { rows } = await query(
            `INSERT INTO invites (id, company_id, workspace_id, email, role, token_hash, invited_by, status, expires_at, meta)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING *`,
            [newId(), idOf(company), idOf(workspace), email ? String(email).toLowerCase() : '', role, tokenHash, idOf(invitedBy), status, expiresAt, JSON.stringify(meta)]
        );
        return toInvite(rows[0]);
    },
    async findByTokenHash(tokenHash) {
        const { rows } = await query('SELECT * FROM invites WHERE token_hash = $1', [tokenHash]);
        return toInvite(rows[0]);
    },
    /** An unused, unexpired invite for this token and email. */
    async findUsable(tokenHash, email) {
        const { rows } = await query(
            `SELECT * FROM invites WHERE token_hash = $1 AND lower(email) = lower($2) AND COALESCE((meta->>'used')::boolean, false) = false
             AND expires_at > now()`,
            [tokenHash, String(email)]
        );
        return toInvite(rows[0]);
    },
    async update(id, patch) {
        const cols = { email: 'email', role: 'role', status: 'status', expiresAt: 'expires_at', workspace: 'workspace_id', company: 'company_id', invitedBy: 'invited_by', tokenHash: 'token_hash' };
        const sets = [];
        const params = [];
        const meta = {};
        for (const [k, v] of Object.entries(patch)) {
            if (cols[k]) { params.push(['workspace', 'company', 'invitedBy'].includes(k) ? idOf(v) : v); sets.push(`${cols[k]} = $${params.length}`); }
            else if (META_KEYS.includes(k)) meta[k] = v instanceof Date ? v.toISOString() : (['usedBy', 'revokedBy', 'department'].includes(k) ? idOf(v) : v);
        }
        if (patch.status === 'accepted') sets.push('accepted_at = now()');
        if (Object.keys(meta).length) { params.push(JSON.stringify(meta)); sets.push(`meta = meta || $${params.length}::jsonb`); }
        if (!sets.length) return invites.findById(id);
        params.push(String(id));
        const { rows } = await query(`UPDATE invites SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`, params);
        return toInvite(rows[0]);
    },
    async findById(id) {
        const { rows } = await query('SELECT * FROM invites WHERE id = $1', [String(id)]);
        return toInvite(rows[0]);
    },
    /** Every invite of a workspace, newest first. */
    async listByWorkspace(workspaceId) {
        const { rows } = await query('SELECT * FROM invites WHERE workspace_id = $1 ORDER BY created_at DESC', [idOf(workspaceId)]);
        return rows.map(toInvite);
    },
    /** The listed invites that belong to this workspace (ids from another workspace are ignored). */
    async findManyInWorkspace(workspaceId, ids) {
        const list = (ids || []).map(String);
        if (!list.length) return [];
        const { rows } = await query('SELECT * FROM invites WHERE workspace_id = $1 AND id = ANY($2)', [idOf(workspaceId), list]);
        return rows.map(toInvite);
    },
    async deleteByWorkspace(workspaceId) {
        const { rowCount } = await query('DELETE FROM invites WHERE workspace_id = $1', [idOf(workspaceId)]);
        return { deletedCount: rowCount };
    },
    /** Delete listed invites that are no longer live: revoked, accepted, used, or pending past expiry. */
    async deleteFinished(workspaceId, ids, now = new Date()) {
        const list = (ids || []).map(String);
        if (!list.length) return { deletedCount: 0 };
        const { rowCount } = await query(
            `DELETE FROM invites WHERE workspace_id = $1 AND id = ANY($2) AND (
                status IN ('revoked', 'expired', 'accepted') OR COALESCE((meta->>'used')::boolean, false) = true
                OR (status = 'pending' AND expires_at < $3))`,
            [idOf(workspaceId), list, now]
        );
        return { deletedCount: rowCount };
    },
    async deleteExpiredPending(workspaceId, now = new Date()) {
        const { rowCount } = await query("DELETE FROM invites WHERE workspace_id = $1 AND status = 'pending' AND expires_at < $2", [idOf(workspaceId), now]);
        return { deletedCount: rowCount };
    },
};

/**
 * Mongo-style `$set` of dotted paths inside a user's jsonb column, e.g.
 * { 'preferences.privacy.readReceipts': false }. Read-modify-write under a row
 * lock so concurrent preference edits do not lose each other. Returns the user.
 */
async function setUserPaths(userId, $set) {
    const COLS = { preferences: 'preferences', profile: 'profile', permissions: 'permissions' };
    return withTransaction(async (tx) => {
        const { rows } = await tx.query('SELECT preferences, profile, permissions FROM users WHERE id = $1 FOR UPDATE', [String(userId)]);
        if (!rows[0]) return null;
        const changed = new Set();
        for (const [path, value] of Object.entries($set || {})) {
            const [top, ...rest] = path.split('.');
            if (!COLS[top] || !rest.length) throw new Error(`setUserPaths: unsupported path ${path}`);
            const root = rows[0][top] || {};
            let o = root;
            for (const k of rest.slice(0, -1)) { if (o[k] == null || typeof o[k] !== 'object') o[k] = {}; o = o[k]; }
            o[rest[rest.length - 1]] = value;
            rows[0][top] = root;
            changed.add(top);
        }
        const cols = [...changed];
        if (cols.length) {
            const sets = cols.map((c, i) => `${COLS[c]} = $${i + 1}::jsonb`);
            await tx.query(`UPDATE users SET ${sets.join(', ')}, updated_at = now() WHERE id = $${cols.length + 1}`,
                [...cols.map((c) => JSON.stringify(rows[0][c])), String(userId)]);
        }
        const { rows: fresh } = await tx.query('SELECT * FROM users WHERE id = $1', [String(userId)]);
        return users.toUser(fresh[0]);
    });
}

/**
 * A user for authorization checks: the user record plus `departments` and
 * `managedDepartments` (from department_members) and `sub`, so it can stand in
 * for the JWT payload on req.user. Null when the user does not exist.
 */
async function loadAuthUser(userId) {
    if (!userId) return null;
    const user = await users.findById(String(userId));
    if (!user) return null;
    const { rows } = await query('SELECT department_id, role FROM department_members WHERE user_id = $1', [user._id]);
    user.departments = rows.map((r) => r.department_id);
    user.managedDepartments = rows.filter((r) => r.role === 'manager').map((r) => r.department_id);
    user.sub = user._id;
    return user;
}

// ── Conversation keys as mutable documents ───────────────────────────
// The E2EE key service pushes into `encryptedKeys` and saves, like the old
// ConversationKey model. The server-side wrap (key, iv, authTag) and createdBy
// are kept together in the workspace_encrypted_key jsonb column.
function toConversationKeyDoc(k) {
    if (!k) return null;
    const w = k.workspaceEncryptedKey && typeof k.workspaceEncryptedKey === 'object' ? k.workspaceEncryptedKey : {};
    const doc = {
        _id: k._id || k.id, conversationId: k.conversationId, conversationType: k.conversationType, workspaceId: k.workspaceId,
        createdBy: w.createdBy || null, workspaceEncryptedKey: w.key || null, workspaceKeyIv: w.iv || null, workspaceKeyAuthTag: w.authTag || null,
        version: k.version, isActive: true, createdAt: k.createdAt, updatedAt: k.updatedAt,
        encryptedKeys: (k.encryptedKeys || []).map((e) => ({ ...e })),
    };
    const hidden = (name, value) => Object.defineProperty(doc, name, { value, enumerable: false, writable: true, configurable: true });
    hidden('__members', new Set(doc.encryptedKeys.map((e) => String(e.userId))));
    hidden('hasAccess', (userId) => doc.encryptedKeys.some((e) => String(e.userId) === String(userId)));
    hidden('getEncryptedKeyForUser', (userId) => doc.encryptedKeys.find((e) => String(e.userId) === String(userId)) || null);
    hidden('toObject', () => ({ ...doc }));
    hidden('save', async () => {
        const { conversationKeys } = require('../keys.repo');
        const current = new Set(doc.encryptedKeys.map((e) => String(e.userId)));
        await conversationKeys.upsert({
            conversationId: doc.conversationId, conversationType: doc.conversationType, workspaceId: doc.workspaceId,
            workspaceEncryptedKey: wrapOf(doc), version: doc.version || 1,
            encryptedKeys: doc.encryptedKeys.map((e) => ({ ...e, userId: String(e.userId) })),
        });
        for (const gone of doc.__members) {
            if (!current.has(gone)) await conversationKeys.removeMemberKey(doc.conversationId, doc.conversationType, gone);
        }
        doc.__members = current;
        return doc;
    });
    return doc;
}

function wrapOf(o) {
    return o.workspaceEncryptedKey || o.createdBy
        ? { key: o.workspaceEncryptedKey || null, iv: o.workspaceKeyIv || null, authTag: o.workspaceKeyAuthTag || null, createdBy: idOf(o.createdBy) }
        : null;
}

const conversationKeyDocs = {
    async findByConversation(conversationId, conversationType) {
        const { conversationKeys } = require('../keys.repo');
        return toConversationKeyDoc(await conversationKeys.findByConversation(conversationId, conversationType));
    },
    async findByUser(userId, workspaceId) {
        const { conversationKeys } = require('../keys.repo');
        return (await conversationKeys.findByUser(userId, workspaceId)).map(toConversationKeyDoc);
    },
    /** Create; a key that already exists fails with code 11000 (as the unique index did). */
    async create(opts) {
        const existing = await conversationKeyDocs.findByConversation(opts.conversationId, opts.conversationType);
        if (existing) throw Object.assign(new Error('Conversation key already exists'), { code: 11000 });
        const { conversationKeys } = require('../keys.repo');
        const k = await conversationKeys.upsert({
            conversationId: idOf(opts.conversationId), conversationType: opts.conversationType, workspaceId: idOf(opts.workspaceId),
            workspaceEncryptedKey: wrapOf(opts), version: opts.version || 1,
            encryptedKeys: (opts.encryptedKeys || []).map((e) => ({ ...e, userId: String(e.userId) })),
        });
        return toConversationKeyDoc(k);
    },
};

module.exports = { conversationKeyDocs, loadAuthUser, setUserPaths, userDocs, emailTaken, companyByAllowedEmail, companyForAutoJoin, invites, expand, collapse, camelRow };
