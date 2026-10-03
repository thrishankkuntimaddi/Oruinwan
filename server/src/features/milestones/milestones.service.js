const Milestone = require('../../../models/Milestone');
const identity = require('../../identity');
const { hydrateTaskUsers } = require('../tasks/tasks.hydrate');
const { tasksStore } = require('../tasks/tasks.store');

// TASKS_STORE=pg keeps milestones in PostgreSQL (tasks/planning.repository.js).
const onPg = () => tasksStore() === 'pg';
const planning = () => require('../tasks/planning.repository');
const hydrateCreator = (docs) => hydrateTaskUsers(docs, ['createdBy']);

const UPDATABLE = ['name', 'description', 'dueDate', 'startDate', 'endDate', 'status'];

/** Active member of the workspace (PostgreSQL identity store). */
async function _validateMember(userId, workspaceId) {
    const access = workspaceId ? await identity.workspaces.membership(workspaceId, userId) : null;
    if (!access || !access.member) {
        const e = new Error('Access denied'); e.statusCode = 403; throw e;
    }
    return access.workspace;
}

async function getMilestones(userId, workspaceId) {
    if (!workspaceId) { const e = new Error('workspaceId required'); e.statusCode = 400; throw e; }
    await _validateMember(userId, workspaceId);
    if (onPg()) {
        const milestones = await planning().milestones.findMany({ workspace: workspaceId, deleted: false });
        const counts = await planning().milestoneTaskCounts(milestones.map((x) => x._id));
        for (const x of milestones) x.taskCounts = counts[x._id] || { total: 0, done: 0 };
        await hydrateCreator(milestones);
        return { milestones };
    }
    const milestones = await Milestone.find({ workspace: workspaceId, deleted: false })
        .sort({ dueDate: 1 })
        .lean();
    await hydrateTaskUsers(milestones, ['createdBy']);
    return { milestones };
}

async function createMilestone(userId, data) {
    const { workspaceId, name, dueDate, startDate, endDate, description } = data;
    if (!workspaceId || !name) {
        const e = new Error('workspaceId and name required'); e.statusCode = 400; throw e;
    }
    const user = await identity.users.findById(userId);
    await _validateMember(userId, workspaceId);
    const milestone = await (onPg() ? planning().milestones.insert.bind(planning().milestones) : Milestone.create.bind(Milestone))({
        workspace: workspaceId,
        company: user?.companyId || null,
        name, description: description || '',
        dueDate: dueDate ? new Date(dueDate) : null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        createdBy: userId
    });
    return { milestone };
}

async function updateMilestone(userId, milestoneId, data) {
    if (onPg()) {
        const existing = await planning().milestones.findById(milestoneId);
        if (!existing || existing.deleted) { const e = new Error('Milestone not found'); e.statusCode = 404; throw e; }
        await _validateMember(userId, existing.workspace);
        const patch = {};
        UPDATABLE.forEach(f => { if (data[f] !== undefined) patch[f] = data[f]; });
        return { milestone: await planning().milestones.update(milestoneId, patch) };
    }
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone || milestone.deleted) { const e = new Error('Milestone not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, milestone.workspace);
    const allowed = UPDATABLE;
    allowed.forEach(f => { if (data[f] !== undefined) milestone[f] = data[f]; });
    await milestone.save();
    return { milestone };
}

async function deleteMilestone(userId, milestoneId) {
    if (onPg()) {
        const existing = await planning().milestones.findById(milestoneId);
        if (!existing || existing.deleted) { const e = new Error('Milestone not found'); e.statusCode = 404; throw e; }
        await _validateMember(userId, existing.workspace);
        await planning().milestones.softDelete(milestoneId);
        return { message: 'Milestone deleted' };
    }
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone || milestone.deleted) { const e = new Error('Milestone not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, milestone.workspace);
    milestone.deleted = true;
    await milestone.save();
    return { message: 'Milestone deleted' };
}

module.exports = { getMilestones, createMilestone, updateMilestone, deleteMilestone };
