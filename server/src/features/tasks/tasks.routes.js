// server/src/features/tasks/tasks.routes.js
/**
 * Tasks Routes - HTTP Routing Layer
 * 
 * STEP 4: Defines v2 API endpoints for tasks
 * 
 * Base path: /api/v2/tasks
 * All routes require authentication via requireAuth middleware
 * 
 * @module features/tasks/tasks.routes
 */

const express = require('express');
const router = express.Router();
const tasksController = require('./tasks.controller');
const requireAuth = require('../../../middleware/auth');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/v2/tasks - Get workspace tasks
router.get('/', tasksController.getTasks);

// GET /api/v2/tasks/my - Get user's assigned tasks
router.get('/my', tasksController.getMyTasks);

// POST /api/v2/tasks - Create new task
router.post('/', tasksController.createTask);

// GET /api/v2/tasks/:id/activity - Get task activity history
router.get('/:id/activity', tasksController.getTaskActivity);

// PUT /api/v2/tasks/:id - Update task
router.put('/:id', tasksController.updateTask);

// DELETE /api/v2/tasks/:id - Delete task (3-tier)
router.delete('/:id', tasksController.deleteTask);

// POST /api/v2/tasks/:id/restore - Restore soft-deleted task
router.post('/:id/restore', tasksController.restoreTask);

// DELETE /api/v2/tasks/:id/permanent - Permanently delete task
router.delete('/:id/permanent', tasksController.permanentDeleteTask);

// POST /api/v2/tasks/:id/revoke - Revoke task
router.post('/:id/revoke', tasksController.revokeTask);

// POST /api/v2/tasks/:id/transfer/request - Request transfer
router.post('/:id/transfer/request', tasksController.requestTransfer);

// POST /api/v2/tasks/:id/transfer-request - Request transfer (alternative path for frontend)
router.post('/:id/transfer-request', tasksController.requestTransfer);

// POST /api/v2/tasks/:id/transfer/:action - Handle transfer (approve/reject)
router.post('/:id/transfer/:action', tasksController.handleTransferRequest);

// POST /api/v2/tasks/:id/transfer-request/:action - Handle transfer (alternative path for frontend)
router.post('/:id/transfer-request/:action', tasksController.handleTransferRequest);

// POST /api/v2/tasks/:id/subtasks - Create subtask
router.post('/:id/subtasks', tasksController.createSubtask);

// POST /api/v2/tasks/:id/links - Add linked issue
router.post('/:id/links', tasksController.addLink);

// DELETE /api/v2/tasks/:id/links/:linkId - Remove linked issue
router.delete('/:id/links/:linkId', tasksController.removeLink);

// POST /api/v2/tasks/:id/watchers - Watch a task
router.post('/:id/watchers', tasksController.addWatcher);

// DELETE /api/v2/tasks/:id/watchers - Unwatch a task
router.delete('/:id/watchers', tasksController.removeWatcher);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;
