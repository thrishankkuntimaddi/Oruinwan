// server/routes/chatList.js
const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/auth");
const { getChatList, resetUnread } = require("../controllers/chatListController");

router.get("/list", requireAuth, getChatList);
router.post("/reset-unread", requireAuth, resetUnread);

module.exports = router;
