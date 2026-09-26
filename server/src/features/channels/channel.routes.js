const express = require("express");
const { requireCompanyPermission } = require('../../shared/companyPermissions');
const router = express.Router();
const requireAuth = require("../../shared/middleware/auth");
const channelCtrl = require("./channel.controller");

router.post("/", requireAuth, requireCompanyPermission("createChannel"), channelCtrl.createChannel);

router.get("/public", channelCtrl.getPublicChannelList);

router.get("/:id/public", channelCtrl.getPublicChannelById);

router.patch("/:id/make-public", requireAuth, channelCtrl.togglePublicChannel);

router.get("/my", requireAuth, channelCtrl.getMyChannels);

router.post("/:id/invite", requireAuth, channelCtrl.inviteToChannel);

router.delete("/:id/member", requireAuth, channelCtrl.removeChannelMember);

router.post("/:id/join", requireAuth, channelCtrl.joinChannel);

router.put("/:id", requireAuth, channelCtrl.updateChannel);

router.get("/:id/members", requireAuth, channelCtrl.getChannelMembers);

router.get("/:id/details", requireAuth, channelCtrl.getChannelDetails);

router.put("/:id/info", requireAuth, channelCtrl.updateChannelInfo);

router.patch("/:id/name", requireAuth, channelCtrl.updateChannelInfo);

router.patch("/:id/description", requireAuth, channelCtrl.updateChannelInfo);

router.patch("/:id/privacy", requireAuth, channelCtrl.toggleChannelPrivacy);

router.post("/:id/demote-admin", requireAuth, channelCtrl.demoteAdmin);

router.post("/:id/remove-member", requireAuth, channelCtrl.removeMember);

router.post("/:id/exit", requireAuth, channelCtrl.exitChannel);

router.post("/:id/assign-admin", requireAuth, channelCtrl.assignAdmin);

router.delete("/:id/messages", requireAuth, channelCtrl.clearChannelMessages);

router.post("/:id/join-via-link", requireAuth, channelCtrl.joinChannelViaLink);

router.post("/:id/join-discoverable", requireAuth, channelCtrl.joinDiscoverableChannel);

router.delete("/:id", requireAuth, channelCtrl.deleteChannel);

router.get("/:id/tabs", requireAuth, channelCtrl.getTabs);
const channelMute = require("./channelMute.controller");
router.get("/:id/mute", requireAuth, channelMute.getMute);
router.post("/:id/mute", requireAuth, channelMute.mute);
router.delete("/:id/mute", requireAuth, channelMute.unmute);
router.patch("/:id/mention-policy", requireAuth, channelMute.setMentionPolicy);
router.patch("/:id/posting-policy", requireAuth, channelMute.setPostingPolicy);

router.post("/:id/tabs", requireAuth, channelCtrl.addTab);
router.put("/:id/tabs/:tabId", requireAuth, channelCtrl.updateTab);
router.delete("/:id/tabs/:tabId", requireAuth, channelCtrl.deleteTab);

module.exports = router;
