'use strict';

/**
 * Workspaces and memberships on PostgreSQL (migration 0006_identity).
 * `members` is returned as the array shape the server already reads:
 * [{ user, role, status, joinedAt, ... }], plus `isMember`/`isAdminOrOwner`.
 */

const { query, withTransaction } = require('../shared/postgres');
const { newId, buildUpdate, columnsFor, insertSql, camelRow, str } = require('./sql');

const COLUMNS = {
    _id: 'id', id: 'id', company: 'company_id', type: 'type', department: 'department_id', name: 'name',
    description: 'description', icon: 'icon', color: 'color', rules: 'rules', createdBy: 'created_by',
    defaultChannels: 'default_channels', settings: 'settings', templateId: 'template_id', clonedFrom: 'cloned_from',
    exportedAt: 'exported_at', analyticsCache: 'analytics_cache', lastActivityAt: 'last_activity_at', isActive: 'is_active',
    isArchived: 'is_archived', archivedAt: 'archived_at', metadata: 'metadata', createdAt: 'created_at', updatedAt: 'updated_at',
};

function toMember(r) {
    return {
        user: r.user_id, role: r.role, status: r.status, joinedAt: r.joined_at,
        suspendedAt: r.suspended_at, suspendedBy: r.suspended_by, removedAt: r.removed_at, removedBy: r.removed_by,
    };
}

function toWorkspace(row, memberRows = []) {
    const w = camelRow(row);
    if (!w) return null;
    w.company = w.companyId; delete w.companyId;
    w.department = w.departmentId; delete w.departmentId;
    w.members = memberRows.map(toMember);
    w.isMember = (userId) => w.members.some((m) => m.user === str(userId) && m.status === 'active');
    w.isAdminOrOwner = (userId) => w.members.some((m) => m.user === str(userId) && m.status === 'active' && (m.role === 'owner' || m.role === 'admin'));
    return w;
}

async function loadMembers(workspaceIds) {
    const ids = workspaceIds.map(str);
    if (!ids.length) return new Map();
    const { rows } = await query('SELECT * FROM workspace_members WHERE workspace_id = ANY($1) ORDER BY joined_at', [ids]);
    const byWs = new Map();
    for (const r of rows) {
        if (!byWs.has(r.workspace_id)) byWs.set(r.workspace_id, []);
        byWs.get(r.workspace_id).push(r);
    }
    return byWs;
}

async function hydrate(rows) {
    const members = await loadMembers(rows.map((r) => r.id));
    return rows.map((r) => toWorkspace(r, members.get(r.id) || []));
}

async function findById(id, { activeOnly = false } = {}) {
    const { rows } = await query(`SELECT * FROM workspaces WHERE id = $1${activeOnly ? ' AND is_active = true' : ''}`, [str(id)]);
    return rows[0] ? (await hydrate(rows))[0] : null;
}

async function findManyByIds(ids) {
    const unique = [...new Set((ids || []).map(str).filter(Boolean))];
    if (!unique.length) return [];
    const { rows } = await query('SELECT * FROM workspaces WHERE id = ANY($1)', [unique]);
    return hydrate(rows);
}

/** { workspace, member, role, isAdmin } or null — the shape of shared/utils/workspaceAccess. */
async function membership(workspaceId, userId) {
    const ws = await findById(workspaceId, { activeOnly: true });
    if (!ws) return null;
    const member = ws.members.find((m) => m.user === str(userId) && m.status === 'active') || null;
    const role = member ? member.role : null;
    return { workspace: ws, member, role, isAdmin: role === 'owner' || role === 'admin' };
}

/** Ids of active workspaces where the user is an active member. */
async function memberWorkspaceIds(userId) {
    const { rows } = await query(
        `SELECT w.id FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id
         WHERE m.user_id = $1 AND m.status = 'active' AND w.is_active = true`,
        [str(userId)]
    );
    return rows.map((r) => r.id);
}

