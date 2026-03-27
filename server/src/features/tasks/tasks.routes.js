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
// NOTE: requireCompanyMember intentionally NOT applied at router level.
// Tasks are scoped to BOTH personal and company workspaces.
// Personal accounts have no companyId — requireCompanyMember would block them.
// Tenant isolation is enforced inside tasksController by filtering on req.user.sub.

// ============================================================================
// MIDDLEWARE
// ============================================================================

// All routes require authentication only at the router level
router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/v2/tasks/workload - Get tasks per user (MUST come before /:id routes)
router.get('/workload', tasksController.getWorkload);

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

// POST /api/v2/tasks/:id/dependency - Add a dependency
router.post('/:id/dependency', tasksController.addDependency);

// POST /api/v2/tasks/:id/time/start - Start time tracking session
router.post('/:id/time/start', tasksController.startTimer);

// POST /api/v2/tasks/:id/time/stop - Stop time tracking session
router.post('/:id/time/stop', tasksController.stopTimer);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;
