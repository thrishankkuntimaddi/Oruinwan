const express = require("express");
const router = express.Router();
const dashboardController = require("./dashboard.controller");
const requireAuth = require("../../shared/middleware/auth");
const requireCompanyAdmin = require("../../shared/middleware/requireCompanyAdmin");

router.get("/metrics/:companyId", requireAuth, dashboardController.getDashboardMetrics);

// (GET /admin and /workspace/:workspaceId were never implemented and had no callers; removed.
// Admin views use /api/admin-dashboard/* and the company analytics below.)

// The signed-in member's own dashboard (":userId" may be "me"); company
// admins may also open one of their company's members.
router.get("/employee/:userId", requireAuth, dashboardController.getEmployeeDashboard);

// Company-wide analytics: owners, admins and co-owners of the caller's company.
router.get("/analytics/summary", requireAuth, requireCompanyAdmin, dashboardController.getAnalyticsSummary);

router.get("/analytics/users", requireAuth, requireCompanyAdmin, dashboardController.getUserActivityAnalytics);

router.get("/analytics/workspaces", requireAuth, requireCompanyAdmin, dashboardController.getWorkspaceAnalytics);

router.get("/analytics/channels", requireAuth, requireCompanyAdmin, dashboardController.getChannelEngagementAnalytics);

router.get("/analytics/tasks", requireAuth, requireCompanyAdmin, dashboardController.getTaskAnalytics);

// No /analytics/messages: message volume is not shown to admins (messages are end-to-end
// encrypted and private to their participants).

router.get("/analytics/engagement", requireAuth, requireCompanyAdmin, dashboardController.getEngagementTrends);

// Team workload & delivery (tasks only): ?weeks=1..26 (default 8).
router.get("/analytics/teams", requireAuth, requireCompanyAdmin, dashboardController.getTeamDelivery);

// Active members per day and per week, counts only: ?period=1..365 (default 30).
router.get("/analytics/active-members", requireAuth, requireCompanyAdmin, dashboardController.getActiveMembers);

module.exports = router;
