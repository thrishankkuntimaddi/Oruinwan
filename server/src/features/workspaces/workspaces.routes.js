const express = require('express');
const router = express.Router();
const workspaceController = require('./workspace.controller');
const workspaceAdminController = require('./workspace-admin.controller');

const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');
const enforceRoleCeiling = require('../../shared/middleware/enforceRoleCeiling');

const memberGate = [requireAuth, requireCompanyMember, requireWorkspaceMember];

const memberGatePersonal = [requireAuth, requireWorkspaceMember];

const adminGate = [...memberGate, enforceRoleCeiling({ minRole: 'admin' })];

const requireWorkspaceAdmin = (req, res, next) => {
    const role = req.workspaceRole; 
    if (role !== 'admin' && role !== 'owner') {
        return res.status(403).json({
            success: false,
            error: `This action requires at least 'admin' workspace access. Your workspace role is '${role}'.`,
            code: 'INSUFFICIENT_WORKSPACE_ROLE',
            workspaceRole: role,
            requiredRole: 'admin',
        });
    }
    
    if (req.companyRole) {
        const effectiveRole = enforceRoleCeiling.resolveEffectiveRole(req.companyRole, role);
        req.effectiveRole = effectiveRole;
        const ROLE_HIERARCHY = enforceRoleCeiling.ROLE_HIERARCHY;
        if (ROLE_HIERARCHY.indexOf(effectiveRole) < ROLE_HIERARCHY.indexOf('admin')) {
            return res.status(403).json({
                success: false,
                error: `This action requires at least 'admin' access. Your effective role is '${effectiveRole}'.`,
                code: 'INSUFFICIENT_ROLE',
                effectiveRole,
                requiredRole: 'admin',
            });
        }
    } else {
        
        req.effectiveRole = role;
    }
    next();
};
const adminGatePersonal = [...memberGatePersonal, requireWorkspaceAdmin];

router.post('/', requireAuth, workspaceController.createWorkspace);
router.post('/create', requireAuth, workspaceController.createWorkspace); 

router.get('/my', requireAuth, workspaceController.listMyWorkspaces);

router.get('/invite/:token', workspaceController.getInviteDetails);

router.post('/join', requireAuth, workspaceController.joinWorkspace);

router.get('/:workspaceId/members', ...memberGatePersonal, workspaceController.getWorkspaceMembers);

router.get('/:workspaceId/all-members', ...memberGatePersonal, workspaceController.getAllWorkspaceMembers);

router.get('/:workspaceId/channels', ...memberGatePersonal, workspaceController.getWorkspaceChannels);

router.post('/:workspaceId/channels', ...adminGatePersonal, workspaceController.createWorkspaceChannel);

router.get('/:workspaceId/stats', ...memberGatePersonal, workspaceController.getWorkspaceStats);

router.post('/:workspaceId/invite', ...adminGatePersonal, workspaceController.inviteToWorkspace);

router.post('/:id/invite', ...adminGatePersonal, workspaceController.inviteToWorkspace);

router.get('/:workspaceId/invites', ...adminGatePersonal, workspaceAdminController.getWorkspaceInvites);
router.post('/:workspaceId/invites/:inviteId/revoke', ...adminGatePersonal, workspaceAdminController.revokeInvite);
router.post('/:workspaceId/invites/:inviteId/resend', ...adminGatePersonal, workspaceAdminController.resendInvite);
router.post('/:workspaceId/invites/bulk-revoke', ...adminGatePersonal, workspaceAdminController.bulkRevokeInvites);
router.delete('/:workspaceId/invites/bulk-delete', ...adminGatePersonal, workspaceAdminController.bulkDeleteInvites);
router.post('/:workspaceId/invites/cleanup-expired', ...adminGatePersonal, workspaceAdminController.cleanupExpiredInvites);

router.post('/:workspaceId/members/:userId/suspend', ...adminGatePersonal, workspaceAdminController.suspendMember);
router.post('/:workspaceId/members/:userId/restore', ...adminGatePersonal, workspaceAdminController.restoreMember);
router.post('/:workspaceId/members/:userId/change-role', ...adminGatePersonal, workspaceAdminController.changeRole);
router.post('/:workspaceId/remove-member', ...adminGatePersonal, workspaceAdminController.removeMember);

router.put('/:id/rename', ...adminGatePersonal, workspaceController.renameWorkspace);

router.put('/:id', ...adminGatePersonal, workspaceController.updateWorkspace);

const requireWorkspaceOwner = (req, res, next) => {
    const role = req.workspaceRole;
    if (role !== 'owner') {
        return res.status(403).json({
            success: false,
            error: `Only the workspace owner can perform this action. Your workspace role is '${role}'.`,
            code: 'INSUFFICIENT_WORKSPACE_ROLE',
        });
    }
    req.effectiveRole = role;
    next();
};
router.delete('/:id', ...memberGatePersonal, requireWorkspaceOwner, workspaceController.deleteWorkspace);

const workspacePermissionsRouter = require('../workspace-permissions/workspace-permissions.routes');
router.use('/:id', workspacePermissionsRouter);

router.post('/:id/clone', ...adminGatePersonal, workspaceController.cloneWorkspace);

router.get('/:id/export', ...memberGatePersonal, workspaceController.exportWorkspace);

router.post('/import', requireAuth, workspaceController.importWorkspace);

router.get('/:workspaceId/analytics', ...memberGatePersonal, workspaceController.getWorkspaceAnalytics);

router.get('/:companyId', requireAuth, requireCompanyMember, workspaceController.listWorkspaces);

module.exports = router;