async function listForUser(userId, { includeArchived = false } = {}) {
    const { rows } = await query(
        `SELECT w.* FROM workspaces w JOIN workspace_members m ON m.workspace_id = w.id
         WHERE m.user_id = $1 AND m.status = 'active' AND w.is_active = true${includeArchived ? '' : ' AND w.is_archived = false'}
         ORDER BY w.last_activity_at DESC`,
        [str(userId)]
    );
    return hydrate(rows);
}

async function listForCompany(companyId, { type, limit = 100, skip = 0 } = {}) {
    const params = [str(companyId)];
    let where = 'company_id = $1 AND is_active = true';
    if (type) { params.push(type); where += ` AND type = $${params.length}`; }
    params.push(limit, skip);
    const { rows } = await query(`SELECT * FROM workspaces WHERE ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
    return hydrate(rows);
}

async function countForCompany(companyId) {
    const { rows } = await query('SELECT count(*)::int AS n FROM workspaces WHERE company_id = $1 AND is_active = true', [str(companyId)]);
    return rows[0].n;
}

async function create(ws) {
    const id = str(ws._id || ws.id) || newId();
    const members = ws.members || [{ user: ws.createdBy, role: 'owner' }];
    const { cols, params } = columnsFor({ ...ws, _id: undefined, id, members: undefined }, COLUMNS);
    return withTransaction(async (tx) => {
        const { rows } = await tx.query(insertSql('workspaces', cols), params);
        for (const m of members) {
            await tx.query(
                `INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at) VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
                [id, str(m.user), m.role || 'member', m.status || 'active', m.joinedAt || new Date()]
            );
        }
        const { rows: memberRows } = await tx.query('SELECT * FROM workspace_members WHERE workspace_id = $1', [id]);
        return toWorkspace(rows[0], memberRows);
    });
}

async function update(id, patch) {
    const { sets, params, next } = buildUpdate(patch, COLUMNS);
    if (!sets.length) return findById(id);
    sets.push('updated_at = now()');
    await query(`UPDATE workspaces SET ${sets.join(', ')} WHERE id = $${next}`, [...params, str(id)]);
    return findById(id);
}

async function addMember(workspaceId, userId, { role = 'member', status = 'active' } = {}) {
    await query(
        `INSERT INTO workspace_members (workspace_id, user_id, role, status) VALUES ($1, $2, $3, $4)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status,
            removed_at = NULL, removed_by = NULL, suspended_at = NULL, suspended_by = NULL`,
        [str(workspaceId), str(userId), role, status]
    );
}

async function updateMember(workspaceId, userId, patch) {
    const map = { role: 'role', status: 'status', suspendedAt: 'suspended_at', suspendedBy: 'suspended_by', removedAt: 'removed_at', removedBy: 'removed_by' };
    const { sets, params, next } = buildUpdate(patch, map);
    if (!sets.length) return;
    await query(`UPDATE workspace_members SET ${sets.join(', ')} WHERE workspace_id = $${next} AND user_id = $${next + 1}`, [...params, str(workspaceId), str(userId)]);
}

async function removeMember(workspaceId, userId, { by = null, hard = false } = {}) {
    if (hard) return query('DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2', [str(workspaceId), str(userId)]);
    return query(
        `UPDATE workspace_members SET status = 'removed', removed_at = now(), removed_by = $3 WHERE workspace_id = $1 AND user_id = $2`,
        [str(workspaceId), str(userId), by ? str(by) : null]
    );
}

async function listMembers(workspaceId, { status = 'active' } = {}) {
    const params = [str(workspaceId)];
    let where = 'workspace_id = $1';
    if (status) { params.push(status); where += ' AND status = $2'; }
    const { rows } = await query(`SELECT * FROM workspace_members WHERE ${where} ORDER BY joined_at`, params);
    return rows.map(toMember);
}

async function remove(id) {
    await query('DELETE FROM workspaces WHERE id = $1', [str(id)]);
}

module.exports = {
    COLUMNS, toWorkspace,
    findById, findManyByIds, membership, memberWorkspaceIds, listForUser, listForCompany, countForCompany,
    create, update, addMember, updateMember, removeMember, listMembers, remove,
};
