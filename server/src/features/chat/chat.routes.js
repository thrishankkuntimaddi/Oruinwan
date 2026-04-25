const express = require("express");
const router = express.Router();
const requireAuth = require("../../shared/middleware/auth");
const { getUsers, getChannels, getContacts, getChatList, resetUnread } = require("./chat.controller");

router.get("/users", requireAuth, getUsers);

router.get("/channels", requireAuth, getChannels);

router.get("/contacts", requireAuth, getContacts);

router.get("/list", requireAuth, getChatList);

router.post("/reset-unread", requireAuth, resetUnread);

module.exports = router;
