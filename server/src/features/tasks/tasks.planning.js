'use strict';

/**
 * Store-agnostic helpers for the planning fields of a task: milestone links,
 * blockers (dependencies + "is blocked by" links) and estimated-hour totals.
 * Reads go to MongoDB or PostgreSQL depending on TASKS_STORE.
 */

const { tasksStore } = require('./tasks.store');
const { httpError, isObjectId, idOf } = require('./tasks.shared');
const { recurringForTask } = require('./tasks.recurrence');

const onPg = () => tasksStore() === 'pg';
const CLOSED = new Set(['done', 'cancelled']);

/**
 * Validate a milestone id for a task in `workspaceId`. Returns the id, or null
 * when `milestoneId` is null/'' (unlink). 400 when it is malformed, unknown,
 * deleted or belongs to another workspace.
 */
async function resolveMilestoneId(milestoneId, workspaceId) {
    if (milestoneId === null || milestoneId === '') return null;
    if (!isObjectId(String(milestoneId))) throw httpError(400, 'Invalid milestoneId');
    let milestone;
    if (onPg()) {
        milestone = await require('./planning.repository').milestones.findById(String(milestoneId));
    } else {
        const Milestone = require('../../../models/Milestone');
        milestone = await Milestone.findById(milestoneId).select('workspace deleted').lean();
    }
    if (!milestone || milestone.deleted || idOf(milestone.workspace) !== idOf(workspaceId)) {
        throw httpError(400, 'Milestone not found in this workspace');
    }
    return String(milestone._id || milestoneId);
}

/** Same as resolveMilestoneId for sprints (sprintId on a task). */
async function resolveSprintId(sprintId, workspaceId) {
    if (sprintId === null || sprintId === '') return null;
    if (!isObjectId(String(sprintId))) throw httpError(400, 'Invalid sprintId');
    let sprint;
    if (onPg()) {
        sprint = await require('./planning.repository').sprints.findById(String(sprintId));
    } else {
        const Sprint = require('../../../models/Sprint');
        sprint = await Sprint.findById(sprintId).select('workspace deleted').lean();
    }
    if (!sprint || sprint.deleted || idOf(sprint.workspace) !== idOf(workspaceId)) {
        throw httpError(400, 'Sprint not found in this workspace');
    }
    return String(sprint._id || sprintId);
}

/** Ids of the tasks that block `task`: its dependencies plus `is_blocked_by` links. */
function blockerIds(task) {
    const ids = new Set((task.dependencies || []).map(idOf));
    for (const l of task.linkedIssues || []) {
        if (l && l.linkType === 'is_blocked_by' && l.task) ids.add(idOf(l.task));
    }
    ids.delete(idOf(task._id));
    return [...ids].filter((id) => isObjectId(id));
}

/** Blocking tasks that are still open: [{ _id, title, issueKey, status }]. */
async function openBlockers(task) {
    const ids = blockerIds(task);
    if (!ids.length) return [];
    let tasks;
    if (onPg()) {
        tasks = await require('./tasks.repository').findByIds(ids);
    } else {
        const Task = require('../../../models/Task');
        tasks = await Task.find({ _id: { $in: ids } }).select('title issueKey status deleted').lean();
    }
    return (tasks || [])
        .filter((t) => t && !t.deleted && !CLOSED.has(t.status))
        .map((t) => ({ _id: String(t._id), title: t.title, issueKey: t.issueKey || null, status: t.status }));
}

/**
 * Throw 409 TASK_BLOCKED when `task` still has open blockers. Clients may
 * complete it anyway by sending `ignoreBlockers: true`.
 */
async function assertNoOpenBlockers(task) {
    const blockers = await openBlockers(task);
    if (blockers.length) {
        throw httpError(409, `This task is blocked by ${blockers.length} open task${blockers.length === 1 ? '' : 's'}. Complete them first or send ignoreBlockers: true.`, {
            code: 'TASK_BLOCKED',
            blockers,
        });
    }
}

