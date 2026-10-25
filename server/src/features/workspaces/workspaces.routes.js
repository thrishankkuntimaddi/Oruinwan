const express = require('express');
const { requireCompanyPermission } = require('../../shared/companyPermissions');
const router = express.Router();
const workspaceController = require('./workspace.controller');
const workspaceAdminController = require('./workspace-admin.controller');
const lifecycle = require('./workspace-lifecycle.controller');
const planGuards = require('../../shared/plans/planGuards');

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
        const message = `This action requires at least 'admin' workspace access. Your workspace role is '${role}'.`;
        return res.status(403).json({
            success: false,
            message,
            error: message,
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
            const message = `This action requires at least 'admin' access. Your effective role is '${effectiveRole}'.`;
            return res.status(403).json({
                success: false,
                message,
                error: message,
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

router.post('/', requireAuth, planGuards.workspaceCreate, workspaceController.createWorkspace);
router.post('/create', requireAuth, planGuards.workspaceCreate, workspaceController.createWorkspace); 

router.get('/my', requireAuth, workspaceController.listMyWorkspaces);

router.get('/invite/:token', workspaceController.getInviteDetails);

router.post('/join', requireAuth, planGuards.workspaceJoin, workspaceController.joinWorkspace);

router.get('/:workspaceId/members', ...memberGatePersonal, workspaceController.getWorkspaceMembers);

router.get('/:workspaceId/all-members', ...memberGatePersonal, workspaceController.getAllWorkspaceMembers);

router.get('/:workspaceId/channels', ...memberGatePersonal, workspaceController.getWorkspaceChannels);

// Any active member may create channels (public or private); the controller
// honours workspace.settings.allowMemberChannelCreation for non-admins.
router.post('/:workspaceId/channels', ...memberGatePersonal, requireCompanyPermission('createChannel'), planGuards.channelCreate, workspaceController.createWorkspaceChannel);

router.get('/:workspaceId/stats', ...memberGatePersonal, workspaceController.getWorkspaceStats);

// Admins always; members too while settings.membersMayInvite is on (their invites are 'member').
router.post('/:workspaceId/invite', ...memberGatePersonal, lifecycle.requireInviteRight, requireCompanyPermission('inviteUsers'), planGuards.workspaceInvite, workspaceController.inviteToWorkspace);

router.post('/:id/invite', ...memberGatePersonal, lifecycle.requireInviteRight, requireCompanyPermission('inviteUsers'), planGuards.workspaceInvite, workspaceController.inviteToWorkspace);

// New members join default channels automatically and can't leave them.
router.put('/:workspaceId/channels/:channelId/default', ...adminGatePersonal, lifecycle.setDefaultChannel);

// Workspace profile images (logo, cover); the text fields go through PUT /:id { profile }.
router.use(require('./workspaceProfile').profileImageRouter(adminGatePersonal));

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

// Any active non-owner member may leave; the owner must transfer ownership first.
router.post('/:id/leave', ...memberGatePersonal, workspaceController.leaveWorkspace);

router.put('/:id/rename', ...adminGatePersonal, workspaceController.renameWorkspace);

router.put('/:id', ...adminGatePersonal, workspaceController.updateWorkspace);

const requireWorkspaceOwner = (req, res, next) => {
    const role = req.workspaceRole;
    if (role !== 'owner') {
        const message = `Only the workspace owner can perform this action. Your workspace role is '${role}'.`;
        return res.status(403).json({
            success: false,
            message,
            error: message,
            code: 'INSUFFICIENT_WORKSPACE_ROLE',
        });
    }
    req.effectiveRole = role;
    next();
};
router.delete('/:id', ...memberGatePersonal, requireWorkspaceOwner, workspaceController.deleteWorkspace);
router.post('/:id/transfer-ownership', ...memberGatePersonal, requireWorkspaceOwner, lifecycle.transferOwnership);
router.post('/:id/archive', ...memberGatePersonal, requireWorkspaceOwner, lifecycle.archiveWorkspace);
// An archived workspace fails requireWorkspaceMember, so restoring checks ownership itself.
router.post('/:id/unarchive', requireAuth, lifecycle.unarchiveWorkspace);

const workspacePermissionsRouter = require('../workspace-permissions/workspace-permissions.routes');
router.use('/:id', workspacePermissionsRouter);

router.post('/:id/clone', ...adminGatePersonal, planGuards.workspaceCreate, workspaceController.cloneWorkspace);

router.get('/:id/export', ...adminGatePersonal, workspaceController.exportWorkspace); // includes private channels: admins only

router.post('/import', requireAuth, planGuards.workspaceCreate, workspaceController.importWorkspace);

router.get('/:workspaceId/analytics', ...memberGatePersonal, workspaceController.getWorkspaceAnalytics);

router.get('/:companyId', requireAuth, requireCompanyMember, workspaceController.listWorkspaces);

module.exports = router;
