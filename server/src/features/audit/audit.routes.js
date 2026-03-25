// server/src/features/audit/audit.routes.js
/**
 * Audit Routes - HTTP Routing Layer
 * 
 * Defines v2 API endpoints for audit logs
 * 
 * Base path: /api/v2/audit
 * All routes require authentication
 * 
 * @module features/audit/audit.routes
 */

const express = require('express');
const router = express.Router();
const auditController = require('./audit.controller');
const requireAuth = require('../../../middleware/auth');

// ============================================================================
// MIDDLEWARE
// ============================================================================

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// ROUTES
// ============================================================================

// GET /api/v2/audit/:companyId - Get audit logs for company
router.get('/:companyId', auditController.getCompanyAuditLogs);

// GET /api/v2/audit/:companyId/export - Export audit logs (CSV or JSON)
router.get('/:companyId/export', auditController.exportAuditLogs);

// GET /api/v2/audit/:companyId/compliance - Compliance-filtered audit log view
router.get('/:companyId/compliance', auditController.getComplianceLogs);

// ============================================================================
// EXPORT
// ============================================================================

module.exports = router;
