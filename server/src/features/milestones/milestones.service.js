'use strict';

/**
 * Milestones: CRUD, task linking and progress. Works on both task stores
 * (TASKS_STORE=pg -> PostgreSQL, otherwise MongoDB) through milestones.store.js.
 *
 * Access: any active member of the workspace reads, creates and edits
 * milestones; linking a task also requires that the caller can see the task.
 */

const Milestone = require('../../../models/Milestone');
const identity = require('../../identity');
const { hydrateTaskUsers } = require('../tasks/tasks.hydrate');
const store = require('./milestones.store');
const { milestoneProgress } = require('./milestones.progress');
const { isValidId } = require('../../shared/utils/workspaceAccess');

const planning = () => require('../tasks/planning.repository');
const hydrateCreator = (docs) => hydrateTaskUsers(docs, ['createdBy']);

const UPDATABLE = ['name', 'description', 'dueDate', 'startDate', 'endDate', 'status'];
const STATUSES = ['not_started', 'in_progress', 'completed', 'at_risk'];
const DATE_FIELDS = ['dueDate', 'startDate', 'endDate'];
const MAX_LINK = 200;

const fail = (statusCode, message) => Object.assign(new Error(message), { statusCode });

/** Active member of the workspace (PostgreSQL identity store). */
async function _validateMember(userId, workspaceId) {
    const access = workspaceId ? await identity.workspaces.membership(workspaceId, userId) : null;
    if (!access || !access.member) throw fail(403, 'Access denied');
    return access.workspace;
}

/** Validate and normalise a create/update body. Throws 400 on bad input. */
function cleanFields(data, { partial }) {
    const out = {};
    for (const f of UPDATABLE) {
        if (data[f] === undefined) continue;
        if (f === 'name') {
            const name = typeof data.name === 'string' ? data.name.trim() : '';
            if (!name) throw fail(400, 'name must be a non-empty string');
            if (name.length > 200) throw fail(400, 'name is too long (200 max)');
            out.name = name;
        } else if (f === 'description') {
            if (typeof data.description !== 'string') throw fail(400, 'description must be a string');
            out.description = data.description.slice(0, 5000);
        } else if (f === 'status') {
            if (!STATUSES.includes(data.status)) throw fail(400, `status must be one of ${STATUSES.join(', ')}`);
            out.status = data.status;
        } else if (DATE_FIELDS.includes(f)) {
            if (data[f] === null || data[f] === '') { out[f] = null; continue; }
            const d = new Date(data[f]);
            if (Number.isNaN(d.getTime())) throw fail(400, `${f} must be a valid date`);
            out[f] = d;
        }
    }
    const start = out.startDate, end = out.endDate;
    if (start && end && start > end) throw fail(400, 'startDate must be before endDate');
    if (!partial && !out.name) throw fail(400, 'workspaceId and name required');
    return out;
}

/** A task the user may see: workspace-visible, or they created / are assigned to it. */
function canSeeTask(task, userId) {
    const uid = String(userId);
    return task.visibility === 'workspace' || task.createdBy === uid || (task.assignedTo || []).includes(uid);
}

async function loadMilestone(userId, milestoneId) {
    if (!isValidId(milestoneId) && !store.onPg()) throw fail(404, 'Milestone not found');
    const m = await store.findMilestone(milestoneId);
    if (!m || m.deleted) throw fail(404, 'Milestone not found');
    await _validateMember(userId, m.workspace);
    return m;
}

function withProgress(m, tasks) {
    const progress = milestoneProgress(m, tasks);
    return { ...m, taskCounts: { total: progress.total, done: progress.done }, progress };
}

async function getMilestones(userId, workspaceId) {
    if (!workspaceId) throw fail(400, 'workspaceId required');
    await _validateMember(userId, workspaceId);
    const milestones = await store.findMilestones(workspaceId);
    const tasks = milestones.length
        ? await store.findTasks(workspaceId, { milestoneIds: milestones.map((m) => String(m._id)) })
        : [];
    const out = milestones.map((m) => withProgress(m, tasks.filter((t) => t.milestoneId === String(m._id))));
    await hydrateCreator(out);
    return { milestones: out };
}

async function getMilestone(userId, milestoneId) {
    const m = await loadMilestone(userId, milestoneId);
    const tasks = await store.findTasks(String(m.workspace), { milestoneIds: [String(m._id)] });
    const out = withProgress(m, tasks);
    out.tasks = tasks.filter((t) => canSeeTask(t, userId));
    await hydrateCreator([out]);
    return { milestone: out };
}

