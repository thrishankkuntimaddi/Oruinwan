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

// Importing creates a workspace: same company policy as POST /api/workspaces,
// and the new workspace belongs to the caller's company.
const identity = require('../../identity');
async function workspaceCreationPolicy(req, res, next) {
    try {
        const user = await identity.users.findById(req.user.sub);
        if (!user) return res.status(401).json({ message: 'User not found' });
        req.user._dbUser = user;
        if (user.companyId) {
            req.companyId = String(user.companyId);
            const coOwner = user.coOwnerOf && String(user.coOwnerOf) === String(user.companyId);
            const role = coOwner ? 'owner' : user.companyRole;
            const { companyPermission } = require('../../shared/companyPermissions');
            const matrix = await companyPermission(req.user.sub, 'createWorkspace');
            if (matrix === false || (matrix === null && !['owner', 'admin', 'manager'].includes(role))) {
                return res.status(403).json({ message: 'Only company admins/managers may create workspaces' });
            }
        }
        next();
    } catch (err) {
        next(err);
    }
}

router.post('/import', requireAuth, workspaceCreationPolicy, ctrl.importWorkspace);

router.get('/:id/analytics', requireAuth, requireWorkspaceMember, ctrl.getWorkspaceAnalytics);

module.exports = router;
