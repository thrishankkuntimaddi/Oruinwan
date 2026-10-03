'use strict';

/**
 * Users on PostgreSQL (migration 0006_identity). Returns plain objects with the
 * camelCase field names the rest of the server already uses (`_id`, `companyId`,
 * `companyRole`, `profile`, `preferences`, ...), never secrets unless asked.
 */

const { query, withTransaction } = require('../shared/postgres');
const { newId, buildUpdate, columnsFor, insertSql, camelRow, str } = require('./sql');

const COLUMNS = {
    _id: 'id', id: 'id',
    username: 'username', email: 'email', personalEmail: 'personal_email', companyEmail: 'company_email',
    phone: 'phone', phoneCode: 'phone_code', passwordHash: 'password_hash', userType: 'user_type',
    companyId: 'company_id', companyRole: 'company_role', coOwnerOf: 'co_owner_of', reportsTo: 'reports_to',
    jobTitle: 'job_title', joiningDate: 'joining_date', employeeCategory: 'employee_category',
    personalWorkspace: 'personal_workspace_id', roles: 'roles', verified: 'verified', accountStatus: 'account_status',
    isActive: 'is_active', deactivatedAt: 'deactivated_at', suspension: 'suspension', authProvider: 'auth_provider',
    googleId: 'google_id', githubId: 'github_id', linkedinId: 'linkedin_id', sso: 'sso', passwordFlags: 'password_flags',
    twoFactorEnabled: 'two_factor_enabled', twoFactorSecret: 'two_factor_secret',
    failedLoginAttempts: 'failed_login_attempts', lockedUntil: 'locked_until', loginGuard: 'login_guard', tokens: 'tokens',
    profilePicture: 'profile_picture', profilePictureGcsPath: 'profile_picture_path', profile: 'profile',
    preferences: 'preferences', permissions: 'permissions', rolesPerCompany: 'roles_per_company', encryption: 'encryption',
    social: 'social', deviceTokens: 'device_tokens', legalHold: 'legal_hold', retentionDays: 'retention_days',
    lastLoginMethod: 'last_login_method', lastLoginMethodAt: 'last_login_method_at', lastLoginAt: 'last_login_at',
    lastActivityAt: 'last_activity_at', isOnline: 'is_online', userStatus: 'user_status', workHistory: 'work_history',
    createdAt: 'created_at', updatedAt: 'updated_at',
};

const SECRET_FIELDS = ['passwordHash', 'twoFactorSecret', 'tokens', 'deviceTokens'];

function toUser(row, { withSecrets = false } = {}) {
    const u = camelRow(row);
    if (!u) return null;
    u.profilePictureGcsPath = u.profilePicturePath; delete u.profilePicturePath;
    u.personalWorkspace = u.personalWorkspaceId; delete u.personalWorkspaceId;
    // Flattened flags the auth code reads directly.
    const pf = u.passwordFlags || {};
    u.passwordSetAt = pf.setAt || null;
    u.passwordLoginEnabled = pf.loginEnabled !== false;
    u.passwordSkipped = !!pf.skipped;
    u.isTemporaryPassword = !!pf.temporary;
    u.passwordInitialized = !!pf.initialized;
    u.ssoProvider = u.sso?.provider || null;
    u.ssoId = u.sso?.id || null;
    if (!withSecrets) for (const f of SECRET_FIELDS) delete u[f];
    return u;
}

const SELECT = 'SELECT * FROM users';

async function findById(id, opts) {
    const { rows } = await query(`${SELECT} WHERE id = $1`, [str(id)]);
    return toUser(rows[0], opts);
}

async function findByEmail(email, opts) {
    const { rows } = await query(`${SELECT} WHERE lower(email) = lower($1)`, [String(email)]);
    return toUser(rows[0], opts);
}

async function findByUsername(username, opts) {
    const { rows } = await query(`${SELECT} WHERE lower(username) = lower($1)`, [String(username)]);
    return toUser(rows[0], opts);
}

async function findByPhone(phone, opts) {
    const { rows } = await query(`${SELECT} WHERE phone = $1`, [String(phone)]);
    return toUser(rows[0], opts);
}