function nonNegative(value, field) {
    if (value === null || value === '') return null;
    const n = Number(value);
    if (typeof value === 'boolean' || !Number.isFinite(n) || n < 0) throw httpError(400, `${field} must be a non-negative number`);
    return n;
}

function optionalDate(value, field) {
    if (value === null || value === '') return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) throw httpError(400, `Invalid ${field}`);
    return d;
}

/**
 * Planning fields accepted when a task is created:
 *   estimatedHours, storyPoints, startDate, milestoneId, sprintId, recurring
 * Returns only the fields the client sent, validated.
 */
async function planningFieldsForCreate(data, workspaceId, now = new Date()) {
    const out = {};
    if (data.estimatedHours !== undefined) out.estimatedHours = nonNegative(data.estimatedHours, 'estimatedHours');
    if (data.storyPoints !== undefined) out.storyPoints = nonNegative(data.storyPoints, 'storyPoints');
    if (data.startDate !== undefined) out.startDate = optionalDate(data.startDate, 'startDate');
    if (data.milestoneId !== undefined) out.milestoneId = await resolveMilestoneId(data.milestoneId, workspaceId);
    if (data.sprintId !== undefined) out.sprintId = await resolveSprintId(data.sprintId, workspaceId);
    if (data.recurring !== undefined) out.recurring = recurringForTask(data.recurring, data.dueDate || null, now);
    return out;
}

const sameDate = (a, b) => (a ? new Date(a).getTime() : null) === (b ? new Date(b).getTime() : null);

/**
 * Planning changes on update (milestoneId, sprintId, startDate, recurring). Returns
 * { patch, changes } with only real changes; the caller checks edit rights
 * when `changes` is non-empty.
 */
async function planningPatchForUpdate(task, updates, now = new Date()) {
    const patch = {};
    const changes = [];
    if (updates.milestoneId !== undefined) {
        const next = await resolveMilestoneId(updates.milestoneId, task.workspace);
        const current = task.milestoneId ? idOf(task.milestoneId) : null;
        if (next !== current) {
            patch.milestoneId = next;
            changes.push({ action: 'updated', field: 'milestoneId', from: current, to: next });
        }
    }
    if (updates.sprintId !== undefined) {
        const next = await resolveSprintId(updates.sprintId, task.workspace);
        const current = task.sprintId ? idOf(task.sprintId) : null;
        if (next !== current) {
            patch.sprintId = next;
            changes.push({ action: 'updated', field: 'sprintId', from: current, to: next });
        }
    }
    if (updates.startDate !== undefined) {
        const next = optionalDate(updates.startDate, 'startDate');
        if (!sameDate(next, task.startDate)) {
            patch.startDate = next;
            changes.push({ action: 'updated', field: 'startDate', from: task.startDate || null, to: next });
        }
    }
    if (updates.recurring !== undefined) {
        const dueDate = updates.dueDate !== undefined ? updates.dueDate : task.dueDate;
        const next = recurringForTask(updates.recurring, dueDate, now);
        const plain = (r) => JSON.stringify(r ? {
            isRecurring: !!r.isRecurring, pattern: r.pattern || null, interval: r.interval || 1,
            daysOfWeek: [...(r.daysOfWeek || [])], dayOfMonth: r.dayOfMonth || null,
            endDate: r.endDate ? new Date(r.endDate).getTime() : null, nextDue: r.nextDue ? new Date(r.nextDue).getTime() : null,
        } : null);
        const current = task.recurring && typeof task.recurring.toObject === 'function' ? task.recurring.toObject() : task.recurring;
        if (plain(next) !== plain(current)) {
            patch.recurring = next;
            changes.push({ action: 'updated', field: 'recurring', from: current ? { isRecurring: !!current.isRecurring, pattern: current.pattern || null } : null, to: { isRecurring: next.isRecurring, pattern: next.pattern } });
        }
    }
    return { patch, changes };
}

module.exports = {
    resolveMilestoneId, resolveSprintId, blockerIds, openBlockers, assertNoOpenBlockers,
    planningFieldsForCreate, planningPatchForUpdate,
};
