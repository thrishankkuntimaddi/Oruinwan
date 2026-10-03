'use strict';

/** Device sessions and login sessions on PostgreSQL. */

const { query } = require('../shared/postgres');
const { newId, camelRow, str } = require('./sql');

const deviceSessions = {
    async upsert(userId, deviceId, { deviceName = null, platform = null, meta = {} } = {}) {
        const { rows } = await query(
            `INSERT INTO user_device_sessions (user_id, device_id, device_name, platform, meta) VALUES ($1, $2, $3, $4, $5::jsonb)
             ON CONFLICT (user_id, device_id) DO UPDATE SET device_name = COALESCE(EXCLUDED.device_name, user_device_sessions.device_name),
                platform = COALESCE(EXCLUDED.platform, user_device_sessions.platform), last_activity_at = now(), revoked = false, revoked_at = NULL
             RETURNING *`,
            [str(userId), String(deviceId), deviceName, platform, JSON.stringify(meta)]
        );
        return camelRow(rows[0]);
    },
    async isRevoked(userId, deviceId) {
        const { rows } = await query('SELECT revoked FROM user_device_sessions WHERE user_id = $1 AND device_id = $2', [str(userId), String(deviceId)]);
        return !!rows[0]?.revoked;
    },
    async touch(userId, deviceId) {
        await query('UPDATE user_device_sessions SET last_activity_at = now() WHERE user_id = $1 AND device_id = $2', [str(userId), String(deviceId)]);
    },
    async revoke(userId, deviceId) {
        await query('UPDATE user_device_sessions SET revoked = true, revoked_at = now() WHERE user_id = $1 AND device_id = $2', [str(userId), String(deviceId)]);
    },
    async revokeAllExcept(userId, deviceId) {
        await query('UPDATE user_device_sessions SET revoked = true, revoked_at = now() WHERE user_id = $1 AND device_id <> $2', [str(userId), String(deviceId || '')]);
    },
    async list(userId) {
        const { rows } = await query('SELECT * FROM user_device_sessions WHERE user_id = $1 ORDER BY last_activity_at DESC', [str(userId)]);
        return rows.map((r) => camelRow(r));
    },
};

const loginSessions = {
    async create(userId, { companyId = null, tokenHash = null, device = null, os = null, browser = null, ipAddress = null, location = null, expiresAt = null } = {}) {
        const { rows } = await query(
            `INSERT INTO user_sessions (id, user_id, company_id, token_hash, device, os, browser, ip_address, location, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [newId(), str(userId), companyId ? str(companyId) : null, tokenHash, device, os, browser, ipAddress, location, expiresAt]
        );
        return camelRow(rows[0]);
    },
    async list(userId, { activeOnly = true } = {}) {
        const { rows } = await query(`SELECT * FROM user_sessions WHERE user_id = $1${activeOnly ? ' AND is_active = true' : ''} ORDER BY last_activity_at DESC`, [str(userId)]);
        return rows.map((r) => camelRow(r));
    },
    async touchByToken(tokenHash) {
        await query('UPDATE user_sessions SET last_activity_at = now() WHERE token_hash = $1', [tokenHash]);
    },
    async revoke(id) {
        await query('UPDATE user_sessions SET is_active = false, logout_at = now() WHERE id = $1', [str(id)]);
    },
    async revokeByToken(tokenHash) {
        await query('UPDATE user_sessions SET is_active = false, logout_at = now() WHERE token_hash = $1', [tokenHash]);
    },
    async revokeAll(userId, { exceptTokenHash = null } = {}) {
        await query(
            `UPDATE user_sessions SET is_active = false, logout_at = now() WHERE user_id = $1 AND is_active = true${exceptTokenHash ? ' AND token_hash <> $2' : ''}`,
            exceptTokenHash ? [str(userId), exceptTokenHash] : [str(userId)]
        );
    },
};

module.exports = { deviceSessions, loginSessions };