async function findByProvider(provider, providerId, opts) {
    const col = { google: 'google_id', github: 'github_id', linkedin: 'linkedin_id' }[provider];
    if (!col) return null;
    const { rows } = await query(`${SELECT} WHERE ${col} = $1`, [String(providerId)]);
    return toUser(rows[0], opts);
}

/** Map id → user for a list of ids (one query), used to hydrate references from other stores. */
async function findManyByIds(ids, opts) {
    const unique = [...new Set((ids || []).map(str).filter(Boolean))];
    if (!unique.length) return new Map();
    const { rows } = await query(`${SELECT} WHERE id = ANY($1)`, [unique]);
    return new Map(rows.map((r) => [r.id, toUser(r, opts)]));
}

async function exists(filter) {
    if (filter.email) return !!(await findByEmail(filter.email));
    if (filter.username) return !!(await findByUsername(filter.username));
    if (filter.phone) return !!(await findByPhone(filter.phone));
    if (filter._id || filter.id) return !!(await findById(filter._id || filter.id));
    return false;
}

async function create(user) {
    const id = str(user._id || user.id) || newId();
    const data = { ...user, _id: undefined, id, profile: { name: user.username, ...(user.profile || {}) } };
    const { cols, params } = columnsFor(data, COLUMNS);
    return withTransaction(async (tx) => {
        const { rows } = await tx.query(insertSql('users', cols), params);
        await tx.query(
            `INSERT INTO user_emails (id, user_id, email, verified, is_primary) VALUES ($1, $2, $3, $4, true)
             ON CONFLICT (user_id, email) DO NOTHING`,
            [newId(), id, data.email, !!data.verified]
        );
        return toUser(rows[0]);
    });
}

/** Partial update with Mongo-style camelCase keys; jsonb keys accept `{ $merge: true, ...fields }`. */
async function update(id, patch, opts) {
    const { sets, params, next } = buildUpdate(patch, COLUMNS);
    if (!sets.length) return findById(id, opts);
    sets.push('updated_at = now()');
    const { rows } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${next} RETURNING *`, [...params, str(id)]);
    return toUser(rows[0], opts);
}

async function setOnline(id, isOnline) {
    await query('UPDATE users SET is_online = $2, last_activity_at = now() WHERE id = $1', [str(id), !!isOnline]);
}

async function touchActivity(id) {
    await query('UPDATE users SET last_activity_at = now() WHERE id = $1', [str(id)]);
}

async function recordLogin(id, { method = 'password' } = {}) {
    await query(
        `UPDATE users SET last_login_at = now(), last_login_method = $2, last_login_method_at = now(),
            failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
        [str(id), method]
    );
}

/** Returns the new attempt count and whether the account is now locked (5 wrong tries → 15 minutes). */
async function recordFailedLogin(id) {
    const { rows } = await query(
        `UPDATE users SET
            failed_login_attempts = CASE WHEN failed_login_attempts + 1 >= 5 THEN 0 ELSE failed_login_attempts + 1 END,
            locked_until = CASE WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END
         WHERE id = $1 RETURNING failed_login_attempts, locked_until`,
        [str(id)]
    );
    const r = rows[0] || {};
    return { attempts: r.failed_login_attempts, lockedUntil: r.locked_until, locked: !!(r.locked_until && r.locked_until > new Date()) };
}

// ── Refresh tokens ────────────────────────────────────────────────────
async function addRefreshToken(userId, { tokenHash, expiresAt, deviceInfo = null, ip = null, startedAt = new Date() }) {
    await query(
        `INSERT INTO user_refresh_tokens (token_hash, user_id, expires_at, device_info, ip, started_at)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (token_hash) DO NOTHING`,
        [tokenHash, str(userId), expiresAt, deviceInfo, ip, startedAt]
    );
}

