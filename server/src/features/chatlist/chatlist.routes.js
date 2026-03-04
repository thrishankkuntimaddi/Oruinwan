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
// SECURITY FIX (H-4): Scope contacts list to the requester's company.
// Previously returned ALL platform users — a user from Company A could enumerate
// every Company B user's email and username. Now: company users see only their
// company; personal users see only other personal (companyless) users.
router.get("/contacts", requireAuth, async (req, res) => {
    try {
        const currentUserId = req.user.sub;
        const User = require("../../../models/User");

        const currentUser = await User.findById(currentUserId).select("companyId").lean();

        // Build company-scoped query (mirrors /api/auth/users fix — BUG-8)
        const query = currentUser?.companyId
            ? { _id: { $ne: currentUserId }, companyId: currentUser.companyId }
            // Match both null and missing field — schema defaults companyId to null
            : { _id: { $ne: currentUserId }, $or: [{ companyId: null }, { companyId: { $exists: false } }] };

        const users = await User.find(query)
            .select("_id username email profilePicture")
            .limit(100)
            .lean();

        res.json({ contacts: users });
    } catch (err) {
        console.error("GET CONTACTS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
