'use strict';

/** Departments, teams and the company role → permission matrix on PostgreSQL. */

const { query, withTransaction } = require('../shared/postgres');
const { newId, buildUpdate, columnsFor, insertSql, camelRow, str } = require('./sql');

// ── Departments ───────────────────────────────────────────────────────
const DEPT = {
    _id: 'id', id: 'id', company: 'company_id', name: 'name', description: 'description', head: 'head_user_id',
    parentDepartment: 'parent_department_id', defaultWorkspaceId: 'default_workspace_id', workspaces: 'workspaces',
    metadata: 'metadata', isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at',
};

function toDepartment(row, memberRows = []) {
    const d = camelRow(row);
    if (!d) return null;
    d.company = d.companyId; delete d.companyId;
    d.head = d.headUserId; delete d.headUserId;
    d.parentDepartment = d.parentDepartmentId; delete d.parentDepartmentId;
    d.managers = memberRows.filter((m) => m.role === 'manager').map((m) => m.user_id);
    d.members = memberRows.map((m) => m.user_id);
    return d;
}

async function departmentMembers(ids) {
    if (!ids.length) return new Map();
    const { rows } = await query('SELECT * FROM department_members WHERE department_id = ANY($1)', [ids]);
    const by = new Map();
    for (const r of rows) { if (!by.has(r.department_id)) by.set(r.department_id, []); by.get(r.department_id).push(r); }
    return by;
}

async function hydrateDepartments(rows) {
    const by = await departmentMembers(rows.map((r) => r.id));
    return rows.map((r) => toDepartment(r, by.get(r.id) || []));
}

const departments = {
    async findById(id) {
        const { rows } = await query('SELECT * FROM departments WHERE id = $1', [str(id)]);
        return rows[0] ? (await hydrateDepartments(rows))[0] : null;
    },
    async listForCompany(companyId, { activeOnly = true } = {}) {
        const { rows } = await query(`SELECT * FROM departments WHERE company_id = $1${activeOnly ? ' AND is_active = true' : ''} ORDER BY name`, [str(companyId)]);
        return hydrateDepartments(rows);
    },
    async listForUser(userId) {
        const { rows } = await query(
            'SELECT d.* FROM departments d JOIN department_members m ON m.department_id = d.id WHERE m.user_id = $1 AND d.is_active = true ORDER BY d.name',
            [str(userId)]
        );
        return hydrateDepartments(rows);
    },
    async managedBy(userId) {
        const { rows } = await query("SELECT department_id FROM department_members WHERE user_id = $1 AND role = 'manager'", [str(userId)]);
        return rows.map((r) => r.department_id);
    },
    async create(dept) {
        const id = str(dept._id || dept.id) || newId();
        const { cols, params } = columnsFor({ ...dept, _id: undefined, id, managers: undefined, members: undefined }, DEPT);
        return withTransaction(async (tx) => {
            const { rows } = await tx.query(insertSql('departments', cols), params);
            for (const u of dept.managers || []) await tx.query("INSERT INTO department_members (department_id, user_id, role) VALUES ($1, $2, 'manager') ON CONFLICT DO NOTHING", [id, str(u)]);
            for (const u of dept.members || []) await tx.query("INSERT INTO department_members (department_id, user_id, role) VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING", [id, str(u)]);
            const { rows: m } = await tx.query('SELECT * FROM department_members WHERE department_id = $1', [id]);
            return toDepartment(rows[0], m);
        });
    },
    async update(id, patch) {
        const { sets, params, next } = buildUpdate(patch, DEPT);
        if (sets.length) {
            sets.push('updated_at = now()');
            await query(`UPDATE departments SET ${sets.join(', ')} WHERE id = $${next}`, [...params, str(id)]);
        }
        return departments.findById(id);
    },
    async setMember(departmentId, userId, role = 'member') {
        await query(
            'INSERT INTO department_members (department_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (department_id, user_id) DO UPDATE SET role = EXCLUDED.role',
            [str(departmentId), str(userId), role]
        );
    },
    async removeMember(departmentId, userId) {
        await query('DELETE FROM department_members WHERE department_id = $1 AND user_id = $2', [str(departmentId), str(userId)]);
    },
    async countForCompany(companyId) {
        const { rows } = await query('SELECT count(*)::int AS n FROM departments WHERE company_id = $1 AND is_active = true', [str(companyId)]);
        return rows[0].n;
    },
    async remove(id) { await query('DELETE FROM departments WHERE id = $1', [str(id)]); },
};

// ── Teams ─────────────────────────────────────────────────────────────
const TEAM = {
    _id: 'id', id: 'id', company: 'company_id', department: 'department_id', workspace: 'workspace_id', name: 'name',
    description: 'description', icon: 'icon', color: 'color', lead: 'lead_user_id', isActive: 'is_active',
    createdAt: 'created_at', updatedAt: 'updated_at',
};

function toTeam(row, memberRows = []) {
    const t = camelRow(row);
    if (!t) return null;
    t.company = t.companyId; delete t.companyId;
    t.department = t.departmentId; delete t.departmentId;
    t.workspace = t.workspaceId; delete t.workspaceId;
    t.lead = t.leadUserId; delete t.leadUserId;
    t.members = memberRows.map((m) => ({ user: m.user_id, role: m.role, joinedAt: m.joined_at }));
    return t;
}

