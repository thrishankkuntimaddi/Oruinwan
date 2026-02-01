// server/src/features/status/status.routes.js
/**
 * Status Routes - HTTP Routing Layer
 * 
 * Defines v2 API endpoint for system status
 * 
 * Base path: /api/v2/status
 * PUBLIC endpoint - no authentication required
 * 
 * @module features/status/status.routes
 */

const express = require('express');
const router = express.Router();
const statusController = require('./status.controller');

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/v2/status/health - Get system health status (PUBLIC)
router.get('/health', statusController.getSystemHealth);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;
