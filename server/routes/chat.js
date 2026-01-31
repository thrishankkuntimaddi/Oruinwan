// server/routes/chat.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const chatController = require("../controllers/chatController");
const { getUsers, getChannels, getContacts } = require("../src/features/chat/chat.controller");

// Get all users (for DM list)
router.get("/users", requireAuth, getUsers);

// Get all channels
router.get("/channels", requireAuth, getChannels);

// Get list of all contacts (all users except yourself)
router.get("/contacts", requireAuth, getContacts);

// NEW: Get combined chat list (dms + channels) with lastMessage + unread counts
router.get("/list", requireAuth, chatController.getChatList);

// NEW: Reset unread for a chat (dm or channel)
router.post("/reset-unread", requireAuth, chatController.resetUnread);

module.exports = router;
