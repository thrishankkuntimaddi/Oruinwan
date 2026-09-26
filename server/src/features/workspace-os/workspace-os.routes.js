'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./workspace-os.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');
const requireWorkspaceAdmin = require('../../shared/middleware/requireWorkspaceAdmin');

// Cloning and exporting copy every channel (private ones too) and membership: admins only.
router.post('/:id/clone', requireAuth, requireWorkspaceMember, requireWorkspaceAdmin, ctrl.cloneWorkspace);

router.get('/:id/export', requireAuth, requireWorkspaceMember, requireWorkspaceAdmin, ctrl.exportWorkspace);

router.post('/import', requireAuth, ctrl.importWorkspace);

router.get('/:id/analytics', requireAuth, requireWorkspaceMember, ctrl.getWorkspaceAnalytics);

module.exports = router;