async function getProgress(userId, milestoneId) {
    const m = await loadMilestone(userId, milestoneId);
    const tasks = await store.findTasks(String(m.workspace), { milestoneIds: [String(m._id)] });
    return { milestoneId: String(m._id), progress: milestoneProgress(m, tasks) };
}

async function createMilestone(userId, data) {
    const { workspaceId } = data || {};
    if (!workspaceId || !data.name) throw fail(400, 'workspaceId and name required');
    const fields = cleanFields(data, { partial: false });
    const user = await identity.users.findById(userId);
    await _validateMember(userId, workspaceId);
    const doc = {
        workspace: workspaceId,
        company: user?.companyId || null,
        description: '',
        dueDate: null, startDate: null, endDate: null,
        ...fields,
        createdBy: userId,
    };
    const milestone = store.onPg() ? await planning().milestones.insert(doc) : await Milestone.create(doc);
    return { milestone };
}

async function updateMilestone(userId, milestoneId, data) {
    const patch = cleanFields(data || {}, { partial: true });
    if (store.onPg()) {
        const existing = await planning().milestones.findById(milestoneId);
        if (!existing || existing.deleted) throw fail(404, 'Milestone not found');
        await _validateMember(userId, existing.workspace);
        return { milestone: await planning().milestones.update(milestoneId, patch) };
    }
    if (!isValidId(milestoneId)) throw fail(404, 'Milestone not found');
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone || milestone.deleted) throw fail(404, 'Milestone not found');
    await _validateMember(userId, milestone.workspace);
    Object.assign(milestone, patch);
    await milestone.save();
    return { milestone };
}

async function deleteMilestone(userId, milestoneId) {
    if (store.onPg()) {
        const existing = await planning().milestones.findById(milestoneId);
        if (!existing || existing.deleted) throw fail(404, 'Milestone not found');
        await _validateMember(userId, existing.workspace);
        await planning().milestones.softDelete(milestoneId);
        await store.detachAllTasks(String(existing.workspace), String(existing._id));
        return { message: 'Milestone deleted' };
    }
    if (!isValidId(milestoneId)) throw fail(404, 'Milestone not found');
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone || milestone.deleted) throw fail(404, 'Milestone not found');
    await _validateMember(userId, milestone.workspace);
    milestone.deleted = true;
    await milestone.save();
    await store.detachAllTasks(String(milestone.workspace), String(milestone._id));
    return { message: 'Milestone deleted' };
}

/**
 * Link tasks to a milestone. Each task must belong to the milestone's
 * workspace and be visible to the caller; a task moves from any previous
 * milestone (a task has at most one). Returns the linked ids and the new progress.
 */
async function linkTasks(userId, milestoneId, taskIds) {
    if (!Array.isArray(taskIds) || !taskIds.length) throw fail(400, 'taskIds must be a non-empty array');
    if (taskIds.length > MAX_LINK) throw fail(400, `At most ${MAX_LINK} tasks per request`);
    const ids = [...new Set(taskIds.map(String))];
    if (ids.some((id) => !isValidId(id))) throw fail(400, 'Invalid task id(s)');
    const m = await loadMilestone(userId, milestoneId);
    const ws = String(m.workspace);
    const tasks = await store.findTasks(ws, { ids });
    const found = new Map(tasks.map((t) => [t._id, t]));
    const missing = ids.filter((id) => !found.has(id) || !canSeeTask(found.get(id), userId));
    if (missing.length) {
        const err = fail(400, 'Some tasks are not in this workspace or not visible to you');
        err.errors = missing;
        throw err;
    }
    await store.setTasksMilestone(ids, String(m._id));
    return { milestoneId: String(m._id), linked: ids, ...(await getProgress(userId, milestoneId)) };
}

async function unlinkTask(userId, milestoneId, taskId) {
    const m = await loadMilestone(userId, milestoneId);
    const tasks = await store.findTasks(String(m.workspace), { ids: [String(taskId)] });
    const task = tasks[0];
    if (!task || task.milestoneId !== String(m._id)) throw fail(404, 'Task is not linked to this milestone');
    if (!canSeeTask(task, userId)) throw fail(403, 'Not authorized to change this task');
    await store.setTasksMilestone([task._id], null);
    return { milestoneId: String(m._id), unlinked: task._id, ...(await getProgress(userId, milestoneId)) };
}

module.exports = {
    STATUSES,
    getMilestones, getMilestone, getProgress,
    createMilestone, updateMilestone, deleteMilestone,
    linkTasks, unlinkTask,
    canSeeTask,
};
