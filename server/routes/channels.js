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

// join public discoverable channel (self-service)
router.post("/:id/join-discoverable", requireAuth, channelCtrl.joinDiscoverableChannel);

// update channel metadata
router.put("/:id", requireAuth, channelCtrl.updateChannel);

// get members
router.get("/:id/members", requireAuth, channelCtrl.getChannelMembers);

// ✨ Channel management endpoints
// Get detailed channel info
router.get("/:id/details", requireAuth, channelCtrl.getChannelDetails);

// Update channel info (name/description)
router.put("/:id/info", requireAuth, channelCtrl.updateChannelInfo);

// Update channel name only
router.patch("/:id/name", requireAuth, channelCtrl.updateChannelInfo);

// Update channel description only
router.patch("/:id/description", requireAuth, channelCtrl.updateChannelInfo);

// Toggle channel privacy
router.patch("/:id/privacy", requireAuth, channelCtrl.toggleChannelPrivacy);

// Demote admin
router.post("/:id/demote-admin", requireAuth, channelCtrl.demoteAdmin);

// Remove member
router.post("/:id/remove-member", requireAuth, channelCtrl.removeMember);

// Exit from channel
router.post("/:id/exit", requireAuth, channelCtrl.exitChannel);

// Assign admin
router.post("/:id/assign-admin", requireAuth, channelCtrl.assignAdmin);

// Clear all messages in channel
router.delete("/:id/messages", requireAuth, channelCtrl.clearChannelMessages);

// Join channel via link (with workspace validation)
router.post("/:id/join-via-link", requireAuth, channelCtrl.joinChannelViaLink);

// Delete channel permanently
router.delete("/:id", requireAuth, channelCtrl.deleteChannel);

// --- TAB MANAGEMENT ---
router.get("/:id/tabs", requireAuth, channelCtrl.getTabs);
router.post("/:id/tabs", requireAuth, channelCtrl.addTab);
router.put("/:id/tabs/:tabId", requireAuth, channelCtrl.updateTab);
router.delete("/:id/tabs/:tabId", requireAuth, channelCtrl.deleteTab);

module.exports = router;
