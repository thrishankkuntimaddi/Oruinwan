const express = require('express');
const router = express.Router({ mergeParams: true });
const ctrl = require('./workspace-permissions.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');

router.get('/permissions',    requireAuth, requireWorkspaceMember, ctrl.getPermissions);
router.put('/permissions',    requireAuth, requireWorkspaceMember, ctrl.updatePermissions);

router.get('/features',       requireAuth, requireWorkspaceMember, ctrl.getFeatureToggles);
router.put('/features',       requireAuth, requireWorkspaceMember, ctrl.updateFeatureToggles);

module.exports = router;
