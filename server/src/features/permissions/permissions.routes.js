'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./permissions.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');
const requireCompanyAdmin = require('../../shared/middleware/requireCompanyAdmin');
const requireWorkspaceAdmin = require('../../shared/middleware/requireWorkspaceAdmin');

router.get('/matrix', requireAuth, requireCompanyMember, ctrl.getMatrix);

router.put('/matrix', requireAuth, requireCompanyAdmin, ctrl.updateMatrix);

router.get('/workspace/:workspaceId/features', requireAuth, requireWorkspaceMember, ctrl.getFeatureToggles);

router.put('/workspace/:workspaceId/features', requireAuth, requireWorkspaceMember, requireWorkspaceAdmin, ctrl.updateFeatureToggles);

router.get('/audit-logs', requireAuth, requireCompanyAdmin, ctrl.getAuditLogs);

module.exports = router;
