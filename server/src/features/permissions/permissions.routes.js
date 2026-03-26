// server/src/features/permissions/permissions.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./permissions.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');
const { requireAdmin } = require('../../../middleware/permissionMiddleware');

// Role × Module permission matrix (company-level)
// GET  /api/permissions/matrix?companyId=
router.get('/matrix', requireAuth, requireCompanyMember, ctrl.getMatrix);

// PUT  /api/permissions/matrix (admin only)
router.put('/matrix', requireAuth, requireAdmin, ctrl.updateMatrix);

// Per-workspace feature toggles
// GET /api/permissions/workspace/:workspaceId/features
router.get('/workspace/:workspaceId/features', requireAuth, requireWorkspaceMember, ctrl.getFeatureToggles);

// PUT /api/permissions/workspace/:workspaceId/features (workspace admin only via middleware inside)
router.put('/workspace/:workspaceId/features', requireAuth, requireWorkspaceMember, ctrl.updateFeatureToggles);

// Audit logs — paginated reader (admin+)
// GET /api/permissions/audit-logs?companyId=&category=&severity=&page=&limit=
router.get('/audit-logs', requireAuth, requireAdmin, ctrl.getAuditLogs);

module.exports = router;
