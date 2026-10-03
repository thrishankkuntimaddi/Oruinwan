'use strict';

/**
 * Tasks on PostgreSQL (db/migrations/0005_tasks.sql). Every function returns
 * plain objects shaped like the `.lean()` documents of models/Task.js, with
 * the Mongo field names (`_id`, `workspace`, `assignedTo`, ...), so the
 * service, the sockets and the clients see no difference between stores.
 *
 * Ids are Mongo-style 24-hex strings generated here. Users and workspaces
 * live in PostgreSQL too (src/identity) and channels in MongoDB; all are
 * referenced by id.
 *
 * Read API for other features (search, dashboards, analytics, AI knowledge,
 * GDPR, integrations, public API, message → task). All return task objects in
 * the lean shape described above, with user / workspace references as ids;
 * call `hydrateForClient` (or hydrateUsers) when a response needs cards.
 *
 *   listForWorkspace(workspaceId, filter?)  live tasks of a workspace. `filter` takes any
 *                                           findMany key (status, priority, assignedTo,
 *                                           createdBy, sprintId, dueBefore, search, limit,
 *                                           skip, sort, userId + channelIds for visibility);
 *                                           pass deleted: true / undefined to include trash
 *   countByStatus(workspaceId)              { todo: 3, done: 7, ... } over live tasks
 *   listForUser(userId, filter?)            live tasks the user created or is assigned to,
 *                                           across workspaces, minus ones they hid
 *   search(workspaceId, text, limit = 20)   live tasks whose title, description or issue
 *                                           key contains `text`, newest first
 */

const mongoose = require('mongoose');
const { query, withTransaction } = require('../../shared/postgres');

const newId = () => new mongoose.Types.ObjectId().toString();
const str = (v) => (v == null ? null : String(v?._id || v));
const strs = (arr) => [...new Set((arr || []).map(str).filter(Boolean))];
const num = (v) => (v == null ? null : Number(v));
const json = (v) => (v === undefined ? null : JSON.stringify(v));
const date = (v) => (v ? new Date(v) : null);

// Mongo field -> column. Relations (assignedTo, watchers, linkedIssues,
// dependencies, subtasks) live in their own tables.
const COLUMNS = {
    company: 'company_id', workspace: 'workspace_id', project: 'project_id', issueKey: 'issue_key',
    type: 'type', taskType: 'task_type', parentTask: 'parent_task_id', epic: 'epic_id',
    title: 'title', description: 'description', createdBy: 'created_by', visibility: 'visibility',
    channel: 'channel_id', status: 'status', previousStatus: 'previous_status',
    blockedReason: 'blocked_reason', blockedBy: 'blocked_by', blockedAt: 'blocked_at',
    dueDate: 'due_date', dueSoonNotifiedAt: 'due_soon_notified_at', startDate: 'start_date',
    priority: 'priority', storyPoints: 'story_points', estimatedHours: 'estimated_hours', actualHours: 'actual_hours',
    completedAt: 'completed_at', completedBy: 'completed_by', completionNote: 'completion_note', resolution: 'resolution',
    source: 'source', aiContext: 'ai_context', linkedMessage: 'linked_message_id', linkedDM: 'linked_dm_id',
    tags: 'tags', labels: 'labels', externalLinks: 'external_links', attachments: 'attachments',
    transferRequest: 'transfer_request', deleted: 'deleted', deletedFor: 'deleted_for', deletedBy: 'deleted_by',
    deletedAt: 'deleted_at', revokedAt: 'revoked_at', revokedBy: 'revoked_by', timeTracking: 'time_tracking',
    recurring: 'recurring', automationRules: 'automation_rules', sprintId: 'sprint_id', milestoneId: 'milestone_id',
    createdAt: 'created_at', updatedAt: 'updated_at',
};
const JSON_FIELDS = new Set(['aiContext', 'externalLinks', 'attachments', 'transferRequest', 'timeTracking', 'recurring', 'automationRules']);
const ARRAY_FIELDS = new Set(['tags', 'labels', 'deletedFor']);
const ID_FIELDS = new Set(['company', 'workspace', 'project', 'parentTask', 'epic', 'createdBy', 'channel', 'blockedBy',
    'completedBy', 'linkedMessage', 'linkedDM', 'deletedBy', 'revokedBy', 'sprintId', 'milestoneId']);
const DATE_FIELDS = new Set(['blockedAt', 'dueDate', 'dueSoonNotifiedAt', 'startDate', 'completedAt', 'deletedAt', 'revokedAt', 'createdAt', 'updatedAt']);
const NUM_FIELDS = new Set(['storyPoints', 'estimatedHours', 'actualHours']);

/** Value as stored in its column. */
function toColumn(field, value) {
    if (JSON_FIELDS.has(field)) return json(value == null ? (field === 'transferRequest' || field === 'aiContext' ? null : defaultFor(field)) : value);
    if (ARRAY_FIELDS.has(field)) return field === 'deletedFor' ? strs(value) : (value || []).map(String);
    if (ID_FIELDS.has(field)) return str(value);
    if (DATE_FIELDS.has(field)) return date(value);
    if (NUM_FIELDS.has(field)) return num(value);
    if (field === 'deleted') return !!value;
    return value === undefined ? null : value;
}

function defaultFor(field) {
    switch (field) {
        case 'timeTracking': return { totalTime: 0, sessions: [] };
        case 'recurring': return { isRecurring: false, pattern: null, interval: 1, nextDue: null };
        default: return [];
    }
}

const SELECT = `t.id, ${Object.values(COLUMNS).filter((c) => c !== 'id').map((c) => `t.${c}`).join(', ')}`;

