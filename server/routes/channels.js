// server/routes/channels.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const channelCtrl = require("../controllers/channelController");

// create channel
router.post("/", requireAuth, channelCtrl.createChannel);

// get my channels
router.get("/my", requireAuth, channelCtrl.getMyChannels);

// invite user
router.post("/:id/invite", requireAuth, channelCtrl.inviteToChannel);

// remove member
router.delete("/:id/member", requireAuth, channelCtrl.removeChannelMember);

// join public
router.post("/:id/join", requireAuth, channelCtrl.joinChannel);

// update channel metadata
router.put("/:id", requireAuth, channelCtrl.updateChannel);

// get members
router.get("/:id/members", requireAuth, channelCtrl.getChannelMembers);

module.exports = router;