async function findByRefreshTokenHash(tokenHash, opts) {
    const { rows } = await query(
        `SELECT u.*, t.expires_at AS token_expires_at, t.started_at AS token_started_at
         FROM user_refresh_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1`,
        [tokenHash]
    );
    if (!rows[0]) return null;
    const { token_expires_at: expiresAt, token_started_at: startedAt, ...userRow } = rows[0];
    return Object.assign(toUser(userRow, opts), { refreshToken: { expiresAt, startedAt } });
}

async function expireRefreshToken(tokenHash, at = new Date()) {
    await query('UPDATE user_refresh_tokens SET expires_at = $2 WHERE token_hash = $1', [tokenHash, at]);
}

async function deleteRefreshToken(tokenHash) {
    await query('DELETE FROM user_refresh_tokens WHERE token_hash = $1', [tokenHash]);
}

async function pruneRefreshTokens(userId) {
    await query('DELETE FROM user_refresh_tokens WHERE user_id = $1 AND expires_at <= now()', [str(userId)]);
}

async function deleteAllRefreshTokens(userId) {
    await query('DELETE FROM user_refresh_tokens WHERE user_id = $1', [str(userId)]);
}

async function listRefreshTokens(userId) {
    const { rows } = await query('SELECT * FROM user_refresh_tokens WHERE user_id = $1 AND expires_at > now() ORDER BY started_at', [str(userId)]);
    return rows.map((r) => camelRow(r));
}

// ── One-time codes ────────────────────────────────────────────────────
async function addOtp(userId, { code, type, expiresAt }) {
    await query('INSERT INTO user_otp_codes (user_id, code, type, expires_at) VALUES ($1, $2, $3, $4)', [str(userId), code, type, expiresAt]);
}

/** Mark a live code used; returns true when it matched. */
async function consumeOtp(userId, { code, type }) {
    const { rowCount } = await query(
        `UPDATE user_otp_codes SET used = true WHERE id = (
            SELECT id FROM user_otp_codes WHERE user_id = $1 AND code = $2 AND type = $3 AND used = false AND expires_at > now()
            ORDER BY created_at DESC LIMIT 1)`,
        [str(userId), code, type]
    );
    return rowCount > 0;
}

// ── Company member lists ──────────────────────────────────────────────
function memberFilter(companyId, { status, role, search } = {}, startAt = 2) {
    const where = ['company_id = $1'];
    const params = [str(companyId)];
    let n = startAt;
    if (status) { where.push(`account_status = $${n}`); params.push(status); n += 1; }
    if (role) { where.push(`company_role = $${n}`); params.push(role); n += 1; }
    if (search) { where.push(`(username ILIKE $${n} OR email ILIKE $${n})`); params.push(`%${search}%`); n += 1; }
    return { where: where.join(' AND '), params, next: n };
}

async function countByCompany(companyId, filter) {
    const f = memberFilter(companyId, filter);
    const { rows } = await query(`SELECT count(*)::int AS n FROM users WHERE ${f.where}`, f.params);
    return rows[0].n;
}

async function listByCompany(companyId, { limit = 50, skip = 0, ...filter } = {}) {
    const f = memberFilter(companyId, filter);
    const { rows } = await query(
        `${SELECT} WHERE ${f.where} ORDER BY username LIMIT $${f.next} OFFSET $${f.next + 1}`,
        [...f.params, limit, skip]
    );
    return rows.map((r) => toUser(r));
}

async function listByIdsInCompany(companyId, ids) {
    const { rows } = await query(`${SELECT} WHERE company_id = $1 AND id = ANY($2)`, [str(companyId), ids.map(str)]);
    return rows.map((r) => toUser(r));
}

async function remove(id) {
    await query('DELETE FROM users WHERE id = $1', [str(id)]);
}

module.exports = {
    COLUMNS, toUser,
    findById, findByEmail, findByUsername, findByPhone, findByProvider, findManyByIds, exists,
    create, update, remove, setOnline, touchActivity, recordLogin, recordFailedLogin,
    addRefreshToken, findByRefreshTokenHash, expireRefreshToken, deleteRefreshToken, pruneRefreshTokens, deleteAllRefreshTokens, listRefreshTokens,
    addOtp, consumeOtp,
    countByCompany, listByCompany, listByIdsInCompany,
};
