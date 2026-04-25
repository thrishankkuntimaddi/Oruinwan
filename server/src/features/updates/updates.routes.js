const express = require("express");
const router = express.Router();
const updateController = require("./updates.controller");
const requireAuth = require("../../shared/middleware/auth");

router.get("/company/:companyId", requireAuth, updateController.getCompanyUpdates);

router.get("/:workspaceId", requireAuth, updateController.getUpdates);

router.post("/", requireAuth, updateController.postUpdate);

router.put("/:id", requireAuth, updateController.updateUpdate);

router.delete("/:id", requireAuth, updateController.deleteUpdate);

router.post("/:id/react", requireAuth, updateController.addReaction);

router.post("/:id/read", requireAuth, updateController.markAsRead);

module.exports = router;
