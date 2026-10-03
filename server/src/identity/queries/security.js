'use strict';

/**
 * Identity queries for security and compliance (GDPR export and erasure, legal
 * hold, retention, backups) and for system accounts (AI assistant, integration
 * bots). Kept out of the generic repositories because they read or change many
 * identity tables at once.
 *
 * Legal hold lives in users.legal_hold jsonb: { enabled, reason, setBy, at }.
 */

const { query, withTransaction } = require('../../shared/postgres');
const users = require('../users.repo');
const { newId, camelRow, str } = require('../sql');

/** Legal hold in the flat shape the API has always returned. */
function legalHoldOf(user) {
    const h = user?.legalHold || {};
    return {
        legalHold: !!h.enabled,
        legalHoldReason: h.enabled ? (h.reason || null) : null,
        legalHoldSetBy: h.enabled ? (h.setBy || null) : null,
        legalHoldAt: h.enabled ? (h.at || null) : null,
    };
}

async function setLegalHold(userId, { enabled, reason = null, setBy = null }) {
    const value = enabled ? { enabled: true, reason: reason || 'Legal hold active', setBy: str(setBy), at: new Date().toISOString() } : { enabled: false };
    return users.update(userId, { legalHold: value });
}

/** Users with a personal retention policy and no legal hold (retention cron). */
async function usersWithRetention() {
    const { rows } = await query(
        `SELECT id, retention_days FROM users
         WHERE retention_days > 0
           AND COALESCE((legal_hold->>'enabled')::boolean, false) = false
           AND account_status <> 'removed'`
    );
    return rows.map((r) => ({ _id: r.id, retentionDays: r.retention_days }));
}

/**
 * Create a system account once (no password, cannot sign in) and return it.
 * Concurrent callers on several instances get the same row.
 */
async function upsertSystemUser({ email, username, roles = [], profilePicture = null }) {
    const { rows } = await query(
        `INSERT INTO users (id, username, email, roles, profile_picture, account_status, verified, profile)
         VALUES ($1, $2, lower($3), $4, $5, 'active', true, jsonb_build_object('name', $2::text))
         ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
         RETURNING *`,
        [newId(), username, email, roles, profilePicture]
    );
    return users.toUser(rows[0]);
}

/** Identity part of a personal data export: everything about the user except secrets. */
async function identityExport(userId) {
    const id = str(userId);
    const user = await users.findById(id);
    if (!user) return null;
    const [emails, workspaces, departments, teams, sessions, devices, identityKey] = await Promise.all([
        query('SELECT email, verified, is_primary, added_at FROM user_emails WHERE user_id = $1 ORDER BY added_at', [id]),
        query(
            `SELECT w.id, w.name, m.role, m.status, m.joined_at FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id
             WHERE m.user_id = $1 ORDER BY m.joined_at`, [id]),
        query('SELECT d.id, d.name, m.role FROM department_members m JOIN departments d ON d.id = m.department_id WHERE m.user_id = $1', [id]),
        query('SELECT t.id, t.name, m.role, m.joined_at FROM team_members m JOIN teams t ON t.id = m.team_id WHERE m.user_id = $1', [id]),
        query('SELECT device, os, browser, ip_address, location, last_activity_at, is_active, created_at FROM user_sessions WHERE user_id = $1 ORDER BY created_at DESC', [id]),
        query('SELECT device_id, device_name, platform, revoked, last_activity_at, created_at FROM user_device_sessions WHERE user_id = $1', [id]),
        query('SELECT public_key, algorithm, version FROM user_identity_keys WHERE user_id = $1', [id]),
    ]);
    return {
        user,
        emails: emails.rows.map((r) => ({ email: r.email, verified: r.verified, isPrimary: r.is_primary, addedAt: r.added_at })),
        workspaces: workspaces.rows.map((r) => ({ id: r.id, name: r.name, role: r.role, status: r.status, joinedAt: r.joined_at })),
        departments: departments.rows.map((r) => ({ id: r.id, name: r.name, role: r.role })),
        teams: teams.rows.map((r) => ({ id: r.id, name: r.name, role: r.role, joinedAt: r.joined_at })),
        sessions: sessions.rows.map((r) => camelRow(r)),
        devices: devices.rows.map((r) => camelRow(r)),
        identityKey: identityKey.rows[0] ? camelRow(identityKey.rows[0]) : null,
    };
}

