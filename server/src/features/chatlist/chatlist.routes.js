const express = require("express");
const router = express.Router();
const requireAuth = require("../../shared/middleware/auth");
const { getChatList, resetUnread } = require("./chatlist.controller");
const channelCtrl = require("../channels/channel.controller");

router.get("/list", requireAuth, getChatList);
router.post("/reset-unread", requireAuth, resetUnread);

router.get("/channels", requireAuth, channelCtrl.getMyChannels);
router.get("/channels/public", requireAuth, channelCtrl.getPublicChannels);
router.post("/channel/create", requireAuth, channelCtrl.createChannel);
router.post("/channel/join", requireAuth, async (req, res) => {
    
    req.params.id = req.body.channelId;
    return channelCtrl.joinChannel(req, res);
});

router.get("/contacts", requireAuth, async (req, res) => {
    try {
        const currentUserId = req.user.sub;
        const User = require("../../../models/User");

        const currentUser = await User.findById(currentUserId).select("companyId").lean();

        
        const query = currentUser?.companyId
            ? { _id: { $ne: currentUserId }, companyId: currentUser.companyId }
            
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
