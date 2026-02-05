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
    } catch (_error) {
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
    } catch (_error) {
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
        return res.status(201).json(result);
    } catch (_error) {
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
        return res.json(result);
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
        console.error('GET_TASK_ACTIVITY ERROR:', error);
        return handleError(res, error);
    }
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
    getTaskActivity
};