async function hydrateTeams(rows) {
    if (!rows.length) return [];
    const { rows: m } = await query('SELECT * FROM team_members WHERE team_id = ANY($1)', [rows.map((r) => r.id)]);
    const by = new Map();
    for (const r of m) { if (!by.has(r.team_id)) by.set(r.team_id, []); by.get(r.team_id).push(r); }
    return rows.map((r) => toTeam(r, by.get(r.id) || []));
}

const teams = {
    async findById(id) {
        const { rows } = await query('SELECT * FROM teams WHERE id = $1', [str(id)]);
        return rows[0] ? (await hydrateTeams(rows))[0] : null;
    },
    async listForCompany(companyId) {
        const { rows } = await query('SELECT * FROM teams WHERE company_id = $1 AND is_active = true ORDER BY name', [str(companyId)]);
        return hydrateTeams(rows);
    },
    async listForUser(userId) {
        const { rows } = await query('SELECT t.* FROM teams t JOIN team_members m ON m.team_id = t.id WHERE m.user_id = $1 AND t.is_active = true', [str(userId)]);
        return hydrateTeams(rows);
    },
    async create(team) {
        const id = str(team._id || team.id) || newId();
        const { cols, params } = columnsFor({ ...team, _id: undefined, id, members: undefined }, TEAM);
        return withTransaction(async (tx) => {
            const { rows } = await tx.query(insertSql('teams', cols), params);
            for (const m of team.members || []) {
                await tx.query('INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [id, str(m.user), m.role || 'member']);
            }
            const { rows: mr } = await tx.query('SELECT * FROM team_members WHERE team_id = $1', [id]);
            return toTeam(rows[0], mr);
        });
    },
    async update(id, patch) {
        const { sets, params, next } = buildUpdate(patch, TEAM);
        if (sets.length) {
            sets.push('updated_at = now()');
            await query(`UPDATE teams SET ${sets.join(', ')} WHERE id = $${next}`, [...params, str(id)]);
        }
        return teams.findById(id);
    },
    async setMember(teamId, userId, role = 'member') {
        await query('INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT (team_id, user_id) DO UPDATE SET role = EXCLUDED.role', [str(teamId), str(userId), role]);
    },
    async removeMember(teamId, userId) {
        await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [str(teamId), str(userId)]);
    },
    async remove(id) { await query('DELETE FROM teams WHERE id = $1', [str(id)]); },
};

// ── Company role permissions (models/Permission.js) ───────────────────
const rolePermissions = {
    async get(companyId, role) {
        const { rows } = await query('SELECT * FROM company_role_permissions WHERE company_id = $1 AND role = $2', [str(companyId), role]);
        return rows[0] ? { company: rows[0].company_id, role: rows[0].role, permissions: rows[0].permissions, customPermissions: rows[0].custom_permissions } : null;
    },
    async listForCompany(companyId) {
        const { rows } = await query('SELECT * FROM company_role_permissions WHERE company_id = $1', [str(companyId)]);
        return rows.map((r) => ({ company: r.company_id, role: r.role, permissions: r.permissions, customPermissions: r.custom_permissions }));
    },
    async set(companyId, role, { permissions = {}, customPermissions = null }) {
        await query(
            `INSERT INTO company_role_permissions (company_id, role, permissions, custom_permissions) VALUES ($1, $2, $3::jsonb, $4::jsonb)
             ON CONFLICT (company_id, role) DO UPDATE SET permissions = EXCLUDED.permissions, custom_permissions = EXCLUDED.custom_permissions, updated_at = now()`,
            [str(companyId), role, JSON.stringify(permissions), customPermissions == null ? null : JSON.stringify(customPermissions)]
        );
        return rolePermissions.get(companyId, role);
    },
};

// ── Workspace permissions (src/models/WorkspacePermission.js) ─────────
const workspacePermissions = {
    async get(workspaceId) {
        const { rows } = await query('SELECT * FROM workspace_permissions WHERE workspace_id = $1', [str(workspaceId)]);
        const r = rows[0];
        return r ? { workspace: r.workspace_id, company: r.company_id, channelPermissions: r.channel_permissions, featureToggles: r.feature_toggles, invitePermission: r.invite_permission, channelCreationPermission: r.channel_creation, updatedBy: r.updated_by, updatedAt: r.updated_at } : null;
    },
    async upsert(workspaceId, patch) {
        const map = { company: 'company_id', channelPermissions: 'channel_permissions', featureToggles: 'feature_toggles', invitePermission: 'invite_permission', channelCreationPermission: 'channel_creation', updatedBy: 'updated_by' };
        await query('INSERT INTO workspace_permissions (workspace_id) VALUES ($1) ON CONFLICT (workspace_id) DO NOTHING', [str(workspaceId)]);
        const { sets, params, next } = buildUpdate(patch, map);
        if (sets.length) {
            sets.push('updated_at = now()');
            await query(`UPDATE workspace_permissions SET ${sets.join(', ')} WHERE workspace_id = $${next}`, [...params, str(workspaceId)]);
        }
        return workspacePermissions.get(workspaceId);
    },
};

module.exports = { departments, teams, rolePermissions, workspacePermissions, toDepartment, toTeam };
