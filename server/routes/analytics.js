// server/routes/analytics.js
const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const requireAuth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/permissionMiddleware');

/**
 * @route   GET /api/analytics/company/:companyId
 * @desc    Get comprehensive analytics for company
 * @query   timeRange (optional): '7d', '30d', '90d'
 * @access  Private (Company Admin)
 */
router.get('/company/:companyId', requireAuth, requireAdmin, analyticsController.getCompanyAnalytics);

module.exports = router;
