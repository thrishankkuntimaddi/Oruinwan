const express = require("express");
const router = express.Router();
const metricsController = require("./metrics.controller");
const requireAuth = require("../../shared/middleware/auth");

router.get("/:id/metrics", requireAuth, metricsController.getCompanyMetrics);

router.get("/:id/analytics", requireAuth, metricsController.getCompanyAnalytics);

module.exports = router;
