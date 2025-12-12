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
 * @desc    Delete a task
 * @access  Private (task creator or workspace admin)
 */
router.delete("/:id", requireAuth, taskController.deleteTask);

module.exports = router;
