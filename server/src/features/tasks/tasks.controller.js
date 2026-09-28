const logger = require('../../../utils/logger');
const tasksService = require('./tasks.service');
const validator = require('./tasks.validator');
const activityService = require('../activity/activity.service');

let webhookTrigger;
try { webhookTrigger = require('../integrations/webhook.trigger'); }
catch { webhookTrigger = null; }
const _fireWebhook = (workspaceId, event, data) => {
  if (webhookTrigger && workspaceId) webhookTrigger.fire(workspaceId, event, data);
};

function handleError(res, error) {
    let statusCode = error.statusCode || error.status || 500;
    let message = error.message || 'Internal server error';
    // Mongoose cast / validation problems are client errors, not 500s.
    if (statusCode === 500 && (error.name === 'CastError' || error.name === 'ValidationError')) {
        statusCode = 400;
    }
    if (statusCode >= 500) message = 'Internal server error';

    
    const response = { message };
    if (error.allowedTransitions) {
        response.allowedTransitions = error.allowedTransitions;
    }
    if (error.errors) {
        response.errors = error.errors;
    }

    return res.status(statusCode).json(response);
}

async function getTasks(req, res) {
    try {
        const userId = req.user.sub;
        const filters = {
            workspaceId: req.query.workspaceId,
            status: req.query.status,
            assignedTo: req.query.assignedTo,
            priority: req.query.priority,
            includeDeleted: req.query.includeDeleted,
            includeSubtasks: req.query.includeSubtasks
        };

        const result = await tasksService.getTasks(userId, filters);
        return res.json(result);
    } catch (error) {
        logger.error('GET_TASKS ERROR:', error);
        return handleError(res, error);
    }
}

