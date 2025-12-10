// server/routes/workspaces.js
const express = require("express");
const router = express.Router();
const workspaceController = require("../controllers/workspaceController");
const auth = require("../middleware/auth");

router.post("/", auth, workspaceController.createWorkspace);
router.get("/:companyId", auth, workspaceController.listWorkspaces);
router.post("/:id/invite", auth, workspaceController.inviteToWorkspace);

module.exports = router;
