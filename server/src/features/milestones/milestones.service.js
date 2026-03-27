// server/src/features/milestones/milestones.service.js
const Milestone = require('../../../models/Milestone');
const Workspace = require('../../../models/Workspace');
const User = require('../../../models/User');

async function _validateMember(userId, workspaceId) {
    const ws = await Workspace.findById(workspaceId);
    if (!ws || !ws.isMember(userId)) {
        const e = new Error('Access denied'); e.statusCode = 403; throw e;
    }
    return ws;
}

async function getMilestones(userId, workspaceId) {
    if (!workspaceId) { const e = new Error('workspaceId required'); e.statusCode = 400; throw e; }
    await _validateMember(userId, workspaceId);
    const milestones = await Milestone.find({ workspace: workspaceId, deleted: false })
        .populate('createdBy', 'username profilePicture')
        .sort({ dueDate: 1 })
        .lean();
    return { milestones };
}

async function createMilestone(userId, data) {
    const { workspaceId, name, dueDate, startDate, endDate, description } = data;
    if (!workspaceId || !name) {
        const e = new Error('workspaceId and name required'); e.statusCode = 400; throw e;
    }
    const user = await User.findById(userId).lean();
    await _validateMember(userId, workspaceId);
    const milestone = await Milestone.create({
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
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone || milestone.deleted) { const e = new Error('Milestone not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, milestone.workspace);
    const allowed = ['name', 'description', 'dueDate', 'startDate', 'endDate', 'status'];
    allowed.forEach(f => { if (data[f] !== undefined) milestone[f] = data[f]; });
    await milestone.save();
    return { milestone };
}

async function deleteMilestone(userId, milestoneId) {
    const milestone = await Milestone.findById(milestoneId);
    if (!milestone || milestone.deleted) { const e = new Error('Milestone not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, milestone.workspace);
    milestone.deleted = true;
    await milestone.save();
    return { message: 'Milestone deleted' };
}

module.exports = { getMilestones, createMilestone, updateMilestone, deleteMilestone };
