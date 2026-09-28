const express = require("express");
const router = express.Router();
const metricsController = require("./metrics.controller");
const requireAuth = require("../../shared/middleware/auth");
const requireCompanyMember = require("../../shared/middleware/requireCompanyMember");
const requireOwnCompany = require("../../shared/middleware/requireOwnCompany");
const { requireCompanyRole } = require("../../shared/utils/companyRole");

// Company-wide metrics are for the company's own owner/admins only.
const guard = [requireAuth, requireCompanyMember, requireOwnCompany('id'), requireCompanyRole('admin')];

router.get("/:id/metrics", ...guard, metricsController.getCompanyMetrics);

router.get("/:id/analytics", ...guard, metricsController.getCompanyAnalytics);

module.exports = router;
