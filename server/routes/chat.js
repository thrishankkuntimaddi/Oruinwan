// server/routes/chat.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const User = require("../models/User");
const Channel = require("../models/Channel");
const chatController = require("../controllers/chatController");

// Get all users (for DM list)
router.get("/users", requireAuth, async (req, res) => {
  try {
    const users = await User.find().select("_id username email profilePicture");
    return res.json({ users });
  } catch (err) {

    res.status(500).json({ message: "Server error" });
  }
});

// Get all channels
router.get("/channels", requireAuth, async (req, res) => {
  try {
    const channels = await Channel.find().select("_id name members");
    return res.json({ channels });
  } catch (err) {

    res.status(500).json({ message: "Server error" });
  }
});

// Get list of all contacts (all users except yourself)
router.get("/contacts", requireAuth, async (req, res) => {
  try {
    const me = req.user.sub;

    const users = await User.find({ _id: { $ne: me } })
      .select("_id username email profilePicture");

    res.json({ contacts: users });
  } catch (err) {

    res.status(500).json({ message: "Server error" });
  }
});

// NEW: Get combined chat list (dms + channels) with lastMessage + unread counts
router.get("/list", requireAuth, chatController.getChatList);

// NEW: Reset unread for a chat (dm or channel)
router.post("/reset-unread", requireAuth, chatController.resetUnread);

module.exports = router;
