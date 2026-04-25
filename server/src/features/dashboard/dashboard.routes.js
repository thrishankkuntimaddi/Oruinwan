const express = require("express");
const router = express.Router();
const dashboardController = require("./dashboard.controller");
const requireAuth = require("../../shared/middleware/auth");

router.get("/metrics/:companyId", requireAuth, dashboardController.getDashboardMetrics);

router.get("/admin", requireAuth, dashboardController.getAdminDashboard);

router.get("/workspace/:workspaceId", requireAuth, dashboardController.getWorkspaceDashboard);

router.get("/analytics/summary", requireAuth, dashboardController.getAnalyticsSummary);

router.get("/analytics/users", requireAuth, dashboardController.getUserActivityAnalytics);

router.get("/analytics/workspaces", requireAuth, dashboardController.getWorkspaceAnalytics);

router.get("/analytics/channels", requireAuth, dashboardController.getChannelEngagementAnalytics);

router.get("/analytics/tasks", requireAuth, dashboardController.getTaskAnalytics);

router.get("/analytics/messages", requireAuth, dashboardController.getMessageVolumeAnalytics);

router.get("/analytics/engagement", requireAuth, dashboardController.getEngagementTrends);

module.exports = router;
