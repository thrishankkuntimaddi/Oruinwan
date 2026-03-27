// server/src/features/sprints/sprints.service.js
const Sprint = require('../../../models/Sprint');
const Workspace = require('../../../models/Workspace');
const User = require('../../../models/User');

async function _validateMember(userId, workspaceId) {
    const ws = await Workspace.findById(workspaceId);
    if (!ws || !ws.isMember(userId)) {
        const e = new Error('Access denied'); e.statusCode = 403; throw e;
    }
    return ws;
}

async function getSprints(userId, workspaceId) {
    if (!workspaceId) { const e = new Error('workspaceId required'); e.statusCode = 400; throw e; }
    await _validateMember(userId, workspaceId);
    const sprints = await Sprint.find({ workspace: workspaceId, deleted: false })
        .populate('createdBy', 'username profilePicture')
        .sort({ startDate: 1 })
        .lean();
    return { sprints };
}

async function createSprint(userId, data) {
    const { workspaceId, name, startDate, endDate, goal } = data;
    if (!workspaceId || !name || !startDate || !endDate) {
        const e = new Error('workspaceId, name, startDate, endDate required'); e.statusCode = 400; throw e;
    }
    const ws = await _validateMember(userId, workspaceId);
    const user = await User.findById(userId).lean();
    const sprint = await Sprint.create({
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
    const sprint = await Sprint.findById(sprintId);
    if (!sprint || sprint.deleted) { const e = new Error('Sprint not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, sprint.workspace);
    const allowed = ['name', 'goal', 'startDate', 'endDate', 'status', 'boardColumns'];
    allowed.forEach(f => { if (data[f] !== undefined) sprint[f] = data[f]; });
    await sprint.save();
    return { sprint };
}

async function deleteSprint(userId, sprintId) {
    const sprint = await Sprint.findById(sprintId);
    if (!sprint || sprint.deleted) { const e = new Error('Sprint not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, sprint.workspace);
    sprint.deleted = true;
    await sprint.save();
    return { message: 'Sprint deleted' };
}

module.exports = { getSprints, createSprint, updateSprint, deleteSprint };