/** DB row -> task object (relations attached separately). */
function rowToTask(r) {
    const t = { _id: r.id, id: r.id };
    for (const [field, col] of Object.entries(COLUMNS)) {
        let v = r[col];
        if (NUM_FIELDS.has(field)) v = num(v);
        if (DATE_FIELDS.has(field)) v = v ? new Date(v) : null;
        if (field === 'recurring' && v && v.nextDue) v = { ...v, nextDue: new Date(v.nextDue) };
        if (field === 'timeTracking' && v && Array.isArray(v.sessions)) {
            v = { ...v, sessions: v.sessions.map((s) => ({ start: date(s.start), end: date(s.end) })) };
        }
        if (field === 'transferRequest' && v && v.requestedAt) v = { ...v, requestedAt: new Date(v.requestedAt) };
        if (field === 'attachments' && Array.isArray(v)) v = v.map((a) => ({ ...a, uploadedAt: date(a.uploadedAt) }));
        if (field === 'externalLinks' && Array.isArray(v)) v = v.map((l) => ({ ...l, updatedAt: date(l.updatedAt) }));
        t[field] = v;
    }
    t.assignedTo = [];
    t.watchers = [];
    t.linkedIssues = [];
    t.dependencies = [];
    t.subtasks = [];
    return withTaskMethods(t);
}

/**
 * The few instance methods of models/Task.js that policies call. Defined
 * non-enumerable so the object still serializes like a lean document.
 */
function withTaskMethods(t) {
    const uid = (u) => String(u?._id || u);
    const methods = {
        isCreator(userId) { return str(t.createdBy) === uid(userId); },
        isAssignee(userId) { return (t.assignedTo || []).some((a) => str(a) === uid(userId)); },
        isWatcher(userId) { return (t.watchers || []).some((w) => str(w) === uid(userId)); },
        getStakeholders() {
            const s = new Set([str(t.createdBy)]);
            (t.assignedTo || []).forEach((a) => s.add(str(a)));
            (t.watchers || []).forEach((w) => s.add(str(w)));
            return [...s].filter(Boolean);
        },
        canView(userId, userChannels = []) {
            if (methods.isCreator(userId) || methods.isAssignee(userId)) return true;
            if (t.visibility === 'workspace') return true;
            return t.visibility === 'channel' && userChannels.map(String).includes(str(t.channel));
        },
    };
    for (const [name, fn] of Object.entries(methods)) Object.defineProperty(t, name, { value: fn, enumerable: false, configurable: true });
    return t;
}

async function attachRelations(tasks, q = query) {
    if (!tasks.length) return tasks;
    const byId = new Map(tasks.map((t) => [t._id, t]));
    const ids = [...byId.keys()];
    const [assignees, watchers, links, deps, subs] = await Promise.all([
        q('SELECT task_id, user_id FROM task_assignees WHERE task_id = ANY($1) ORDER BY task_id, position', [ids]),
        q('SELECT task_id, user_id FROM task_watchers WHERE task_id = ANY($1)', [ids]),
        q('SELECT id, task_id, linked_task_id, link_type, created_by, created_at FROM task_links WHERE task_id = ANY($1) ORDER BY created_at', [ids]),
        q('SELECT task_id, depends_on_id FROM task_dependencies WHERE task_id = ANY($1)', [ids]),
        q('SELECT id, parent_task_id FROM tasks WHERE parent_task_id = ANY($1) ORDER BY created_at', [ids]),
    ]);
    for (const r of assignees.rows) byId.get(r.task_id).assignedTo.push(r.user_id);
    for (const r of watchers.rows) byId.get(r.task_id).watchers.push(r.user_id);
    for (const r of links.rows) byId.get(r.task_id).linkedIssues.push({ _id: r.id, task: r.linked_task_id, linkType: r.link_type, createdBy: r.created_by, createdAt: new Date(r.created_at) });
    for (const r of deps.rows) byId.get(r.task_id).dependencies.push(r.depends_on_id);
    for (const r of subs.rows) byId.get(r.parent_task_id).subtasks.push(r.id);
    return tasks;
}

// ── Reads ────────────────────────────────────────────────────────────────────

async function findById(id) {
    if (!id) return null;
    const { rows } = await query(`SELECT ${SELECT} FROM tasks t WHERE t.id = $1`, [String(id)]);
    if (!rows.length) return null;
    const [task] = await attachRelations([rowToTask(rows[0])]);
    return task;
}

async function findByIds(ids) {
    const list = strs(ids);
    if (!list.length) return [];
    const { rows } = await query(`SELECT ${SELECT} FROM tasks t WHERE t.id = ANY($1)`, [list]);
    return attachRelations(rows.map(rowToTask));
}

/**
 * Build WHERE for the list filters the service uses. `userId` + `channelIds`
 * apply the visibility rule (workspace-visible, mine, assigned to me, or a
 * channel task in one of my channels); `deleted` undefined = any.
 */