/**
 * Delete every identity row of a user in one transaction. The users row
 * cascades to emails, refresh tokens, one-time codes, devices, workspace /
 * department / team memberships, identity keys, crypto state and sessions;
 * rows that reference the user without a foreign key are removed explicitly.
 * A personal workspace left without active members is closed (not deleted).
 * Returns counts per table.
 */
async function eraseIdentity(userId, { personalWorkspaceId = null } = {}) {
    const id = str(userId);
    return withTransaction(async (tx) => {
        const counts = {};
        const run = async (name, sql, params) => { counts[name] = (await tx.query(sql, params)).rowCount; };
        await run('workspacesLeft', 'DELETE FROM workspace_members WHERE user_id = $1', [id]);
        await run('conversationKeysDropped', 'DELETE FROM conversation_key_members WHERE user_id = $1', [id]);
        await run('companyAdminRemoved', 'DELETE FROM company_admins WHERE user_id = $1', [id]);
        // Other users' block lists keep { userId } entries in users.social.blockedUsers.
        await run('removedFromBlockLists',
            `UPDATE users SET social = jsonb_set(social, '{blockedUsers}',
                COALESCE((SELECT jsonb_agg(b) FROM jsonb_array_elements(social->'blockedUsers') b WHERE b->>'userId' <> $1), '[]'::jsonb))
             WHERE social->'blockedUsers' @> jsonb_build_array(jsonb_build_object('userId', $1::text))`, [id]);
        if (personalWorkspaceId) {
            await run('personalWorkspaceClosed',
                `UPDATE workspaces SET is_active = false, updated_at = now() WHERE id = $1
                 AND NOT EXISTS (SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND status = 'active')`, [str(personalWorkspaceId)]);
        }
        await run('userDeleted', 'DELETE FROM users WHERE id = $1', [id]);
        return counts;
    });
}

/** Identity tables of one company (or all, for platform backups), secrets excluded. */
async function companyBackup(companyId = null) {
    const cid = companyId ? str(companyId) : null;
    const where = cid ? 'WHERE company_id = $1' : '';
    const params = cid ? [cid] : [];
    const [company, userRows, workspaces, members, departments, teams] = await Promise.all([
        cid ? query('SELECT * FROM companies WHERE id = $1', [cid]) : query('SELECT * FROM companies'),
        query(`SELECT * FROM users ${where}`, params),
        query(`SELECT * FROM workspaces ${where}`, params),
        query(
            `SELECT m.* FROM workspace_members m JOIN workspaces w ON w.id = m.workspace_id ${cid ? 'WHERE w.company_id = $1' : ''}`, params),
        query(`SELECT * FROM departments ${where}`, params),
        query(`SELECT * FROM teams ${where}`, params),
    ]);
    return {
        companies: company.rows.map((r) => camelRow(r)),
        users: userRows.rows.map((r) => users.toUser(r)),
        workspaces: workspaces.rows.map((r) => camelRow(r)),
        workspaceMembers: members.rows.map((r) => camelRow(r)),
        departments: departments.rows.map((r) => camelRow(r)),
        teams: teams.rows.map((r) => camelRow(r)),
    };
}

/** The user linked to an SSO identity, by (provider, id) in users.sso. */
async function findBySso(provider, externalId) {
    const { rows } = await query(`SELECT * FROM users WHERE sso->>'provider' = $1 AND sso->>'id' = $2`, [provider, String(externalId)]);
    return users.toUser(rows[0]);
}

// ── Server KEK rotation (src/scripts/rotateServerKEK.js) ─────────────
const KEK_WHERE = "umek_protection_type = 'SERVER_KEK' AND (kek_version = $1 OR kek_version IS NULL)";

async function countKekRotation(fromVersion) {
    const { rows } = await query(`SELECT count(*)::int AS n FROM user_crypto_state WHERE ${KEK_WHERE}`, [fromVersion]);
    return rows[0].n;
}

/** Next batch after `afterUserId` (keyset paging, so failed rows are not retried forever). */
async function listKekRotation(fromVersion, { afterUserId = '', limit = 10 } = {}) {
    const { rows } = await query(
        `SELECT * FROM user_crypto_state WHERE ${KEK_WHERE} AND user_id > $2 ORDER BY user_id LIMIT $3`,
        [fromVersion, afterUserId, limit]
    );
    return rows.map((r) => camelRow(r));
}

module.exports = {
    countKekRotation, listKekRotation,
    legalHoldOf, setLegalHold, usersWithRetention, upsertSystemUser,
    identityExport, eraseIdentity, companyBackup, findBySso,
};
