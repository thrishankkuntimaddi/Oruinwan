const TaskTemplate = require('../../../models/TaskTemplate');
const Workspace = require('../../../models/Workspace');
const User = require('../../../models/User');

async function _validateMember(userId, workspaceId) {
    const ws = await Workspace.findById(workspaceId);
    if (!ws || !ws.isMember(userId)) {
        const e = new Error('Access denied'); e.statusCode = 403; throw e;
    }
    return ws;
}

async function getTemplates(userId, workspaceId) {
    if (!workspaceId) { const e = new Error('workspaceId required'); e.statusCode = 400; throw e; }
    await _validateMember(userId, workspaceId);
    const templates = await TaskTemplate.find({ workspace: workspaceId })
        .populate('createdBy', 'username profilePicture')
        .sort({ createdAt: -1 })
        .lean();
    return { templates };
}

async function createTemplate(userId, data) {
    const { workspaceId, name, title, description, priority, tags, subtaskTitles } = data;
    if (!workspaceId || !name) {
        const e = new Error('workspaceId and name required'); e.statusCode = 400; throw e;
    }
    const user = await User.findById(userId).lean();
    await _validateMember(userId, workspaceId);
    const template = await TaskTemplate.create({
        workspace: workspaceId,
        company: user?.companyId || null,
        name, title: title || '',
        description: description || '',
        priority: priority || 'medium',
        tags: tags || [],
        subtaskTitles: subtaskTitles || [],
        createdBy: userId
    });
    return { template };
}

async function updateTemplate(userId, templateId, data) {
    const template = await TaskTemplate.findById(templateId);
    if (!template) { const e = new Error('Template not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, template.workspace);
    const allowed = ['name', 'title', 'description', 'priority', 'tags', 'subtaskTitles', 'automationRules'];
    allowed.forEach(f => { if (data[f] !== undefined) template[f] = data[f]; });
    await template.save();
    return { template };
}

async function deleteTemplate(userId, templateId) {
    const template = await TaskTemplate.findById(templateId);
    if (!template) { const e = new Error('Template not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, template.workspace);
    await template.deleteOne();
    return { message: 'Template deleted' };
}

module.exports = { getTemplates, createTemplate, updateTemplate, deleteTemplate };
