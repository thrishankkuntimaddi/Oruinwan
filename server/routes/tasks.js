// server/routes/tasks.js

const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const requireAuth = require("../middleware/auth");
const { requireWorkspaceAccess } = require("../middleware/permissions");

// All routes require authentication


/**
 * @route   GET /api/tasks
 * @desc    Get tasks for a workspace
 * @query   workspaceId, status, assignedTo, priority
 * @access  Private (workspace members)
 */
router.get("/", requireAuth, taskController.getTasks);

/**
 * @route   GET /api/tasks/my-tasks
 * @desc    Get user's assigned tasks
 * @query   status, priority
 * @access  Private
 */
router.get("/my-tasks", requireAuth, taskController.getMyTasks);

/**
 * @route   POST /api/tasks
 * @desc    Create a new task
 * @body    workspaceId, title, description, assignedTo, status, priority, dueDate, tags
 * @access  Private (workspace members)
 */
router.post("/", requireAuth, taskController.createTask);

/**
 * @route   PUT /api/tasks/:id
 * @desc    Update a task
 * @body    title, description, status, priority, dueDate, assignedTo, tags
 * @access  Private (workspace members)
 */
router.put("/:id", requireAuth, taskController.updateTask);

/**
 * @route   DELETE /api/tasks/:id
 * @desc    Delete a task (soft delete)
 * @access  Private (task creator or workspace admin)
 */
router.delete("/:id", requireAuth, taskController.deleteTask);

/**
 * @route   PUT /api/tasks/:id/restore
 * @desc    Restore a deleted task
 * @access  Private (task creator or workspace admin)
 */
router.put("/:id/restore", requireAuth, taskController.restoreTask);

/**
 * @route   DELETE /api/tasks/:id/permanent
 * @desc    Permanently delete a task
 * @access  Private (task creator or workspace admin)
 */
router.delete("/:id/permanent", requireAuth, taskController.permanentDeleteTask);

/**
 * @route   POST /api/tasks/:id/revoke
 * @desc    Revoke a task (brings it back to creator for editing/reassignment)
 * @access  Private (task creator only)
 */
router.post("/:id/revoke", requireAuth, taskController.revokeTask);

/**
 * @route   POST /api/tasks/:id/transfer-request
 * @desc    Request to transfer task to another user
 * @body    newAssigneeId, note
 * @access  Private (task assignee only)
 */
router.post("/:id/transfer-request", requireAuth, taskController.requestTransfer);

/**
 * @route   POST /api/tasks/:id/transfer-request/:action
 * @desc    Approve or reject transfer request
 * @params  action (approve | reject)
 * @access  Private (task creator only)
 */
router.post("/:id/transfer-request/:action", requireAuth, taskController.handleTransferRequest);

module.exports = router;
