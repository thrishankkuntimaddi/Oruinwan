'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./permissions.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');
const { requireAdmin } = require('../../shared/middleware/permissionMiddleware');

router.get('/matrix', requireAuth, requireCompanyMember, ctrl.getMatrix);

router.put('/matrix', requireAuth, requireAdmin, ctrl.updateMatrix);

router.get('/workspace/:workspaceId/features', requireAuth, requireWorkspaceMember, ctrl.getFeatureToggles);

router.put('/workspace/:workspaceId/features', requireAuth, requireWorkspaceMember, ctrl.updateFeatureToggles);

router.get('/audit-logs', requireAuth, requireAdmin, ctrl.getAuditLogs);

module.exports = router;
