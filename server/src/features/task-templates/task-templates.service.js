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

/** Subtask titles: trimmed, non-empty strings, at most 50. */
function cleanTitles(list) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list)) { const e = new Error('subtaskTitles must be an array of strings'); e.statusCode = 400; throw e; }
    return list.filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean).slice(0, 50);
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
    const { workspaceId, name, title, description, priority, tags, subtaskTitles, estimatedHours } = data;
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
        subtaskTitles: cleanTitles(subtaskTitles),
        estimatedHours: estimatedHours ?? null,
        createdBy: userId
    });
    return { template };
}

async function updateTemplate(userId, templateId, data) {
    const template = await TaskTemplate.findById(templateId);
    if (!template) { const e = new Error('Template not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, template.workspace);
    const allowed = ['name', 'title', 'description', 'priority', 'tags', 'subtaskTitles', 'estimatedHours', 'automationRules'];
    allowed.forEach(f => { if (data[f] !== undefined) template[f] = f === 'subtaskTitles' ? cleanTitles(data[f]) : data[f]; });
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

const idOf = (v) => String(v?._id || v);

/**
 * Create a task from a template, then one subtask per template subtask title
 * (the template's checklist). Body fields override the template:
 *   title, description, priority, tags, estimatedHours, dueDate, startDate,
 *   milestoneId, recurring, assignmentType, assignedToIds, channelId, taskMode, status
 * Subtasks are assigned to the parent task's assignees.
 */
async function applyTemplate(userId, templateId, body = {}, io, req) {
    const mongoose = require('mongoose');
    if (!mongoose.isValidObjectId(String(templateId))) { const e = new Error('Template not found'); e.statusCode = 404; throw e; }
    const template = await TaskTemplate.findById(templateId).lean();
    if (!template) { const e = new Error('Template not found'); e.statusCode = 404; throw e; }
    await _validateMember(userId, template.workspace);

    const tasksService = require('../tasks/tasks.service');
    const pick = (k, fallback) => (body[k] !== undefined ? body[k] : fallback);
    const taskData = {
        workspaceId: String(template.workspace),
        title: pick('title', template.title || template.name),
        description: pick('description', template.description || ''),
        priority: pick('priority', template.priority || 'medium'),
        tags: pick('tags', template.tags || []),
        ...(pick('estimatedHours', template.estimatedHours) != null ? { estimatedHours: pick('estimatedHours', template.estimatedHours) } : {}),
    };
    for (const k of ['dueDate', 'startDate', 'milestoneId', 'sprintId', 'recurring', 'assignmentType', 'assignedToIds', 'channelId', 'taskMode', 'status', 'labels']) {
        if (body[k] !== undefined) taskData[k] = body[k];
    }
    if (typeof taskData.title !== 'string' || !taskData.title.trim()) { const e = new Error('Template has no task title'); e.statusCode = 400; throw e; }

    const created = await tasksService.createTask(userId, taskData, io, req);
    const titles = cleanTitles(template.subtaskTitles);
    const subtasks = [];
    for (const task of created.tasks || []) {
        const assignees = (task.assignedTo || []).map(idOf);
        for (const title of titles) {
            const { subtask } = await tasksService.createSubtask(userId, idOf(task._id), { title, assignedTo: assignees }, io, req);
            subtasks.push(subtask);
        }
    }
    const tasks = await Promise.all((created.tasks || []).map(async (t) => (await tasksService.getTask(userId, idOf(t._id))).task));
    return { message: 'Task created from template', templateId: String(template._id), tasks, subtasks };
}

module.exports = { getTemplates, createTemplate, updateTemplate, deleteTemplate, applyTemplate, _cleanTitles: cleanTitles };
