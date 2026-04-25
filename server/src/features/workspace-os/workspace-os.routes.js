'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./workspace-os.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');

router.post('/:id/clone', requireAuth, requireWorkspaceMember, ctrl.cloneWorkspace);

router.get('/:id/export', requireAuth, requireWorkspaceMember, ctrl.exportWorkspace);

router.post('/import', requireAuth, ctrl.importWorkspace);

router.get('/:id/analytics', requireAuth, requireWorkspaceMember, ctrl.getWorkspaceAnalytics);

module.exports = router;
