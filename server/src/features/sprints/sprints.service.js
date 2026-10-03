const Sprint = require('../../../models/Sprint');
const identity = require('../../identity');
const { hydrateTaskUsers } = require('../tasks/tasks.hydrate');
const { tasksStore } = require('../tasks/tasks.store');

// TASKS_STORE=pg keeps sprints in PostgreSQL (tasks/planning.repository.js).
const onPg = () => tasksStore() === 'pg';
const planning = () => require('../tasks/planning.repository');
const hydrateCreator = (docs) => hydrateTaskUsers(docs, ['createdBy']);

const UPDATABLE = ['name', 'goal', 'startDate', 'endDate', 'status', 'boardColumns'];

/** Active member of the workspace (PostgreSQL identity store). */
async function _validateMember(userId, workspaceId) {
    const access = workspaceId ? await identity.workspaces.membership(workspaceId, userId) : null;
    if (!access || !access.member) {
        const e = new Error('Access denied'); e.statusCode = 403; throw e;
    }
    return access.workspace;
}

async function getSprints(userId, workspaceId) {
    if (!workspaceId) { const e = new Error('workspaceId required'); e.statusCode = 400; throw e; }
    await _validateMember(userId, workspaceId);
    if (onPg()) {
        const sprints = await planning().sprints.findMany({ workspace: workspaceId, deleted: false });
        const counts = await planning().sprintTaskCounts(sprints.map((x) => x._id));
        for (const x of sprints) x.taskCounts = counts[x._id] || { total: 0, done: 0 };
        await hydrateCreator(sprints);
        return { sprints };
    }
    const sprints = await Sprint.find({ workspace: workspaceId, deleted: false })
        .sort({ startDate: 1 })
        .lean();
    await hydrateTaskUsers(sprints, ['createdBy']);
    return { sprints };
}

async function createSprint(userId, data) {
    const { workspaceId, name, startDate, endDate, goal } = data;
    if (!workspaceId || !name || !startDate || !endDate) {
        const e = new Error('workspaceId, name, startDate, endDate required'); e.statusCode = 400; throw e;
    }
    const ws = await _validateMember(userId, workspaceId);
    const user = await identity.users.findById(userId);
    const sprint = await (onPg() ? planning().sprints.insert.bind(planning().sprints) : Sprint.create.bind(Sprint))({
        workspace: workspaceId,
        company: user?.companyId || null,
        name, goal: goal || '',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        boardColumns: [
            { name: 'To Do',      order: 0, color: '#6b7280' },
            { name: 'In Progress', order: 1, color: '#3b82f6' },
            { name: 'Done',       order: 2, color: '#10b981' }
        ],
        createdBy: userId
    });
    return { sprint };
}

async function updateSprint(userId, sprintId, data) {
    if (onPg()) {
        const existing = await planning().sprints.findById(sprintId);
        if (!existing || existing.deleted) { const e = new Error('Sprint not found'); e.statusCode = 404; throw e; }
        await _validateMember(userId, existing.workspace);
        const patch = {};
        UPDATABLE.forEach(f => { if (data[f] !== undefined) patch[f] = data[f]; });
        return { sprint: await planning().sprints.update(sprintId, patch) };
    }
    const sprint = await Sprint.findById(sprintId);
    if (!sprint || sprint.deleted) { const e = new Error('Sprint not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, sprint.workspace);
    const allowed = UPDATABLE;
    allowed.forEach(f => { if (data[f] !== undefined) sprint[f] = data[f]; });
    await sprint.save();
    return { sprint };
}

async function deleteSprint(userId, sprintId) {
    if (onPg()) {
        const existing = await planning().sprints.findById(sprintId);
        if (!existing || existing.deleted) { const e = new Error('Sprint not found'); e.statusCode = 404; throw e; }
        await _validateMember(userId, existing.workspace);
        await planning().sprints.softDelete(sprintId);
        return { message: 'Sprint deleted' };
    }
    const sprint = await Sprint.findById(sprintId);
    if (!sprint || sprint.deleted) { const e = new Error('Sprint not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, sprint.workspace);
    sprint.deleted = true;
    await sprint.save();
    return { message: 'Sprint deleted' };
}

module.exports = { getSprints, createSprint, updateSprint, deleteSprint };
