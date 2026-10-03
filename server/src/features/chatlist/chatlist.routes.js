const logger = require('../../../utils/logger');
const express = require("express");
const router = express.Router();
const requireAuth = require("../../shared/middleware/auth");
const { getChatList, resetUnread } = require("./chatlist.controller");
const channelCtrl = require("../channels/channel.controller");
const { discoverablePeople } = require("../auth/privacy.service");

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
        // Company accounts see their company; personal accounts see discoverable personal
        // accounts plus anyone they share a workspace with (PostgreSQL, see privacy.service).
        const users = await discoverablePeople(currentUserId, { limit: 100 });

        res.json({ contacts: users });
    } catch (err) {
        logger.error("GET CONTACTS ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
