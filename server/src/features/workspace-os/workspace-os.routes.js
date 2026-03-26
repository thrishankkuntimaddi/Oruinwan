// server/src/features/workspace-os/workspace-os.routes.js
'use strict';

const express = require('express');
const router = express.Router();
const ctrl = require('./workspace-os.controller');
const requireAuth = require('../../shared/middleware/auth');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');

// Clone a workspace — caller must be a workspace member
// POST /api/workspace-os/:id/clone
router.post('/:id/clone', requireAuth, requireWorkspaceMember, ctrl.cloneWorkspace);

// Export a workspace as a JSON bundle — any member
// GET /api/workspace-os/:id/export
router.get('/:id/export', requireAuth, requireWorkspaceMember, ctrl.exportWorkspace);

// Import a workspace from a JSON bundle — auth only (no workspace to be a member of yet)
// POST /api/workspace-os/import
router.post('/import', requireAuth, ctrl.importWorkspace);

// Get workspace analytics — any member
// GET /api/workspace-os/:id/analytics
router.get('/:id/analytics', requireAuth, requireWorkspaceMember, ctrl.getWorkspaceAnalytics);

module.exports = router;
