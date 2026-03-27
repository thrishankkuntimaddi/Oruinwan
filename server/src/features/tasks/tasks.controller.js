// server/src/features/tasks/tasks.controller.js
/**
 * Tasks Controller - HTTP Request/Response Layer
 * 
 * STEP 4: Thin wrappers that extract req params and call service methods.
 * 
 * Rules:
 * - NO business logic (delegated to service)
 * - NO direct database calls
 * - Extract params, validate, call service, return response
 * - Handle errors and HTTP status codes
 * 
 * @module features/tasks/tasks.controller
 */

const tasksService = require('./tasks.service');
const validator = require('./tasks.validator');
const activityService = require('../activity/activity.service');

// Integration Ecosystem — fire-and-forget webhook trigger (never blocks responses)
let webhookTrigger;
try { webhookTrigger = require('../integrations/webhook.trigger'); }
catch { webhookTrigger = null; }
const _fireWebhook = (workspaceId, event, data) => {
  if (webhookTrigger && workspaceId) webhookTrigger.fire(workspaceId, event, data);
};


// ============================================================================
// HELPER: Error Response Handler
// ============================================================================

function handleError(res, error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    // Include additional error details if present
    const response = { message };
    if (error.allowedTransitions) {
        response.allowedTransitions = error.allowedTransitions;
    }
    if (error.errors) {
        response.errors = error.errors;
    }

    return res.status(statusCode).json(response);
}

// ============================================================================
// CONTROLLERS
// ============================================================================

/**
 * GET /api/v2/tasks
 * Get tasks for a workspace
 */
