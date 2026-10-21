'use strict';

/**
 * Storage gateway for milestones and the tasks linked to them, over both task
 * stores (TASKS_STORE=pg -> PostgreSQL via tasks/planning.repository.js and
 * tasks/tasks.repository.js, otherwise MongoDB models). Everything returned is
 * lean-shaped ({ _id, ... }) so callers never care which store answered.
 */

const { tasksStore } = require('../tasks/tasks.store');

const onPg = () => tasksStore() === 'pg';
const planning = () => require('../tasks/planning.repository');
const taskRepo = () => require('../tasks/tasks.repository');
const Milestone = () => require('../../../models/Milestone');
const Task = () => require('../../../models/Task');

const idStr = (v) => String(v?._id || v || '');
const TASK_FIELDS = '_id title status milestoneId project workspace visibility createdBy assignedTo channel issueKey dueDate priority estimatedHours';

function slimTask(t) {
    return {
        _id: idStr(t._id),
        title: t.title,
        status: t.status,
        milestoneId: t.milestoneId ? idStr(t.milestoneId) : null,
        project: t.project ? idStr(t.project) : null,
        workspace: t.workspace ? idStr(t.workspace) : null,
        visibility: t.visibility,
        createdBy: t.createdBy ? idStr(t.createdBy) : null,
        assignedTo: (t.assignedTo || []).map(idStr),
        channel: t.channel ? idStr(t.channel) : null,
        issueKey: t.issueKey || null,
        dueDate: t.dueDate || null,
        priority: t.priority,
        estimatedHours: t.estimatedHours ?? null,
    };
}

async function findMilestone(id) {
    if (onPg()) return planning().milestones.findById(id);
    return Milestone().findById(id).lean();
}

/** Live milestones of a workspace, optionally limited to `ids`. */
async function findMilestones(workspaceId, ids) {
    if (onPg()) {
        const filter = { workspace: workspaceId, deleted: false };
        if (ids) filter.ids = ids.map(String);
        return planning().milestones.findMany(filter);
    }
    const q = { workspace: workspaceId, deleted: false };
    if (ids) q._id = { $in: ids.map(String) };
    return Milestone().find(q).sort({ dueDate: 1 }).lean();
}

/** Non-deleted tasks matching any of: ids, milestoneIds, projectId — scoped to one workspace. */
async function findTasks(workspaceId, { ids = [], milestoneIds = [], projectId = null } = {}) {
    const out = new Map();
    const add = (list) => (list || []).forEach((t) => {
        if (idStr(t.workspace) === String(workspaceId)) out.set(idStr(t._id), slimTask(t));
    });
    if (onPg()) {
        const repo = taskRepo();
        if (ids.length) add(await repo.findMany({ workspace: workspaceId, deleted: false, ids: ids.map(String) }));
        for (const m of milestoneIds) add(await repo.findMany({ workspace: workspaceId, deleted: false, milestoneId: String(m) }));
        if (projectId) add(await repo.findMany({ workspace: workspaceId, deleted: false, project: String(projectId) }));
        return [...out.values()];
    }
    const or = [];
    if (ids.length) or.push({ _id: { $in: ids.map(String) } });
    if (milestoneIds.length) or.push({ milestoneId: { $in: milestoneIds.map(String) } });
    if (projectId) or.push({ project: String(projectId) });
    if (!or.length) return [];
    add(await Task().find({ workspace: workspaceId, deleted: false, $or: or }).select(TASK_FIELDS).lean());
    return [...out.values()];
}

/** Point tasks at a milestone (or detach with milestoneId = null). */
async function setTasksMilestone(taskIds, milestoneId) {
    if (!taskIds.length) return;
    if (onPg()) {
        const repo = taskRepo();
        for (const id of taskIds) await repo.update(String(id), { milestoneId: milestoneId ? String(milestoneId) : null });
        return;
    }
    await Task().updateMany({ _id: { $in: taskIds.map(String) } }, { $set: { milestoneId: milestoneId || null } });
}

/** Detach every task from a milestone (used when the milestone is deleted). */
async function detachAllTasks(workspaceId, milestoneId) {
    const tasks = await findTasks(workspaceId, { milestoneIds: [milestoneId] });
    await setTasksMilestone(tasks.map((t) => t._id), null);
    return tasks.length;
}

module.exports = { onPg, findMilestone, findMilestones, findTasks, setTasksMilestone, detachAllTasks, slimTask, idStr };
