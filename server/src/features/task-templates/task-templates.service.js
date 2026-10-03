const TaskTemplate = require('../../../models/TaskTemplate');
const identity = require('../../identity');
const { hydrateTaskUsers } = require('../tasks/tasks.hydrate');

/** Active member of the workspace (PostgreSQL identity store). */
async function _validateMember(userId, workspaceId) {
    const access = workspaceId ? await identity.workspaces.membership(workspaceId, userId) : null;
    if (!access || !access.member) {
        const e = new Error('Access denied'); e.statusCode = 403; throw e;
    }
    return access.workspace;
}

async function getTemplates(userId, workspaceId) {
    if (!workspaceId) { const e = new Error('workspaceId required'); e.statusCode = 400; throw e; }
    await _validateMember(userId, workspaceId);
    const templates = await TaskTemplate.find({ workspace: workspaceId })
        .sort({ createdAt: -1 })
        .lean();
    await hydrateTaskUsers(templates, ['createdBy']);
    return { templates };
}

async function createTemplate(userId, data) {
    const { workspaceId, name, title, description, priority, tags, subtaskTitles } = data;
    if (!workspaceId || !name) {
        const e = new Error('workspaceId and name required'); e.statusCode = 400; throw e;
    }
    const user = await identity.users.findById(userId);
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
