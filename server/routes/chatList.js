// server/routes/chatList.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const { getChatList, resetUnread } = require("../controllers/chatListController");
const channelCtrl = require("../controllers/channelController");

// Chat list routes
router.get("/list", requireAuth, getChatList);
router.post("/reset-unread", requireAuth, resetUnread);

// Channel routes (aliases for consistency with /api/chat namespace)
router.get("/channels", requireAuth, channelCtrl.getMyChannels);
router.get("/channels/public", requireAuth, channelCtrl.getPublicChannels);
router.post("/channel/create", requireAuth, channelCtrl.createChannel);
router.post("/channel/join", requireAuth, async (req, res) => {
    // Adapter to handle channelId in body instead of params
    req.params.id = req.body.channelId;
    return channelCtrl.joinChannel(req, res);
});

module.exports = router;
