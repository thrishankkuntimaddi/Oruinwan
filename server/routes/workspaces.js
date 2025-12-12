// server/routes/workspaces.js
const express = require("express");
const router = express.Router();
const workspaceController = require("../controllers/workspaceController");
const auth = require("../middleware/auth");

// Create workspace (personal or company)
router.post("/", auth, workspaceController.createWorkspace);

// Get MY workspaces (only workspaces I'm a member of)
router.get("/my", auth, workspaceController.listMyWorkspaces);

// Get workspaces by company (legacy/company-specific)
router.get("/:companyId", auth, workspaceController.listWorkspaces);

// Get workspace members (for DM filtering)
router.get("/:workspaceId/members", auth, workspaceController.getWorkspaceMembers);

// Invite to workspace
router.post("/:id/invite", auth, workspaceController.inviteToWorkspace);

module.exports = router;
