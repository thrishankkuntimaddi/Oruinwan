// server/routes/workspaces.js
const express = require("express");
const router = express.Router();
const workspaceController = require("../controllers/workspaceController");
const auth = require("../middleware/auth");

// Create workspace (personal or company)
router.post("/", auth, workspaceController.createWorkspace);

// IMPORTANT: Specific routes MUST come BEFORE parameterized routes
// Get MY workspaces (only workspaces I'm a member of)
router.get("/my", auth, workspaceController.listMyWorkspaces);

// Get invite details (for preview before joining)
router.get("/invite/:token", workspaceController.getInviteDetails);

// Join workspace via invite
router.post("/join", auth, workspaceController.joinWorkspace);

// Get workspace members (for DM filtering)
router.get("/:workspaceId/members", auth, workspaceController.getWorkspaceMembers);

// Get workspaces by company (legacy/company-specific)
// This MUST be after /my to avoid matching "my" as companyId
router.get("/:companyId", auth, workspaceController.listWorkspaces);

// Invite to workspace
router.post("/:id/invite", auth, workspaceController.inviteToWorkspace);

// Delete workspace (only owner can delete)
router.delete("/:id", auth, workspaceController.deleteWorkspace);

module.exports = router;

