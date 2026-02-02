// server/routes/dashboard.js

const express = require("express");
const router = express.Router();
const dashboardController = require("./dashboard.controller");
const requireAuth = require("../../shared/middleware/auth");

/**
 * @route   GET /api/dashboard/metrics/:companyId
 * @desc    Get real-time dashboard metrics for company
 * @access  Private (admin only)
 */
router.get("/metrics/:companyId", requireAuth, dashboardController.getDashboardMetrics);

/**
 * @route   GET /api/dashboard/admin
 * @desc    Get admin dashboard data (company overview, statistics)
 * @access  Private (admin/owner only)
 */
router.get("/admin", requireAuth, dashboardController.getAdminDashboard);

/**
 * @route   GET /api/dashboard/workspace/:workspaceId
 * @desc    Get workspace dashboard data
 * @access  Private (workspace members)
 */
router.get("/workspace/:workspaceId", requireAuth, dashboardController.getWorkspaceDashboard);

/**
 * @route   GET /api/dashboard/analytics/summary
 * @desc    Get analytics summary (overview metrics)
 * @access  Private (admin/owner only)
 */
router.get("/analytics/summary", requireAuth, dashboardController.getAnalyticsSummary);

/**
 * @route   GET /api/dashboard/analytics/users
 * @desc    Get user activity analytics
 * @access  Private (admin/owner only)
 */
router.get("/analytics/users", requireAuth, dashboardController.getUserActivityAnalytics);

/**
 * @route   GET /api/dashboard/analytics/workspaces
 * @desc    Get workspace analytics
 * @access  Private (admin/owner only)
 */
router.get("/analytics/workspaces", requireAuth, dashboardController.getWorkspaceAnalytics);

/**
 * @route   GET /api/dashboard/analytics/channels
 * @desc    Get channel engagement analytics
 * @access  Private (admin/owner only)
 */
router.get("/analytics/channels", requireAuth, dashboardController.getChannelEngagementAnalytics);

/**
 * @route   GET /api/dashboard/analytics/tasks
 * @desc    Get task analytics
 * @access  Private (admin/owner only)
 */
router.get("/analytics/tasks", requireAuth, dashboardController.getTaskAnalytics);

/**
 * @route   GET /api/dashboard/analytics/messages
 * @desc    Get message volume analytics
 * @access  Private (admin/owner only)
 */
router.get("/analytics/messages", requireAuth, dashboardController.getMessageVolumeAnalytics);

/**
 * @route   GET /api/dashboard/analytics/engagement
 * @desc    Get engagement trends (DAU/WAU/MAU)
 * @access  Private (admin/owner only)
 */
router.get("/analytics/engagement", requireAuth, dashboardController.getEngagementTrends);

module.exports = router;