async function getTasks(req, res) {
    try {
        const userId = req.user.sub;
        const filters = {
            workspaceId: req.query.workspaceId,
            status: req.query.status,
            assignedTo: req.query.assignedTo,
            priority: req.query.priority,
            includeDeleted: req.query.includeDeleted
        };

        const result = await tasksService.getTasks(userId, filters);
        return res.json(result);
    } catch (error) {
        console.error('GET_TASKS ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * GET /api/v2/tasks/my
 * Get user's assigned tasks
 */
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
        console.error('GET_MY_TASKS ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * POST /api/v2/tasks
 * Create a new task
 */
async function createTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskData = req.body;

        // Validate input
        const validation = validator.validateCreateTask(taskData);
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.createTask(userId, taskData, req.io, req);

        // Emit activity event — fire-and-forget, never blocks response
        activityService.emit(req, {
            type: 'task',
            subtype: 'created',
            actor: userId,
            workspaceId: taskData.workspaceId || null,
            payload: {
                taskId: result.task?._id || result._id,
                title: taskData.title,
                priority: taskData.priority || 'medium',
            },
        }).catch(() => {});

        // Integration Ecosystem — fire webhook event
        _fireWebhook(taskData.workspaceId, 'task.created', {
            taskId: result.task?._id || result._id,
            title: taskData.title,
            priority: taskData.priority || 'medium',
            createdBy: userId
        });

        return res.status(201).json(result);
    } catch (error) {
        console.error('CREATE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * PUT /api/v2/tasks/:id
 * Update a task
 */
async function updateTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const updates = req.body;

        // Validate input
        const validation = validator.validateUpdateTask(updates);
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.updateTask(userId, taskId, updates, req.io, req);

        // Emit activity — subtype 'completed' when status flips to done
        const subtype = updates.status === 'completed' ? 'completed' : 'updated';
        activityService.emit(req, {
            type: 'task',
            subtype,
            actor: userId,
            workspaceId: updates.workspaceId || null,
            payload: { taskId, title: updates.title, status: updates.status },
        }).catch(() => {});

        // Integration Ecosystem — fire webhook event
        const webhookEvent = updates.status === 'completed' ? 'task.completed' : 'task.updated';
        _fireWebhook(updates.workspaceId, webhookEvent, {
            taskId,
            title: updates.title,
            status: updates.status,
            updatedBy: userId
        });

        return res.json(result);
    } catch (error) {
        console.error('UPDATE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * DELETE /api/v2/tasks/:id
 * Delete a task (3-tier system)
 */
async function deleteTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const result = await tasksService.deleteTask(userId, taskId, req.io, req);
        return res.json(result);
    } catch (error) {
        console.error('DELETE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * POST /api/v2/tasks/:id/restore
 * Restore a soft-deleted task
 */
async function restoreTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const result = await tasksService.restoreTask(userId, taskId, req);
        return res.json(result);
    } catch (error) {
        console.error('RESTORE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * DELETE /api/v2/tasks/:id/permanent
 * Permanently delete a task
 */
async function permanentDeleteTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const result = await tasksService.permanentDeleteTask(userId, taskId, req);
        return res.json(result);
    } catch (error) {
        console.error('PERMANENT_DELETE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * POST /api/v2/tasks/:id/revoke
 * Revoke a task (bring back to creator)
 */
async function revokeTask(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;

        const result = await tasksService.revokeTask(userId, taskId, req);
        return res.json(result);
    } catch (error) {
        console.error('REVOKE_TASK ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * POST /api/v2/tasks/:id/transfer/request
 * Request task transfer
 */
async function requestTransfer(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const { newAssigneeId, note } = req.body;

        // Validate input
        const validation = validator.validateTransferRequest({ newAssigneeId, note });
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.requestTransfer(userId, taskId, newAssigneeId, note, req.io, req);
        return res.json(result);
    } catch (error) {
        console.error('REQUEST_TRANSFER ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * POST /api/v2/tasks/:id/transfer/:action
 * Handle transfer request (approve/reject)
 */
async function handleTransferRequest(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const action = req.params.action;

        const result = await tasksService.handleTransferRequest(userId, taskId, action, req.io, req);
        return res.json(result);
    } catch (error) {
        console.error('HANDLE_TRANSFER_REQUEST ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * POST /api/v2/tasks/:id/subtasks
 * Create a subtask
 */
async function createSubtask(req, res) {
    try {
        const userId = req.user.sub;
        const parentId = req.params.id;
        const subtaskData = req.body;

        // Validate input
        const validation = validator.validateCreateSubtask(subtaskData);
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.createSubtask(userId, parentId, subtaskData, req.io, req);
        return res.status(201).json(result);
    } catch (error) {
        console.error('CREATE_SUBTASK ERROR:', error);
        return handleError(res, error);
    }
}

/**
 * GET /api/v2/tasks/:id/activity
 * Get task activity history
 */
async function getTaskActivity(req, res) {
    try {
        const userId = req.user.sub;
        const taskId = req.params.id;
        const pagination = {
            limit: req.query.limit,
            offset: req.query.offset
        };

        // Validate pagination
        const validation = validator.validatePagination(pagination);
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await tasksService.getTaskActivity(userId, taskId, pagination);
        return res.json(result);
    } catch (error) {
        console.error('GET_TASK_ACTIVITY ERROR:', error);
        return handleError(res, error);
    }
}

// ============================================================================
// LINK + WATCHER CONTROLLERS
// ============================================================================

/** POST /api/v2/tasks/:id/links */
async function addLink(req, res) {
    try {
        const userId = req.user.sub;
        const { linkedTaskId, linkType } = req.body;
        if (!linkedTaskId || !linkType) {
            return res.status(400).json({ message: 'linkedTaskId and linkType are required' });
        }
        const result = await tasksService.addLink(userId, req.params.id, { linkedTaskId, linkType });
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

/** DELETE /api/v2/tasks/:id/links/:linkId */
async function removeLink(req, res) {
    try {
        const result = await tasksService.removeLink(req.user.sub, req.params.id, req.params.linkId);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

/** POST /api/v2/tasks/:id/watchers */
async function addWatcher(req, res) {
    try {
        const result = await tasksService.addWatcher(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

/** DELETE /api/v2/tasks/:id/watchers */
async function removeWatcher(req, res) {
    try {
        const result = await tasksService.removeWatcher(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

// ============================================================================
// ADV: TIME TRACKING + DEPENDENCY + WORKLOAD CONTROLLERS
// ============================================================================

/** POST /api/v2/tasks/:id/dependency */
async function addDependency(req, res) {
    try {
        const { dependencyTaskId } = req.body;
        if (!dependencyTaskId) return res.status(400).json({ message: 'dependencyTaskId required' });
        const result = await tasksService.addDependency(req.user.sub, req.params.id, dependencyTaskId);
        return res.json(result);
    } catch (error) { return handleError(res, error); }
}

/** POST /api/v2/tasks/:id/time/start */
async function startTimer(req, res) {
    try {
        const result = await tasksService.startTimer(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) { return handleError(res, error); }
}

/** POST /api/v2/tasks/:id/time/stop */
async function stopTimer(req, res) {
    try {
        const result = await tasksService.stopTimer(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) { return handleError(res, error); }
}

/** GET /api/v2/tasks/workload */
async function getWorkload(req, res) {
    try {
        const result = await tasksService.getWorkload(req.user.sub, req.query.workspaceId);
        return res.json(result);
    } catch (error) { return handleError(res, error); }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getTasks,
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
