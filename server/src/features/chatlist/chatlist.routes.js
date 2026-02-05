// server/routes/chatList.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../../shared/middleware/auth");
const { getChatList, resetUnread } = require("./chatlist.controller");
const channelCtrl = require("../channels/channel.controller");

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

// Contacts endpoint (for DM discovery)
router.get("/contacts", requireAuth, async (req, res) => {
    try {
        const currentUserId = req.user.sub;
        const User = require("../../../models/User");

        // Get all users except the current user
        const users = await User.find({ _id: { $ne: currentUserId } })
            .select("_id username email profilePicture")
            .limit(100)
            .lean();

        res.json({ contacts: users });
    } catch (_err) {
        console.error("GET CONTACTS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
