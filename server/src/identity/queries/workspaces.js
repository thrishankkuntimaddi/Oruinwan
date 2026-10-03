'use strict';

/**
 * Workspace and membership queries the messaging / workspace features need on
 * top of src/identity/workspaces.repo.js (identity on PostgreSQL).
 */

const { query } = require('../../shared/postgres');
const { str } = require('../sql');

const workspacesRepo = () => require('../workspaces.repo');

/** Number of workspaces a user created (free-plan limit). */
async function countCreatedBy(userId) {
    const { rows } = await query('SELECT count(*)::int AS n FROM workspaces WHERE created_by = $1', [str(userId)]);
    return rows[0].n;
}

/** A workspace with this exact name created by the user, or null. */
async function findByNameForCreator(name, userId) {
    const { rows } = await query('SELECT id FROM workspaces WHERE name = $1 AND created_by = $2 LIMIT 1', [String(name), str(userId)]);
    return rows[0] ? workspacesRepo().findById(rows[0].id) : null;
}

/** A workspace with this exact name the user is a member of (any status), other than `excludeId`. */
async function findByNameForMember(name, userId, excludeId = null) {
    const { rows } = await query(
        `SELECT w.id FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id
         WHERE w.name = $1 AND m.user_id = $2 AND ($3::text IS NULL OR w.id <> $3) LIMIT 1`,
        [String(name), str(userId), excludeId ? str(excludeId) : null]
    );
    return rows[0] ? workspacesRepo().findById(rows[0].id) : null;
}

/** Every workspace of a company (any state), members included. */
async function listByCompany(companyId) {
    const { rows } = await query('SELECT id FROM workspaces WHERE company_id = $1 ORDER BY created_at DESC', [str(companyId)]);
    return workspacesRepo().findManyByIds(rows.map((r) => r.id));
}

/**
 * Workspaces a user belongs to with their own membership row, the shape the
 * old `user.workspaces` array gave: [{ workspace, role, status, joinedAt }].
 * Includes suspended memberships; removed ones only when `includeRemoved`.
 */
async function membershipsForUser(userId, { includeRemoved = false } = {}) {
    const { rows } = await query(
        `SELECT workspace_id, role, status, joined_at FROM workspace_members
         WHERE user_id = $1${includeRemoved ? '' : " AND status <> 'removed'"} ORDER BY joined_at`,
        [str(userId)]
    );
    if (!rows.length) return [];
    const byId = new Map((await workspacesRepo().findManyByIds(rows.map((r) => r.workspace_id))).map((w) => [String(w._id), w]));
    return rows
        .filter((r) => byId.has(r.workspace_id))
        .map((r) => ({ workspace: byId.get(r.workspace_id), role: r.role, status: r.status, joinedAt: r.joined_at }));
}

/** Ids of every user in the workspace with the given status (default active). */
async function memberIds(workspaceId, { status = 'active' } = {}) {
    const { rows } = await query(
        `SELECT user_id FROM workspace_members WHERE workspace_id = $1${status ? ' AND status = $2' : ''}`,
        status ? [str(workspaceId), status] : [str(workspaceId)]
    );
    return rows.map((r) => r.user_id);
}

/** Active member count. */
async function countMembers(workspaceId, { status = 'active' } = {}) {
    const { rows } = await query(
        `SELECT count(*)::int AS n FROM workspace_members WHERE workspace_id = $1${status ? ' AND status = $2' : ''}`,
        status ? [str(workspaceId), status] : [str(workspaceId)]
    );
    return rows[0].n;
}

/** Which of `userIds` are active members of the workspace. */
async function activeMemberIdsAmong(workspaceId, userIds) {
    const ids = [...new Set((userIds || []).map(str).filter(Boolean))];
    if (!ids.length) return [];
    const { rows } = await query(
        "SELECT user_id FROM workspace_members WHERE workspace_id = $1 AND status = 'active' AND user_id = ANY($2)",
        [str(workspaceId), ids]
    );
    return rows.map((r) => r.user_id);
}

/** Do two users share at least one active workspace? */
async function shareWorkspace(userA, userB) {
    const { rows } = await query(
        `SELECT 1 FROM workspace_members a JOIN workspace_members b ON a.workspace_id = b.workspace_id
         WHERE a.user_id = $1 AND b.user_id = $2 AND a.status = 'active' AND b.status = 'active' LIMIT 1`,
        [str(userA), str(userB)]
    );
    return rows.length > 0;
}

/** Remove every membership of a workspace (used before deleting it). */
async function deleteAllMembers(workspaceId) {
    await query('DELETE FROM workspace_members WHERE workspace_id = $1', [str(workspaceId)]);
}

/** Clear users.personal_workspace_id pointing at a workspace being deleted. */
async function clearPersonalWorkspace(workspaceId) {
    await query('UPDATE users SET personal_workspace_id = NULL WHERE personal_workspace_id = $1', [str(workspaceId)]);
}

/** Active workspaces whose name matches (case-insensitive), for search. */
async function searchByName(userId, text, { limit = 10 } = {}) {
    const { rows } = await query(
        `SELECT w.id, w.name, w.description, w.icon, w.color FROM workspaces w
         JOIN workspace_members m ON m.workspace_id = w.id
         WHERE m.user_id = $1 AND m.status = 'active' AND w.is_active = true AND w.name ILIKE $2
         ORDER BY w.name LIMIT $3`,
        [str(userId), `%${text}%`, limit]
    );
    return rows.map((r) => ({ _id: r.id, id: r.id, name: r.name, description: r.description, icon: r.icon, color: r.color }));
}

/**
 * People search inside a workspace: the whole company for company workspaces,
 * else the workspace's active members. Matches username, display name or email.
 */
async function searchPeople(workspace, excludeUserId, text, { limit = 10, offset = 0 } = {}) {
    const like = `%${String(text || '').replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
    const params = [str(excludeUserId), like, limit, offset];
    let scope;
    if (workspace.company) {
        params.push(str(workspace.company));
        scope = `u.company_id = $${params.length}`;
    } else {
        params.push(str(workspace._id));
        scope = `u.id IN (SELECT user_id FROM workspace_members WHERE workspace_id = $${params.length} AND status = 'active')`;
    }
    const { rows } = await query(
        `SELECT u.id, u.username, u.email, u.profile_picture, u.is_online, u.user_status, u.profile->>'name' AS name
         FROM users u
         WHERE ${scope} AND u.id <> $1
           AND (u.username ILIKE $2 OR u.email ILIKE $2 OR u.profile->>'name' ILIKE $2)
         ORDER BY u.username LIMIT $3 OFFSET $4`,
        params
    );
    return rows.map((r) => ({
        _id: r.id, username: r.username, name: r.name, email: r.email,
        profilePicture: r.profile_picture, isOnline: r.is_online, userStatus: r.user_status,
    }));
}

module.exports = {
    searchPeople,
    countCreatedBy, findByNameForCreator, findByNameForMember, listByCompany, membershipsForUser,
    memberIds, countMembers, activeMemberIdsAmong, shareWorkspace, deleteAllMembers, clearPersonalWorkspace, searchByName,
};
