// src/features/company/metrics.routes.js

const express = require("express");
const router = express.Router();
const metricsController = require("./metrics.controller");
const requireAuth = require("../../shared/middleware/auth");

/**
 * @route   GET /api/companies/:id/metrics
 * @desc    Get company metrics
 * @access  Private (company members)
 */
router.get("/:id/metrics", requireAuth, metricsController.getCompanyMetrics);

/**
 * @route   GET /api/companies/:id/analytics
 * @desc    Get company analytics data
 * @access  Private (company admin)
 */
router.get("/:id/analytics", requireAuth, metricsController.getCompanyAnalytics);

module.exports = router;
