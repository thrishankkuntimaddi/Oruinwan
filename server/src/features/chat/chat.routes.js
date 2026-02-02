// server/routes/chat.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../../shared/middleware/auth");
const { getUsers, getChannels, getContacts, getChatList, resetUnread } = require("./chat.controller");

// Get all users (for DM list)
router.get("/users", requireAuth, getUsers);

// Get all channels
router.get("/channels", requireAuth, getChannels);

// Get list of all contacts (all users except yourself)
router.get("/contacts", requireAuth, getContacts);

// NEW: Get combined chat list (dms + channels) with lastMessage + unread counts
router.get("/list", requireAuth, getChatList);

// NEW: Reset unread for a chat (dm or channel)
router.post("/reset-unread", requireAuth, resetUnread);

module.exports = router;
