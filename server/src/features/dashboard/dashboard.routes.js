const express = require("express");
const router = express.Router();
const dashboardController = require("./dashboard.controller");
const requireAuth = require("../../shared/middleware/auth");
const requireCompanyAdmin = require("../../shared/middleware/requireCompanyAdmin");

router.get("/metrics/:companyId", requireAuth, dashboardController.getDashboardMetrics);

router.get("/admin", requireAuth, dashboardController.getAdminDashboard);

router.get("/workspace/:workspaceId", requireAuth, dashboardController.getWorkspaceDashboard);

// The signed-in member's own dashboard (":userId" may be "me"); company
// admins may also open one of their company's members.
router.get("/employee/:userId", requireAuth, dashboardController.getEmployeeDashboard);

// Company-wide analytics: owners, admins and co-owners of the caller's company.
router.get("/analytics/summary", requireAuth, requireCompanyAdmin, dashboardController.getAnalyticsSummary);

router.get("/analytics/users", requireAuth, requireCompanyAdmin, dashboardController.getUserActivityAnalytics);

router.get("/analytics/workspaces", requireAuth, requireCompanyAdmin, dashboardController.getWorkspaceAnalytics);

router.get("/analytics/channels", requireAuth, requireCompanyAdmin, dashboardController.getChannelEngagementAnalytics);

router.get("/analytics/tasks", requireAuth, requireCompanyAdmin, dashboardController.getTaskAnalytics);

router.get("/analytics/messages", requireAuth, requireCompanyAdmin, dashboardController.getMessageVolumeAnalytics);

router.get("/analytics/engagement", requireAuth, requireCompanyAdmin, dashboardController.getEngagementTrends);

module.exports = router;
