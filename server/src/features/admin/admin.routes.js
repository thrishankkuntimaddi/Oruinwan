// server/src/features/admin/admin.routes.js
/**
 * Admin Routes - HTTP Routing Layer
 * 
 * Defines v2 API endpoints for admin analytics
 * 
 * Base path: /api/v2/admin
 * All routes require authentication + admin role
 * 
 * @module features/admin/admin.routes
 */

const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const requireAuth = require('../../../middleware/auth');
const { requireAdmin } = require('../../../middleware/permissionMiddleware');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// All routes require authentication AND admin role
router.use(requireAuth);
router.use(requireAdmin);

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/v2/admin/analytics/stats - Get company analytics stats
router.get('/analytics/stats', adminController.getAnalyticsStats);

// GET /api/v2/admin/departments - Get departments list
router.get('/departments', adminController.getDepartments);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;
