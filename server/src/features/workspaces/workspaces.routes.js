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

// Workspace admin or higher (company ceiling applied)
const adminGate = [...memberGate, enforceRoleCeiling({ minRole: 'admin' })];

// ── PUBLIC / lightly guarded routes ───────────────────────────────────────────

// Create workspace — requireAuth + requireCompanyMember only (no workspace yet)
router.post('/', requireAuth, requireCompanyMember, workspaceController.createWorkspace);
router.post('/create', requireAuth, requireCompanyMember, workspaceController.createWorkspace); // Alias

// List MY workspaces — must be a company member
router.get('/my', requireAuth, requireCompanyMember, workspaceController.listMyWorkspaces);

// Get invite details (public — token is the credential)
router.get('/invite/:token', workspaceController.getInviteDetails);

// Join workspace via invite
router.post('/join', requireAuth, requireCompanyMember, workspaceController.joinWorkspace);

// ── WORKSPACE-MEMBER ROUTES (S-01: requireWorkspaceMember + cross-tenant guard) ──

// Get workspace members — S-01: was requireAuth only, now full memberGate
router.get('/:workspaceId/members', ...memberGate, workspaceController.getWorkspaceMembers);

// Get ALL workspace members (for settings modal) — S-01: was requireAuth only
router.get('/:workspaceId/all-members', ...memberGate, workspaceController.getAllWorkspaceMembers);

// Get workspace channels — S-01: was requireAuth only
router.get('/:workspaceId/channels', ...memberGate, workspaceController.getWorkspaceChannels);

// Create channel in workspace — S-01: admin ceiling added
router.post('/:workspaceId/channels', ...adminGate, workspaceController.createWorkspaceChannel);

// Workspace statistics — member access
router.get('/:workspaceId/stats', ...memberGate, workspaceController.getWorkspaceStats);

// ── ADMIN-ONLY ROUTES (S-01: enforceRoleCeiling({ minRole: 'admin' })) ────────

// Invite management
// S-01: was requireAuth only — now adminGate
router.post('/:workspaceId/invite', ...adminGate, workspaceController.inviteToWorkspace);
// Legacy alias with :id param (kept for backward compat)
router.post('/:id/invite', ...adminGate, workspaceController.inviteToWorkspace);

router.get('/:workspaceId/invites', ...adminGate, workspaceAdminController.getWorkspaceInvites);
router.post('/:workspaceId/invites/:inviteId/revoke', ...adminGate, workspaceAdminController.revokeInvite);
router.post('/:workspaceId/invites/:inviteId/resend', ...adminGate, workspaceAdminController.resendInvite);
router.post('/:workspaceId/invites/bulk-revoke', ...adminGate, workspaceAdminController.bulkRevokeInvites);
router.delete('/:workspaceId/invites/bulk-delete', ...adminGate, workspaceAdminController.bulkDeleteInvites);
router.post('/:workspaceId/invites/cleanup-expired', ...adminGate, workspaceAdminController.cleanupExpiredInvites);

// Member management — S-01: was requireAuth only for all of these
router.post('/:workspaceId/members/:userId/suspend', ...adminGate, workspaceAdminController.suspendMember);
router.post('/:workspaceId/members/:userId/restore', ...adminGate, workspaceAdminController.restoreMember);
router.post('/:workspaceId/members/:userId/change-role', ...adminGate, workspaceAdminController.changeRole);
router.post('/:workspaceId/remove-member', ...adminGate, workspaceAdminController.removeMember);

// ── ADMIN/OWNER-ONLY WORKSPACE MANAGEMENT ────────────────────────────────────

// Rename workspace — S-01: was requireAuth only
router.put('/:id/rename', requireAuth, requireCompanyMember, enforceRoleCeiling({ minRole: 'admin' }), workspaceController.renameWorkspace);

// Update workspace settings — S-01: was requireAuth only
router.put('/:id', requireAuth, requireCompanyMember, enforceRoleCeiling({ minRole: 'admin' }), workspaceController.updateWorkspace);

// Delete workspace (OWNER ONLY) — S-01: was requireAuth only
// IMPORTANT: Must come BEFORE GET /:companyId to avoid route conflicts
router.delete('/:id', requireAuth, requireCompanyMember, enforceRoleCeiling({ minRole: 'owner' }), workspaceController.deleteWorkspace);

// ── COMPANY-SCOPED LIST ───────────────────────────────────────────────────────

// Get workspaces by company — must be after all specific routes to avoid collisions
router.get('/:companyId', requireAuth, requireCompanyMember, workspaceController.listWorkspaces);

module.exports = router;