function buildWhere(f = {}) {
    const where = [];
    const params = [];
    const p = (v) => { params.push(v); return `$${params.length}`; };

    if (f.workspace) where.push(`t.workspace_id = ${p(str(f.workspace))}`);
    if (f.company) where.push(`t.company_id = ${p(str(f.company))}`);
    if (f.deleted === true) where.push('t.deleted = true');
    else if (f.deleted === false) where.push('t.deleted = false');
    if (f.deletedForNot) where.push(`NOT (${p(str(f.deletedForNot))} = ANY(t.deleted_for))`);
    if (f.status) {
        if (Array.isArray(f.status)) where.push(`t.status = ANY(${p(f.status)})`);
        else where.push(`t.status = ${p(f.status)}`);
    }
    if (f.statusNotIn) where.push(`NOT (t.status = ANY(${p(f.statusNotIn)}))`);
    if (f.priority) where.push(`t.priority = ${p(f.priority)}`);
    if (f.visibility) where.push(`t.visibility = ${p(f.visibility)}`);
    if (f.type) where.push(`t.type = ${p(f.type)}`);
    if (f.createdBy) where.push(`t.created_by = ${p(str(f.createdBy))}`);
    if (f.assignedTo) where.push(`EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ${p(str(f.assignedTo))})`);
    if (f.parentTask === null) where.push('t.parent_task_id IS NULL');
    else if (f.parentTask) where.push(`t.parent_task_id = ${p(str(f.parentTask))}`);
    if (f.excludeSubtasks) where.push("t.parent_task_id IS NULL AND t.type <> 'subtask'");
    if (f.epic) where.push(`t.epic_id = ${p(str(f.epic))}`);
    if (f.project) where.push(`t.project_id = ${p(str(f.project))}`);
    if (f.sprintId) where.push(`t.sprint_id = ${p(str(f.sprintId))}`);
    if (f.milestoneId) where.push(`t.milestone_id = ${p(str(f.milestoneId))}`);
    if (f.channel) where.push(`t.channel_id = ${p(str(f.channel))}`);
    if (f.dueBefore) where.push(`t.due_date <= ${p(date(f.dueBefore))}`);
    if (f.dueAfter) where.push(`t.due_date >= ${p(date(f.dueAfter))}`);
    if (f.search) {
        const like = p(`%${String(f.search).replace(/[%_\\]/g, '\\$&')}%`);
        where.push(`(t.title ILIKE ${like} OR t.description ILIKE ${like} OR t.issue_key ILIKE ${like})`);
    }
    if (f.involves) {
        const uid = p(str(f.involves));
        where.push(`(t.created_by = ${uid} OR EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ${uid}))`);
    }
    if (f.ids) where.push(`t.id = ANY(${p(strs(f.ids))})`);
    if (f.userId) {
        const uid = p(str(f.userId));
        const channels = p((f.channelIds || []).map(String));
        where.push(`(t.visibility = 'workspace' OR t.created_by = ${uid}
            OR EXISTS (SELECT 1 FROM task_assignees a WHERE a.task_id = t.id AND a.user_id = ${uid})
            OR (t.visibility = 'channel' AND t.channel_id = ANY(${channels})))`);
    }
    return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

const SORTABLE = { dueDate: 'due_date', priority: 'priority', createdAt: 'created_at', updatedAt: 'updated_at', title: 'title', status: 'status', startDate: 'start_date' };

/** Mongo-style sort spec -> ORDER BY; nulls sort first ascending like MongoDB. */
function orderBy(sort = { dueDate: 1, priority: -1, createdAt: -1 }) {
    const parts = Object.entries(sort).filter(([k]) => SORTABLE[k])
        .map(([k, dir]) => `t.${SORTABLE[k]} ${Number(dir) < 0 ? 'DESC NULLS LAST' : 'ASC NULLS FIRST'}`);
    return parts.length ? `ORDER BY ${parts.join(', ')}` : 'ORDER BY t.created_at DESC';
}

async function findMany(filter = {}) {
    const { where, params } = buildWhere(filter);
    let sql = `SELECT ${SELECT} FROM tasks t ${where} ${orderBy(filter.sort)}`;
    if (filter.limit) { params.push(Number(filter.limit)); sql += ` LIMIT $${params.length}`; }
    if (filter.skip) { params.push(Number(filter.skip)); sql += ` OFFSET $${params.length}`; }
    const { rows } = await query(sql, params);
    return attachRelations(rows.map(rowToTask));
}

async function count(filter = {}) {
    const { where, params } = buildWhere(filter);
    const { rows } = await query(`SELECT count(*)::int AS n FROM tasks t ${where}`, params);
    return rows[0].n;
}

// ── Writes ───────────────────────────────────────────────────────────────────

function recurringNextDue(recurring) {
    return recurring && recurring.isRecurring && recurring.nextDue ? date(recurring.nextDue) : null;
}

/** Insert a task given Mongo-named fields; relations are inserted too. */
async function insert(task, tx) {
    const id = str(task._id) || newId();
    const run = async (q) => {
        const cols = ['id'];
        const vals = [id];
        for (const [field, col] of Object.entries(COLUMNS)) {
            if (field === 'createdAt' || field === 'updatedAt') continue;
            if (task[field] === undefined && !JSON_FIELDS.has(field) && !ARRAY_FIELDS.has(field)) continue;
            cols.push(col);
            vals.push(toColumn(field, task[field]));
        }
        cols.push('recurring_next_due');
        vals.push(recurringNextDue(task.recurring));
        const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
        await q(`INSERT INTO tasks (${cols.join(', ')}) VALUES (${placeholders})`, vals);
        await setAssignees(id, task.assignedTo || [], q);
        for (const w of strs(task.watchers)) await q('INSERT INTO task_watchers (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, w]);
        for (const d of strs(task.dependencies)) await q('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, d]);
    };
    if (tx) await run(tx.query); else await withTransaction((t) => run(t.query));
    return findById(id);
}

async function setAssignees(taskId, userIds, q = query) {
    await q('DELETE FROM task_assignees WHERE task_id = $1', [taskId]);
    const list = strs(userIds);
    for (let i = 0; i < list.length; i += 1) {
        await q('INSERT INTO task_assignees (task_id, user_id, position) VALUES ($1, $2, $3)', [taskId, list[i], i]);
    }
}

/**
 * Patch a task with Mongo field names. Column fields become SET clauses;
 * assignedTo / watchers / dependencies replace their relation rows.
 */
async function update(id, patch = {}, tx) {
    const taskId = String(id);
    const run = async (q) => {
        const sets = [];
        const params = [];
        for (const [field, value] of Object.entries(patch)) {
            const col = COLUMNS[field];
            if (!col || field === 'createdAt' || field === 'updatedAt') continue;
            params.push(toColumn(field, value));
            sets.push(`${col} = $${params.length}`);
            if (field === 'recurring') { params.push(recurringNextDue(value)); sets.push(`recurring_next_due = $${params.length}`); }
        }
        sets.push('updated_at = now()');
        params.push(taskId);
        await q(`UPDATE tasks SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
        if (patch.assignedTo !== undefined) await setAssignees(taskId, patch.assignedTo, q);
        if (patch.watchers !== undefined) {
            await q('DELETE FROM task_watchers WHERE task_id = $1', [taskId]);
            for (const w of strs(patch.watchers)) await q('INSERT INTO task_watchers (task_id, user_id) VALUES ($1, $2)', [taskId, w]);
        }
        if (patch.dependencies !== undefined) {
            await q('DELETE FROM task_dependencies WHERE task_id = $1', [taskId]);
            for (const d of strs(patch.dependencies)) await q('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2)', [taskId, d]);
        }
    };
    if (tx) await run(tx.query); else await withTransaction((t) => run(t.query));
    return findById(taskId);
}

/** UPDATE ... WHERE filter (Mongo-style patch), for cascades. Returns the row count. */
async function updateWhere(filter, patch) {
    const { where, params } = buildWhere(filter);
    const sets = [];
    for (const [field, value] of Object.entries(patch)) {
        const col = COLUMNS[field];
        if (!col) continue;
        params.push(toColumn(field, value));
        sets.push(`${col} = $${params.length}`);
    }
    if (!sets.length) return 0;
    sets.push('updated_at = now()');
    const { rowCount } = await query(`UPDATE tasks t SET ${sets.join(', ')} ${where}`, params);
    return rowCount;
}

async function addAssignee(taskId, userId) {
    await query('INSERT INTO task_assignees (task_id, user_id, position) VALUES ($1, $2, (SELECT coalesce(max(position), -1) + 1 FROM task_assignees WHERE task_id = $1)) ON CONFLICT DO NOTHING', [String(taskId), str(userId)]);
}
async function removeAssignee(taskId, userId) {
    await query('DELETE FROM task_assignees WHERE task_id = $1 AND user_id = $2', [String(taskId), str(userId)]);
}
async function addWatcher(taskId, userId) {
    await query('INSERT INTO task_watchers (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [String(taskId), str(userId)]);
}
async function removeWatcher(taskId, userId) {
    const { rowCount } = await query('DELETE FROM task_watchers WHERE task_id = $1 AND user_id = $2', [String(taskId), str(userId)]);
    return rowCount;
}
async function listWatchers(taskId) {
    const { rows } = await query('SELECT user_id FROM task_watchers WHERE task_id = $1', [String(taskId)]);
    return rows.map((r) => r.user_id);
}

async function addLink(taskId, linkedTaskId, linkType, createdBy) {
    const { rows } = await query(
        `INSERT INTO task_links (id, task_id, linked_task_id, link_type, created_by) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (task_id, linked_task_id, link_type) DO UPDATE SET link_type = EXCLUDED.link_type RETURNING id`,
        [newId(), String(taskId), String(linkedTaskId), linkType, str(createdBy)]
    );
    return rows[0].id;
}
async function findLink(linkId) {
    const { rows } = await query('SELECT id, task_id, linked_task_id, link_type, created_by, created_at FROM task_links WHERE id = $1', [String(linkId)]);
    if (!rows.length) return null;
    const r = rows[0];
    return { _id: r.id, taskId: r.task_id, task: r.linked_task_id, linkType: r.link_type, createdBy: r.created_by, createdAt: new Date(r.created_at) };
}
async function removeLink(linkId) {
    const { rowCount } = await query('DELETE FROM task_links WHERE id = $1', [String(linkId)]);
    return rowCount;
}
async function removeLinkBetween(taskId, linkedTaskId, linkType) {
    await query('DELETE FROM task_links WHERE task_id = $1 AND linked_task_id = $2 AND link_type = $3', [String(taskId), String(linkedTaskId), linkType]);
}
async function addDependency(taskId, dependsOnId) {
    await query('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [String(taskId), String(dependsOnId)]);
}
async function listDependencies(taskId) {
    const { rows } = await query('SELECT depends_on_id FROM task_dependencies WHERE task_id = $1', [String(taskId)]);
    return rows.map((r) => r.depends_on_id);
}

/** Trash a task and its live subtasks together (same deletedAt, so restore brings back exactly these). */
async function softDelete(taskId, userId, now = new Date()) {
    await withTransaction(async (tx) => {
        await tx.query('UPDATE tasks SET deleted = true, deleted_at = $2, deleted_by = $3, updated_at = now() WHERE id = $1', [String(taskId), now, str(userId)]);
        await tx.query('UPDATE tasks SET deleted = true, deleted_at = $2, deleted_by = $3, updated_at = now() WHERE parent_task_id = $1 AND deleted = false', [String(taskId), now, str(userId)]);
    });
    return now;
}

async function restore(taskId, deletedAt) {
    await withTransaction(async (tx) => {
        await tx.query('UPDATE tasks SET deleted = false, deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE id = $1', [String(taskId)]);
        if (deletedAt) {
            await tx.query('UPDATE tasks SET deleted = false, deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE parent_task_id = $1 AND deleted = true AND deleted_at = $2', [String(taskId), deletedAt]);
        } else {
            await tx.query('UPDATE tasks SET deleted = false, deleted_at = NULL, deleted_by = NULL, updated_at = now() WHERE parent_task_id = $1 AND deleted = true', [String(taskId)]);
        }
    });
}

/** Remove a task and its subtasks for good; relation tables cascade. Returns the removed ids. */
async function hardDelete(taskId) {
    const { rows } = await query('SELECT id FROM tasks WHERE id = $1 OR parent_task_id = $1', [String(taskId)]);
    const ids = rows.map((r) => r.id);
    if (ids.length) await query('DELETE FROM tasks WHERE id = ANY($1)', [ids]);
    return ids;
}

async function hideFor(taskId, userId) {
    await query('UPDATE tasks SET deleted_for = array_append(array_remove(deleted_for, $2), $2), updated_at = now() WHERE id = $1', [String(taskId), str(userId)]);
}

// ── Activity ─────────────────────────────────────────────────────────────────

async function appendActivity({ task, user, action, field = null, from = null, to = null, metadata = null, ipAddress = null, userAgent = null }) {
    const id = newId();
    await query(
        `INSERT INTO task_activity (id, task_id, user_id, action, field, from_value, to_value, metadata, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, str(task), str(user), action, field, json(from ?? null), json(to ?? null), json(metadata ?? null), ipAddress, userAgent]
    );
    return id;
}

function rowToActivity(r) {
    return { _id: r.id, task: r.task_id, user: r.user_id, action: r.action, field: r.field, from: r.from_value, to: r.to_value, metadata: r.metadata, ipAddress: r.ip_address, userAgent: r.user_agent, createdAt: new Date(r.created_at) };
}

async function listActivity(taskId, { limit = 50, offset = 0 } = {}) {
    const [{ rows }, total] = await Promise.all([
        query('SELECT * FROM task_activity WHERE task_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3', [String(taskId), Number(limit), Number(offset)]),
        query('SELECT count(*)::int AS n FROM task_activity WHERE task_id = $1', [String(taskId)]),
    ]);
    return { activities: rows.map(rowToActivity), total: total.rows[0].n };
}

// ── Issue keys ───────────────────────────────────────────────────────────────

function issuePrefix(workspaceName) {
    return (workspaceName || 'TSK').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'TSK';
}

/** ACME-7: one atomic bump per workspace; the prefix is fixed on first use. */
async function nextIssueKey(workspaceId, workspaceName) {
    const { rows } = await query(
        `INSERT INTO task_issue_counters (workspace_id, prefix, seq) VALUES ($1, $2, 1)
         ON CONFLICT (workspace_id) DO UPDATE SET seq = task_issue_counters.seq + 1
         RETURNING prefix, seq`,
        [str(workspaceId), issuePrefix(workspaceName)]
    );
    return `${rows[0].prefix}-${rows[0].seq}`;
}

// ── Crons ────────────────────────────────────────────────────────────────────

async function findRecurringDue(now = new Date()) {
    const { rows } = await query(`SELECT ${SELECT} FROM tasks t WHERE t.recurring_next_due IS NOT NULL AND t.recurring_next_due <= $1 AND t.deleted = false`, [now]);
    return attachRelations(rows.map(rowToTask));
}

const DUE_SOON_SQL = `t.deleted = false AND NOT (t.status = ANY($3)) AND t.due_date >= $1 AND t.due_date <= $2
    AND (t.due_soon_notified_at IS NULL OR t.due_soon_notified_at < t.due_date - interval '24 hours')`;

async function findDueSoon(now, until) {
    const { rows } = await query(`SELECT ${SELECT} FROM tasks t WHERE ${DUE_SOON_SQL}`, [now, until, ['done', 'cancelled']]);
    return attachRelations(rows.map(rowToTask));
}

/** Mark the reminder sent only if nobody else did for this due window. */
async function claimDueSoon(taskId, dueDate, now = new Date()) {
    const { rowCount } = await query(
        `UPDATE tasks t SET due_soon_notified_at = $3 WHERE t.id = $1 AND t.due_date = $2
         AND (t.due_soon_notified_at IS NULL OR t.due_soon_notified_at < t.due_date - interval '24 hours')`,
        [String(taskId), date(dueDate), now]
    );
    return rowCount === 1;
}

/** Open tasks per assignee among the tasks `userId` can see (excluding tasks hidden by that assignee). */
async function workload({ workspace, userId, channelIds }) {
    const { where, params } = buildWhere({ workspace, userId, channelIds, deleted: false, statusNotIn: ['done', 'cancelled'] });
    const { rows } = await query(
        `SELECT a.user_id AS "userId", count(*)::int AS count
         FROM tasks t JOIN task_assignees a ON a.task_id = t.id
         ${where} AND NOT (a.user_id = ANY(t.deleted_for))
         GROUP BY a.user_id ORDER BY count DESC`,
        params
    );
    return rows;
}

// ── Hydration ────────────────────────────────────────────────────────────────
// Users and workspaces come from the PostgreSQL identity store, channels from MongoDB.

const { hydrateTaskUsers, hydrateTaskWorkspaces } = require('./tasks.hydrate');

function collectIds(objs, pick) {
    const ids = new Set();
    for (const o of objs) for (const v of pick(o)) { const s = str(v); if (s) ids.add(s); }
    return [...ids];
}

/** Attach user cards where populate('…', 'username profilePicture') used to, in one query. */
function hydrateUsers(items, fields) {
    return hydrateTaskUsers(items, fields);
}

async function hydrateChannels(tasks) {
    const ids = collectIds(tasks, (t) => [t.channel]);
    if (!ids.length) return tasks;
    const Channel = require('../channels/channel.model.js');
    const rows = await Channel.find({ _id: { $in: ids } }).select('name').lean();
    const map = new Map(rows.map((c) => [String(c._id), { _id: String(c._id), name: c.name }]));
    for (const t of tasks) if (t.channel) t.channel = map.get(str(t.channel)) || t.channel;
    return tasks;
}

function hydrateWorkspaces(tasks) {
    return hydrateTaskWorkspaces(tasks);
}

/** subtasks: [{ _id, title, status, assignedTo, deleted }] like populate('subtasks', 'title status assignedTo deleted'). */
async function hydrateSubtasks(tasks) {
    const ids = collectIds(tasks, (t) => t.subtasks || []);
    if (!ids.length) return tasks;
    const { rows } = await query('SELECT id, title, status, deleted FROM tasks WHERE id = ANY($1)', [ids]);
    const assignees = await query('SELECT task_id, user_id FROM task_assignees WHERE task_id = ANY($1) ORDER BY position', [ids]);
    const byTask = new Map();
    for (const r of assignees.rows) byTask.set(r.task_id, [...(byTask.get(r.task_id) || []), r.user_id]);
    const map = new Map(rows.map((r) => [r.id, { _id: r.id, title: r.title, status: r.status, deleted: r.deleted, assignedTo: byTask.get(r.id) || [] }]));
    for (const t of tasks) t.subtasks = (t.subtasks || []).map((id) => map.get(str(id))).filter(Boolean);
    return tasks;
}

/** Everything populateTask() in tasks.shared.js attaches. */
async function hydrateForClient(tasks) {
    await Promise.all([hydrateUsers(tasks), hydrateChannels(tasks), hydrateSubtasks(tasks)]);
    return tasks;
}

// ── Read API for other features (documented at the top) ─────────────────────

function listForWorkspace(workspaceId, filter = {}) {
    return findMany({ deleted: false, ...filter, workspace: workspaceId });
}

async function countByStatus(workspaceId) {
    const { rows } = await query(
        'SELECT status, count(*)::int AS n FROM tasks WHERE workspace_id = $1 AND deleted = false GROUP BY status',
        [str(workspaceId)]
    );
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
}

function listForUser(userId, filter = {}) {
    return findMany({ deleted: false, deletedForNot: userId, ...filter, involves: userId });
}

function search(workspaceId, text, limit = 20) {
    const q = String(text || '').trim();
    if (!q) return Promise.resolve([]);
    return findMany({ workspace: workspaceId, deleted: false, search: q, limit, sort: { updatedAt: -1 } });
}

// ── Reports: Mongo-style filters for features outside src/features/tasks ─────
//
// Dashboards, analytics, GDPR, integrations and the public API were written
// against `Task.countDocuments(filter)` / `Task.find(filter)` / aggregates.
// `whereFromFilter` translates that filter dialect to SQL so those call sites
// keep their filters (see tasks.query.js for the store-aware facade).
//
// Supported: field equality (null = IS NULL), $in, $nin, $ne, $gt, $gte, $lt,
// $lte, $exists, $regex (+ $options) and RegExp values, $or / $and, `_id`,
// `assignedTo` / `watchers` (relation tables), `tags` / `labels` / `deletedFor`
// (arrays), `externalLinks.url`. Aliases `companyId` → company and
// `workspaceId` → workspace (older callers used them). Anything else throws,
// so a filter is never silently ignored. Tenant-first: callers pass a
// workspace or company in every report.

const FILTER_ALIASES = { companyId: 'company', workspaceId: 'workspace', id: '_id' };
const RELATION_TABLES = { assignedTo: ['task_assignees', 'user_id'], watchers: ['task_watchers', 'user_id'] };
const ARRAY_COLUMNS = { tags: 'tags', labels: 'labels', deletedFor: 'deleted_for' };

const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof RegExp)
    && typeof v.toHexString !== 'function';

function scalarValue(field, v) {
    if (v == null) return v;
    if (v instanceof Date) return v;
    if (ID_FIELDS.has(field) || field === '_id') return str(v);
    if (DATE_FIELDS.has(field)) return new Date(v);
    return v;
}

function whereFromFilter(filter = {}, params = []) {
    const p = (v) => { params.push(v); return `$${params.length}`; };
    const clauses = [];

    const regexClause = (col, source, flags = '') => `${col} ${String(flags).includes('i') ? '~*' : '~'} ${p(String(source))}`;

    function scalar(field, col, cond) {
        if (cond instanceof RegExp) return regexClause(col, cond.source, cond.flags);
        if (!isPlain(cond)) return cond == null ? `${col} IS NULL` : `${col} = ${p(scalarValue(field, cond))}`;
        const parts = [];
        for (const [op, v] of Object.entries(cond)) {
            switch (op) {
                case '$eq': parts.push(v == null ? `${col} IS NULL` : `${col} = ${p(scalarValue(field, v))}`); break;
                case '$ne': parts.push(v == null ? `${col} IS NOT NULL` : `${col} IS DISTINCT FROM ${p(scalarValue(field, v))}`); break;
                case '$in': {
                    const vals = (v || []).filter((x) => x != null).map((x) => scalarValue(field, x));
                    const hasNull = (v || []).some((x) => x == null);
                    parts.push(`(${vals.length ? `${col} = ANY(${p(vals)})` : 'false'}${hasNull ? ` OR ${col} IS NULL` : ''})`);
                    break;
                }
                case '$nin': {
                    const vals = (v || []).filter((x) => x != null).map((x) => scalarValue(field, x));
                    parts.push(vals.length ? `(${col} IS NULL OR NOT (${col} = ANY(${p(vals)})))` : 'true');
                    break;
                }
                case '$gt': parts.push(`${col} > ${p(scalarValue(field, v))}`); break;
                case '$gte': parts.push(`${col} >= ${p(scalarValue(field, v))}`); break;
                case '$lt': parts.push(`${col} < ${p(scalarValue(field, v))}`); break;
                case '$lte': parts.push(`${col} <= ${p(scalarValue(field, v))}`); break;
                case '$exists': parts.push(v ? `${col} IS NOT NULL` : `${col} IS NULL`); break;
                case '$regex': parts.push(regexClause(col, v instanceof RegExp ? v.source : v, cond.$options || (v instanceof RegExp ? v.flags : ''))); break;
                case '$options': break;
                default: throw new Error(`tasks filter: unsupported operator ${op} on ${field}`);
            }
        }
        return parts.length ? parts.join(' AND ') : 'true';
    }

    function relation(field, cond) {
        const [table, col] = RELATION_TABLES[field];
        const exists = (inner) => `EXISTS (SELECT 1 FROM ${table} r WHERE r.task_id = t.id AND ${inner})`;
        if (!isPlain(cond)) return cond == null ? `NOT ${exists('true')}` : exists(`r.${col} = ${p(str(cond))}`);
        const parts = [];
        for (const [op, v] of Object.entries(cond)) {
            if (op === '$in') parts.push(exists(`r.${col} = ANY(${p(strs(v))})`));
            else if (op === '$nin') parts.push(`NOT ${exists(`r.${col} = ANY(${p(strs(v))})`)}`);
            else if (op === '$ne') parts.push(`NOT ${exists(`r.${col} = ${p(str(v))}`)}`);
            else if (op === '$eq') parts.push(exists(`r.${col} = ${p(str(v))}`));
            else if (op === '$exists') parts.push(v ? exists('true') : `NOT ${exists('true')}`);
            else if (op === '$size') parts.push(`(SELECT count(*) FROM ${table} r WHERE r.task_id = t.id) = ${p(Number(v))}`);
            else throw new Error(`tasks filter: unsupported operator ${op} on ${field}`);
        }
        return parts.join(' AND ');
    }

    function arrayCol(field, cond) {
        const col = `t.${ARRAY_COLUMNS[field]}`;
        const conv = (x) => (field === 'deletedFor' ? str(x) : String(x));
        if (cond instanceof RegExp) {
            return `EXISTS (SELECT 1 FROM unnest(${col}) x WHERE x ${cond.flags.includes('i') ? '~*' : '~'} ${p(cond.source)})`;
        }
        if (!isPlain(cond)) return `${p(conv(cond))} = ANY(${col})`;
        const parts = [];
        for (const [op, v] of Object.entries(cond)) {
            if (op === '$in') parts.push(`${col} && ${p((v || []).map(conv))}::text[]`);
            else if (op === '$nin') parts.push(`NOT (${col} && ${p((v || []).map(conv))}::text[])`);
            else if (op === '$ne') parts.push(`NOT (${p(conv(v))} = ANY(${col}))`);
            else if (op === '$all') parts.push(`${col} @> ${p((v || []).map(conv))}::text[]`);
            else if (op === '$size') parts.push(`cardinality(${col}) = ${p(Number(v))}`);
            else throw new Error(`tasks filter: unsupported operator ${op} on ${field}`);
        }
        return parts.join(' AND ');
    }

    for (const [rawKey, cond] of Object.entries(filter || {})) {
        if (cond === undefined) continue;
        if (rawKey === '$or' || rawKey === '$and') {
            const subs = (cond || []).map((sub) => `(${whereFromFilter(sub, params).clause})`);
            if (subs.length) clauses.push(`(${subs.join(rawKey === '$or' ? ' OR ' : ' AND ')})`);
            else if (rawKey === '$or') clauses.push('false');
            continue;
        }
        const key = FILTER_ALIASES[rawKey] || rawKey;
        if (key === '_id') { clauses.push(scalar('_id', 't.id', cond)); continue; }
        if (RELATION_TABLES[key]) { clauses.push(relation(key, cond)); continue; }
        if (ARRAY_COLUMNS[key]) { clauses.push(arrayCol(key, cond)); continue; }
        if (key === 'externalLinks.url') {
            if (isPlain(cond)) throw new Error('tasks filter: externalLinks.url supports equality only');
            clauses.push(`t.external_links @> ${p(JSON.stringify([{ url: String(cond) }]))}::jsonb`);
            continue;
        }
        if (key === 'recurring.isRecurring') {
            clauses.push(cond ? 't.recurring_next_due IS NOT NULL' : 't.recurring_next_due IS NULL');
            continue;
        }
        const col = COLUMNS[key];
        if (!col) throw new Error(`tasks filter: unsupported field ${rawKey}`);
        clauses.push(scalar(key, `t.${col}`, cond));
    }
    return { clause: clauses.length ? clauses.join(' AND ') : 'true', params };
}

const SELECT_FIELDS_ALWAYS = ['_id'];

/** Keep only the fields of a Mongo `.select('a b c')` string (plus _id). */
function project(task, select) {
    if (!select) return task;
    const fields = String(select).split(/\s+/).filter(Boolean);
    if (fields.every((f) => f.startsWith('-'))) {
        const out = { ...task };
        for (const f of fields) delete out[f.slice(1)];
        return out;
    }
    const out = {};
    for (const f of [...SELECT_FIELDS_ALWAYS, ...fields.filter((f) => !f.startsWith('-'))]) {
        const top = f.split('.')[0];
        if (task[top] !== undefined) out[top] = task[top];
    }
    return out;
}

/** count(*) for a Mongo-style filter. */
async function countWhere(filter = {}) {
    const { clause, params } = whereFromFilter(filter);
    const { rows } = await query(`SELECT count(*)::int AS n FROM tasks t WHERE ${clause}`, params);
    return rows[0].n;
}

/** Lean-shaped tasks for a Mongo-style filter. opts: { sort, limit, skip, select }. */
async function findWhere(filter = {}, { sort, limit, skip, select } = {}) {
    const { clause, params } = whereFromFilter(filter);
    let sql = `SELECT ${SELECT} FROM tasks t WHERE ${clause} ${orderBy(sort || { createdAt: -1 })}`;
    if (limit) { params.push(Number(limit)); sql += ` LIMIT $${params.length}`; }
    if (skip) { params.push(Number(skip)); sql += ` OFFSET $${params.length}`; }
    const { rows } = await query(sql, params);
    const tasks = await attachRelations(rows.map(rowToTask));
    return select ? tasks.map((t) => project(t, select)) : tasks;
}

async function findOneWhere(filter = {}, opts = {}) {
    const [task] = await findWhere(filter, { ...opts, limit: 1 });
    return task || null;
}

/** Hard delete every task matching the filter (relations cascade). Returns { deletedCount }. */
async function deleteWhere(filter = {}) {
    const { clause, params } = whereFromFilter(filter);
    const { rowCount } = await query(`DELETE FROM tasks t WHERE ${clause}`, params);
    return { deletedCount: rowCount };
}

const GROUP_KEYS = {
    status: 't.status', priority: 't.priority', workspace: 't.workspace_id', company: 't.company_id',
    createdBy: 't.created_by', assignee: 'a.user_id',
};

/**
 * [{ _id, count, done }] grouped by status | priority | workspace | company |
 * createdBy | assignee, like `$group` with `{ $sum: 1 }` and a done counter.
 * `assignee` unwinds assignees (a task with two assignees counts for both);
 * `onlyAssignees` restricts that unwind to the given user ids.
 */
async function groupCount(filter, by, { doneStatus = 'done', onlyAssignees } = {}) {
    const key = GROUP_KEYS[by];
    if (!key) throw new Error(`tasks groupCount: unsupported key ${by}`);
    const { clause, params } = whereFromFilter(filter);
    let join = '';
    if (by === 'assignee') {
        join = 'JOIN task_assignees a ON a.task_id = t.id';
        if (onlyAssignees) { params.push(strs(onlyAssignees)); join += ` AND a.user_id = ANY($${params.length})`; }
    }
    params.push(doneStatus);
    const { rows } = await query(
        `SELECT ${key} AS id, count(*)::int AS count, count(*) FILTER (WHERE t.status = $${params.length})::int AS done
         FROM tasks t ${join} WHERE ${clause} GROUP BY ${key} ORDER BY count DESC`,
        params
    );
    return rows.map((r) => ({ _id: r.id, count: r.count, done: r.done }));
}

/** { total, completed } over the filter (completed = status done). */
async function totals(filter = {}, { doneStatuses = ['done'] } = {}) {
    const { clause, params } = whereFromFilter(filter);
    params.push(doneStatuses);
    const { rows } = await query(
        `SELECT count(*)::int AS total, count(*) FILTER (WHERE t.status = ANY($${params.length}))::int AS completed FROM tasks t WHERE ${clause}`,
        params
    );
    return rows[0];
}

/** Average hours from creation to completion over completed tasks in the filter; null when none. */
async function avgCompletionHours(filter = {}) {
    const { clause, params } = whereFromFilter(filter);
    const { rows } = await query(
        `SELECT avg(EXTRACT(EPOCH FROM (t.completed_at - t.created_at)) / 3600)::float AS hours
         FROM tasks t WHERE ${clause} AND t.completed_at IS NOT NULL`,
        params
    );
    return rows[0].hours == null ? null : Number(rows[0].hours);
}

/**
 * Counts per time bucket on one date field, in a single query:
 * buckets [{ start, end }] → [n, n, ...] in the same order (inclusive ends, like $gte/$lte).
 */
async function countBuckets(filter, field, buckets) {
    const col = { createdAt: 't.created_at', completedAt: 't.completed_at', updatedAt: 't.updated_at', dueDate: 't.due_date' }[field];
    if (!col) throw new Error(`tasks countBuckets: unsupported field ${field}`);
    if (!buckets.length) return [];
    const { clause, params } = whereFromFilter(filter);
    params.push(buckets.map((b) => new Date(b.start)));
    const starts = `$${params.length}`;
    params.push(buckets.map((b) => new Date(b.end)));
    const ends = `$${params.length}`;
    const { rows } = await query(
        `SELECT b.i, count(t.id)::int AS n
         FROM unnest(${starts}::timestamptz[], ${ends}::timestamptz[]) WITH ORDINALITY AS b(s, e, i)
         LEFT JOIN tasks t ON ${col} >= b.s AND ${col} <= b.e AND ${clause}
         GROUP BY b.i ORDER BY b.i`,
        params
    );
    return rows.map((r) => r.n);
}

module.exports = {
    listForWorkspace, countByStatus, listForUser, search,
    newId, rowToTask, withTaskMethods, buildWhere, orderBy, COLUMNS,
    findById, findByIds, findMany, count,
    insert, update, updateWhere, setAssignees, addAssignee, removeAssignee, addWatcher, removeWatcher, listWatchers,
    addLink, findLink, removeLink, removeLinkBetween, addDependency, listDependencies,
    softDelete, restore, hardDelete, hideFor,
    appendActivity, listActivity,
    nextIssueKey, issuePrefix,
    findRecurringDue, findDueSoon, claimDueSoon, workload,
    hydrateUsers, hydrateChannels, hydrateWorkspaces, hydrateSubtasks, hydrateForClient,
    // reports (Mongo-style filters)
    whereFromFilter, project, countWhere, findWhere, findOneWhere, deleteWhere, groupCount, totals, avgCompletionHours, countBuckets,
};
