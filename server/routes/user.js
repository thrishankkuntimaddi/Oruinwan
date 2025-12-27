// server/routes/user.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const userController = require("../controllers/userController");

router.post("/block", requireAuth, userController.blockUser);
router.post("/unblock", requireAuth, userController.unblockUser);
router.get("/blocked", requireAuth, userController.getBlockedUsers);
router.post("/dm/:dmId/mute", requireAuth, userController.muteDM);
router.delete("/dm/:dmId/delete", requireAuth, userController.deleteDM);

// User Status
router.patch("/status", requireAuth, userController.updateStatus);

module.exports = router;
