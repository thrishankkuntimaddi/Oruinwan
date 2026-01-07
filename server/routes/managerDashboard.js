// server/routes/managerDashboard.js
// Routes for manager dashboard and department management

const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const managerDashboardController = require('../controllers/managerDashboardController');

/**
 * @route   GET /api/manager/dashboard/metrics/:departmentId
 * @desc    Get department metrics for manager dashboard
 * @access  Private (manager or admin)
 */
router.get('/dashboard/metrics/:departmentId', requireAuth, managerDashboardController.getDepartmentMetrics);

/**
 * @route   GET /api/manager/team/:departmentId
 * @desc    Get team members for a department
 * @access  Private (manager or admin)
 */
router.get('/team/:departmentId', requireAuth, managerDashboardController.getTeamMembers);

/**
 * @route   GET /api/manager/tasks/:departmentId
 * @desc    Get department tasks
 * @access  Private (manager or admin)
 */
router.get('/tasks/:departmentId', requireAuth, managerDashboardController.getDepartmentTasks);

/**
 * @route   GET /api/manager/reports/:departmentId
 * @desc    Get department reports
 * @access  Private (manager or admin)
 */
router.get('/reports/:departmentId', requireAuth, managerDashboardController.getDepartmentReports);

/**
 * @route   GET /api/manager/my-departments
 * @desc    Get all departments managed by current user
 * @access  Private (authenticated users)
 */
router.get('/my-departments', requireAuth, managerDashboardController.getMyDepartments);

/**
 * @route   POST /api/manager/tasks/:departmentId
 * @desc    Create a new task in department workspace
 * @access  Private (manager or admin)
 */
router.post('/tasks/:departmentId', requireAuth, managerDashboardController.createDepartmentTask);

/**
 * @route   PATCH /api/manager/tasks/:taskId/status
 * @desc    Update task status
 * @access  Private (manager or admin)
 */
router.patch('/tasks/:taskId/status', requireAuth, managerDashboardController.updateTaskStatus);

/**
 * @route   DELETE /api/manager/tasks/:taskId
 * @desc    Delete a task
 * @access  Private (manager or admin)
 */
router.delete('/tasks/:taskId', requireAuth, managerDashboardController.deleteTask);

module.exports = router;
