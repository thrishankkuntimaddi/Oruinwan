'use strict';

/**
 * Projects, sprints and milestones on PostgreSQL (db/migrations/0005_tasks.sql),
 * returned as `.lean()`-shaped objects with the Mongo field names.
 */

const { query } = require('../../shared/postgres');
const { newId } = require('./tasks.repository');

const str = (v) => (v == null ? null : String(v?._id || v));
const date = (v) => (v ? new Date(v) : null);

const TABLES = {
    sprint: {
        table: 'sprints',
        columns: { workspace: 'workspace_id', company: 'company_id', name: 'name', goal: 'goal', startDate: 'start_date', endDate: 'end_date', status: 'status', boardColumns: 'board_columns', createdBy: 'created_by', deleted: 'deleted', createdAt: 'created_at', updatedAt: 'updated_at' },
        json: ['boardColumns'], dates: ['startDate', 'endDate', 'createdAt', 'updatedAt'], ids: ['workspace', 'company', 'createdBy'],
        defaultSort: 'start_date ASC NULLS FIRST',
    },
    milestone: {
        table: 'milestones',
        columns: { workspace: 'workspace_id', company: 'company_id', name: 'name', description: 'description', dueDate: 'due_date', startDate: 'start_date', endDate: 'end_date', status: 'status', createdBy: 'created_by', deleted: 'deleted', createdAt: 'created_at', updatedAt: 'updated_at' },
        json: [], dates: ['dueDate', 'startDate', 'endDate', 'createdAt', 'updatedAt'], ids: ['workspace', 'company', 'createdBy'],
        defaultSort: 'due_date ASC NULLS FIRST',
    },
    project: {
        table: 'projects',
        columns: { companyId: 'company_id', workspaceId: 'workspace_id', name: 'name', description: 'description', status: 'status', ownerId: 'owner_id', startDate: 'start_date', endDate: 'end_date', members: 'members', isArchived: 'is_archived', archivedAt: 'archived_at', archivedBy: 'archived_by', deleted: 'deleted', deletedAt: 'deleted_at', deletedBy: 'deleted_by', metadata: 'metadata', createdAt: 'created_at', updatedAt: 'updated_at' },
        json: ['members', 'metadata'], dates: ['startDate', 'endDate', 'archivedAt', 'deletedAt', 'createdAt', 'updatedAt'], ids: ['companyId', 'workspaceId', 'ownerId', 'archivedBy', 'deletedBy'],
        defaultSort: 'created_at DESC',
    },
};

function toColumn(def, field, value) {
    if (def.json.includes(field)) return value === undefined ? null : JSON.stringify(value);
    if (def.dates.includes(field)) return date(value);
    if (def.ids.includes(field)) return str(value);
    return value === undefined ? null : value;
}

function fromRow(def, r) {
    const o = { _id: r.id, id: r.id };
    for (const [field, col] of Object.entries(def.columns)) {
        let v = r[col];
        if (def.dates.includes(field)) v = v ? new Date(v) : null;
        if (field === 'members' && Array.isArray(v)) v = v.map((m) => ({ ...m, joinedAt: date(m.joinedAt) }));
        o[field] = v;
    }
    if (def.table === 'projects') o.memberCount = Array.isArray(o.members) ? o.members.length : 0;
    return o;
}

function makeRepo(kind) {
    const def = TABLES[kind];
    const cols = `id, ${Object.values(def.columns).join(', ')}`;

    async function findById(id) {
        const { rows } = await query(`SELECT ${cols} FROM ${def.table} WHERE id = $1`, [String(id)]);
        return rows.length ? fromRow(def, rows[0]) : null;
    }

    /** filter: { workspace|workspaceId, deleted, status, ids } */
    async function findMany(filter = {}, { sort } = {}) {
        const where = [];
        const params = [];
        const p = (v) => { params.push(v); return `$${params.length}`; };
        const ws = filter.workspace ?? filter.workspaceId;
        if (ws) where.push(`workspace_id = ${p(str(ws))}`);
        if (filter.company ?? filter.companyId) where.push(`company_id = ${p(str(filter.company ?? filter.companyId))}`);
        if (filter.deleted === false) where.push('deleted = false');
        else if (filter.deleted === true) where.push('deleted = true');
        if (filter.status) where.push(`status = ${p(filter.status)}`);
        if (filter.ids) where.push(`id = ANY(${p(filter.ids.map(String))})`);
        const sql = `SELECT ${cols} FROM ${def.table} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY ${sort || def.defaultSort}`;
        const { rows } = await query(sql, params);
        return rows.map((r) => fromRow(def, r));
    }

    async function insert(doc) {
        const id = str(doc._id) || newId();
        const names = ['id'];
        const vals = [id];
        for (const [field, col] of Object.entries(def.columns)) {
            if (field === 'createdAt' || field === 'updatedAt' || doc[field] === undefined) continue;
            names.push(col);
            vals.push(toColumn(def, field, doc[field]));
        }
        await query(`INSERT INTO ${def.table} (${names.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')})`, vals);
        return findById(id);
    }

    async function update(id, patch) {
        const sets = [];
        const params = [];
        for (const [field, value] of Object.entries(patch)) {
            const col = def.columns[field];
            if (!col || field === 'createdAt' || field === 'updatedAt') continue;
            params.push(toColumn(def, field, value));
            sets.push(`${col} = $${params.length}`);
        }
        sets.push('updated_at = now()');
        params.push(String(id));
        await query(`UPDATE ${def.table} SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
        return findById(id);
    }

    const softDelete = (id) => update(id, { deleted: true });

    async function remove(id) {
        const { rowCount } = await query(`DELETE FROM ${def.table} WHERE id = $1`, [String(id)]);
        return rowCount;
    }

    return { findById, findMany, insert, update, softDelete, remove, table: def.table };
}

const sprints = makeRepo('sprint');
const milestones = makeRepo('milestone');
const projects = makeRepo('project');

/** { <id>: { total, done } } for the tasks under each sprint / milestone / project. */
async function taskCounts(column, ids) {
    const list = (ids || []).map(String);
    if (!list.length) return {};
    const { rows } = await query(
        `SELECT ${column} AS id, count(*)::int AS total, count(*) FILTER (WHERE status = 'done')::int AS done
         FROM tasks WHERE ${column} = ANY($1) AND deleted = false GROUP BY ${column}`,
        [list]
    );
    const out = {};
    for (const r of rows) out[r.id] = { total: r.total, done: r.done };
    return out;
}

module.exports = {
    sprints, milestones, projects,
    sprintTaskCounts: (ids) => taskCounts('sprint_id', ids),
    milestoneTaskCounts: (ids) => taskCounts('milestone_id', ids),
    projectTaskCounts: (ids) => taskCounts('project_id', ids),
};
