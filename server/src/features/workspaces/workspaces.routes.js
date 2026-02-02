// server/routes/workspaces.js
const express = require("express");
const router = express.Router();
const workspaceController = require("./workspace.controller");
const workspaceAdminController = require("./workspace-admin.controller");
const auth = require("../../shared/middleware/auth");

// Create workspace (personal or company)
router.post("/", auth, workspaceController.createWorkspace);
router.post("/create", auth, workspaceController.createWorkspace); // Alias for client compatibility

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes
// Get MY workspaces (only workspaces I'm a member of)
router.get("/my", auth, workspaceController.listMyWorkspaces);

// Get invite details (for preview before joining)
router.get("/invite/:token", workspaceController.getInviteDetails);

// Join workspace via invite
router.post("/join", auth, workspaceController.joinWorkspace);

// Get workspace members (for DM filtering)
router.get("/:workspaceId/members", auth, workspaceController.getWorkspaceMembers);

// Get ALL workspace members including current user (for settings modal)
router.get("/:workspaceId/all-members", auth, workspaceController.getAllWorkspaceMembers);

// Get workspace channels
router.get("/:workspaceId/channels", auth, workspaceController.getWorkspaceChannels);

// Create channel in workspace
router.post("/:workspaceId/channels", auth, workspaceController.createWorkspaceChannel);

// 🔒 ADMIN-ONLY: Invite management
// Invite to workspace (email or link)
router.post("/:id/invite", auth, workspaceController.inviteToWorkspace);

// Get all invites for workspace (admin-only)
router.get("/:workspaceId/invites", auth, workspaceAdminController.getWorkspaceInvites);

// Revoke invite (admin-only)
router.post("/:workspaceId/invites/:inviteId/revoke", auth, workspaceAdminController.revokeInvite);

// Resend invite (admin-only)
router.post("/:workspaceId/invites/:inviteId/resend", auth, workspaceAdminController.resendInvite);

// 🔒 ADMIN-ONLY: Bulk invitation operations
// Bulk revoke invites (admin-only)
router.post("/:workspaceId/invites/bulk-revoke", auth, workspaceAdminController.bulkRevokeInvites);

// Bulk delete invites (admin-only) - only expired/revoked
router.delete("/:workspaceId/invites/bulk-delete", auth, workspaceAdminController.bulkDeleteInvites);

// Cleanup all expired invites (admin-only)
router.post("/:workspaceId/invites/cleanup-expired", auth, workspaceAdminController.cleanupExpiredInvites);

// 🔒 ADMIN-ONLY: Member management
// Suspend member (admin-only)
router.post("/:workspaceId/members/:userId/suspend", auth, workspaceAdminController.suspendMember);

// Restore suspended member (admin-only)
router.post("/:workspaceId/members/:userId/restore", auth, workspaceAdminController.restoreMember);

// Change member role (admin-only)
router.post("/:workspaceId/members/:userId/change-role", auth, workspaceAdminController.changeRole);

// Remove member from workspace (admin-only)
router.post("/:workspaceId/remove-member", auth, workspaceAdminController.removeMember);

// 🔒 OWNER-ONLY: Delete workspace
// IMPORTANT: This MUST come BEFORE GET /:companyId to avoid route conflicts
router.delete("/:id", auth, workspaceController.deleteWorkspace);

// 🔒 ADMIN/OWNER-ONLY: Rename workspace
router.put("/:id/rename", auth, workspaceController.renameWorkspace);

// 🔒 ADMIN/OWNER-ONLY: Update workspace settings
router.put("/:id", auth, workspaceController.updateWorkspace);

// Get workspace statistics
router.get("/:id/stats", auth, workspaceController.getWorkspaceStats);

// Get workspaces by company (legacy/company-specific)
// This MUST be after /my, specific routes, and DELETE to avoid matching workspace IDs as companyId
router.get("/:companyId", auth, workspaceController.listWorkspaces);

module.exports = router;

