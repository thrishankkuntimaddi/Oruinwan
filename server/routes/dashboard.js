// server/routes/dashboard.js

const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboardController");
const requireAuth = require("../middleware/auth");

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

module.exports = router;