async function getTask(req, res) {
    try {
        const result = await tasksService.getTask(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) {
        logger.error('GET_TASK ERROR:', error);
        return handleError(res, error);
    }
}

async function getMyTasks(req, res) {
    try {
        const userId = req.user.sub;
        const filters = {
            status: req.query.status,
            priority: req.query.priority
        };

        const result = await tasksService.getMyTasks(userId, filters);
        return res.json(result);
    } catch (error) {
        logger.error('GET_MY_TASKS ERROR:', error);
        return handleError(res, error);
    }
}

async function createTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskData = req.body || {};

        
        const validation = validator.validateCreateTask(taskData);
        if (!validation.valid) {
            const error = new Error((validation.errors || ['Validation failed']).join('; '));
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.createTask(userId, taskData, req.io, req);
        const createdId = result.tasks?.[0]?._id || result.task?._id || result._id;

        
        activityService.emit(req, {
            type: 'task',
            subtype: 'created',
            actor: userId,
            workspaceId: taskData.workspaceId || null,
            payload: {
                taskId: createdId,
                title: taskData.title,
                priority: taskData.priority || 'medium',
            },
        }).catch(() => {});

        
        _fireWebhook(taskData.workspaceId, 'task.created', {
            taskId: createdId,
            title: taskData.title,
            priority: taskData.priority || 'medium',
            createdBy: userId
        });

        return res.status(201).json(result);
    } catch (error) {
        logger.error('CREATE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

async function updateTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const updates = req.body || {};

        
        const validation = validator.validateUpdateTask(updates);
        if (!validation.valid) {
            const error = new Error((validation.errors || ['Validation failed']).join('; '));
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.updateTask(userId, taskId, updates, req.io, req);

        const workspaceId = result.task?.workspace ? String(result.task.workspace._id || result.task.workspace) : null;
        const completed = !!result.completed;
        activityService.emit(req, {
            type: 'task',
            subtype: completed ? 'completed' : 'updated',
            actor: userId,
            workspaceId,
            payload: { taskId, title: result.task?.title, status: result.task?.status },
        }).catch(() => {});

        _fireWebhook(workspaceId, completed ? 'task.completed' : 'task.updated', {
            taskId,
            title: result.task?.title,
            status: result.task?.status,
            updatedBy: userId
        });

        return res.json(result);
    } catch (error) {
        logger.error('UPDATE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

async function deleteTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const result = await tasksService.deleteTask(userId, taskId, req.io, req);
        return res.json(result);
    } catch (error) {
        logger.error('DELETE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

async function restoreTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const result = await tasksService.restoreTask(userId, taskId, req);
        return res.json(result);
    } catch (error) {
        logger.error('RESTORE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

async function permanentDeleteTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const result = await tasksService.permanentDeleteTask(userId, taskId, req);
        return res.json(result);
    } catch (error) {
        logger.error('PERMANENT_DELETE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

async function revokeTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const result = await tasksService.revokeTask(userId, taskId, req);
        return res.json(result);
    } catch (error) {
        logger.error('REVOKE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

async function requestTransfer(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const { newAssigneeId, note } = req.body || {};

        
        const validation = validator.validateTransferRequest({ newAssigneeId, note });
        if (!validation.valid) {
            const error = new Error((validation.errors || ['Validation failed']).join('; '));
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.requestTransfer(userId, taskId, newAssigneeId, note, req.io, req);
        return res.json(result);
    } catch (error) {
        logger.error('REQUEST_TRANSFER ERROR:', error);
        return handleError(res, error);
    }
}

async function handleTransferRequest(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const action = req.params.action;

        const result = await tasksService.handleTransferRequest(userId, taskId, action, req.io, req);
        return res.json(result);
    } catch (error) {
        logger.error('HANDLE_TRANSFER_REQUEST ERROR:', error);
        return handleError(res, error);
    }
}

async function createSubtask(req, res) {
    try {
        const userId = req.user.sub;
        const parentId = req.params.id;
        const subtaskData = req.body || {};

        
        const validation = validator.validateCreateSubtask(subtaskData);
        if (!validation.valid) {
            const error = new Error((validation.errors || ['Validation failed']).join('; '));
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.createSubtask(userId, parentId, subtaskData, req.io, req);
        return res.status(201).json(result);
    } catch (error) {
        logger.error('CREATE_SUBTASK ERROR:', error);
        return handleError(res, error);
    }
}

async function getTaskActivity(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const pagination = {
            limit: req.query.limit,
            offset: req.query.offset
        };

        
        const validation = validator.validatePagination(pagination);
        if (!validation.valid) {
            const error = new Error((validation.errors || ['Validation failed']).join('; '));
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.getTaskActivity(userId, taskId, pagination);
        return res.json(result);
    } catch (error) {
        logger.error('GET_TASK_ACTIVITY ERROR:', error);
        return handleError(res, error);
    }
}

async function addLink(req, res) {
    try {
        const userId = req.user.sub;
        const { linkedTaskId, linkType } = req.body || {};
        if (!linkedTaskId || !linkType) {
            return res.status(400).json({ message: 'linkedTaskId and linkType are required' });
        }
        const result = await tasksService.addLink(userId, req.params.id, { linkedTaskId, linkType });
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function removeLink(req, res) {
    try {
        const result = await tasksService.removeLink(req.user.sub, req.params.id, req.params.linkId);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function addWatcher(req, res) {
    try {
        const result = await tasksService.addWatcher(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function removeWatcher(req, res) {
    try {
        const result = await tasksService.removeWatcher(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function addDependency(req, res) {
    try {
        const { dependencyTaskId } = req.body || {};
        if (!dependencyTaskId) return res.status(400).json({ message: 'dependencyTaskId required' });
        const result = await tasksService.addDependency(req.user.sub, req.params.id, dependencyTaskId);
        return res.json(result);
    } catch (error) { return handleError(res, error); }
}

async function startTimer(req, res) {
    try {
        const result = await tasksService.startTimer(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) { return handleError(res, error); }
}

async function stopTimer(req, res) {
    try {
        const result = await tasksService.stopTimer(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) { return handleError(res, error); }
}

async function getWorkload(req, res) {
    try {
        const result = await tasksService.getWorkload(req.user.sub, req.query.workspaceId);
        return res.json(result);
    } catch (error) { return handleError(res, error); }
}

module.exports = {
    getTasks,
    getTask,
    getMyTasks,
    createTask,
    updateTask,
    deleteTask,
    restoreTask,
    permanentDeleteTask,
    revokeTask,
    requestTransfer,
    handleTransferRequest,
    createSubtask,
    getTaskActivity,
    addLink,
    removeLink,
    addWatcher,
    removeWatcher,
    addDependency,
    startTimer,
    stopTimer,
    getWorkload
};
