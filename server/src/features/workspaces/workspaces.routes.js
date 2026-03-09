// server/src/features/workspaces/workspaces.routes.js
//
// S-01 SECURITY HARDENING: All workspace-mutating routes now include the full
// middleware chain:
//   requireAuth           → validates JWT token
//   requireCompanyMember  → validates company membership, attaches req.companyId + req.companyRole
//   requireWorkspaceMember→ validates workspace membership + company isolation (cross-tenant guard)
//   enforceRoleCeiling    → enforces EffectiveRole = MIN(companyRole, workspaceRole)
//                           with optional { minRole } to gate admin/owner-only operations
//
// Previously all routes had only `auth` (bare JWT check), leaving admin-only
// operations (suspend, change-role, remove, delete) accessible to any authenticated user.

const express = require('express');
const router = express.Router();
const workspaceController = require('./workspace.controller');
const workspaceAdminController = require('./workspace-admin.controller');

// S-01: Use the Phase 1 shared middleware stack
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyMember = require('../../shared/middleware/requireCompanyMember');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');
const enforceRoleCeiling = require('../../shared/middleware/enforceRoleCeiling');

// ── Middleware gate aliases ────────────────────────────────────────────────────

// Any authenticated company member who is also a workspace member
const memberGate = [requireAuth, requireCompanyMember, requireWorkspaceMember];

// For READ routes that serve both personal and company accounts:
// requireCompanyMember is intentionally omitted — personal accounts have no companyId.
// requireWorkspaceMember still validates the caller is in the workspace (tenant safe).
const memberGatePersonal = [requireAuth, requireWorkspaceMember];

// Workspace admin or higher (company ceiling applied)
const adminGate = [...memberGate, enforceRoleCeiling({ minRole: 'admin' })];

// Admin gate that works for BOTH personal and company accounts.
// Personal accounts have no companyId so requireCompanyMember would wrongly 403 them.
// Instead we run memberGatePersonal (auth + workspace membership) then enforce
// workspace-level admin/owner directly — no company ceiling calculation needed.
const requireWorkspaceAdmin = (req, res, next) => {
    const role = req.workspaceRole; // set by requireWorkspaceMember
    if (role !== 'admin' && role !== 'owner') {
        return res.status(403).json({
            success: false,
            error: `This action requires at least 'admin' workspace access. Your workspace role is '${role}'.`,
            code: 'INSUFFICIENT_WORKSPACE_ROLE',
            workspaceRole: role,
            requiredRole: 'admin',
        });
    }
    // For company accounts that DID go through requireCompanyMember, also apply the ceiling.
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
        // Personal account — workspace role IS the effective role
        req.effectiveRole = role;
    }
    next();
};
const adminGatePersonal = [...memberGatePersonal, requireWorkspaceAdmin];

// ── PUBLIC / lightly guarded routes ───────────────────────────────────────────

// Create workspace — requireAuth only.
// Personal accounts have no companyId, so requireCompanyMember would wrongly reject them.
// Controller validates context internally.
router.post('/', requireAuth, workspaceController.createWorkspace);
router.post('/create', requireAuth, workspaceController.createWorkspace); // Alias

// List MY workspaces — requireAuth only.
// Serves BOTH personal and company accounts (personal has no companyId — requireCompanyMember would 403).
router.get('/my', requireAuth, workspaceController.listMyWorkspaces);

// Get invite details (public — token is the credential)
router.get('/invite/:token', workspaceController.getInviteDetails);

// Join workspace via invite — requireAuth only (joinee may be new, not yet a full company member)
router.post('/join', requireAuth, workspaceController.joinWorkspace);

// ── WORKSPACE-MEMBER ROUTES (S-01: requireWorkspaceMember + cross-tenant guard) ──

// Get workspace members — personal + company accounts both need this
// memberGatePersonal: requireAuth + requireWorkspaceMember (no requireCompanyMember)
router.get('/:workspaceId/members', ...memberGatePersonal, workspaceController.getWorkspaceMembers);

// Get ALL workspace members (for settings modal)
router.get('/:workspaceId/all-members', ...memberGatePersonal, workspaceController.getAllWorkspaceMembers);

// Get workspace channels
router.get('/:workspaceId/channels', ...memberGatePersonal, workspaceController.getWorkspaceChannels);

// Create channel in workspace — S-01: admin ceiling added
router.post('/:workspaceId/channels', ...adminGatePersonal, workspaceController.createWorkspaceChannel);

// Workspace statistics — member access (personal + company)
router.get('/:workspaceId/stats', ...memberGatePersonal, workspaceController.getWorkspaceStats);

// ── ADMIN-ONLY ROUTES (S-01: enforceRoleCeiling({ minRole: 'admin' })) ────────

// Invite management
// Use adminGatePersonal so personal accounts (no companyId) are not wrongly rejected.
// adminGatePersonal = requireAuth + requireWorkspaceMember + requireWorkspaceAdmin
// (requireWorkspaceAdmin enforces admin/owner workspace role AND applies company ceiling
//  for company accounts automatically)
router.post('/:workspaceId/invite', ...adminGatePersonal, workspaceController.inviteToWorkspace);
// Legacy alias with :id param (kept for backward compat)
router.post('/:id/invite', ...adminGatePersonal, workspaceController.inviteToWorkspace);

router.get('/:workspaceId/invites', ...adminGatePersonal, workspaceAdminController.getWorkspaceInvites);
router.post('/:workspaceId/invites/:inviteId/revoke', ...adminGatePersonal, workspaceAdminController.revokeInvite);
router.post('/:workspaceId/invites/:inviteId/resend', ...adminGatePersonal, workspaceAdminController.resendInvite);
router.post('/:workspaceId/invites/bulk-revoke', ...adminGatePersonal, workspaceAdminController.bulkRevokeInvites);
router.delete('/:workspaceId/invites/bulk-delete', ...adminGatePersonal, workspaceAdminController.bulkDeleteInvites);
router.post('/:workspaceId/invites/cleanup-expired', ...adminGatePersonal, workspaceAdminController.cleanupExpiredInvites);

// Member management — personal + company accounts both need these
router.post('/:workspaceId/members/:userId/suspend', ...adminGatePersonal, workspaceAdminController.suspendMember);
router.post('/:workspaceId/members/:userId/restore', ...adminGatePersonal, workspaceAdminController.restoreMember);
router.post('/:workspaceId/members/:userId/change-role', ...adminGatePersonal, workspaceAdminController.changeRole);
router.post('/:workspaceId/remove-member', ...adminGatePersonal, workspaceAdminController.removeMember);

// Rename workspace — works for personal + company
router.put('/:id/rename', ...adminGatePersonal, workspaceController.renameWorkspace);

// Update workspace settings — works for personal + company
router.put('/:id', ...adminGatePersonal, workspaceController.updateWorkspace);

// Delete workspace (OWNER ONLY) — works for personal + company
// IMPORTANT: Must come BEFORE GET /:companyId to avoid route conflicts
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

// ── COMPANY-SCOPED LIST ───────────────────────────────────────────────────────

// Get workspaces by company — must be after all specific routes to avoid collisions
router.get('/:companyId', requireAuth, requireCompanyMember, workspaceController.listWorkspaces);

module.exports = router;
