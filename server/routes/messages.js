// server/routes/messages.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/auth");
const {
  sendDirectMessage,
  sendChannelMessage,
  getDMs,
  getChannelMessages
} = require("../controllers/messagesController");

// -----------------------
// DIRECT MESSAGES
// -----------------------
router.post("/dm/send", requireAuth, sendDirectMessage);
router.get("/dm/:userId", requireAuth, getDMs);

// -----------------------
// CHANNEL MESSAGES
// -----------------------
router.post("/channel/send", requireAuth, sendChannelMessage);
router.get("/channel/:channelId", requireAuth, getChannelMessages);

// -----------------------
// THREADS
// -----------------------
const {
  getThread,
  postThreadReply,
  getThreadCount
} = require("../controllers/threadController");

router.get("/thread/:messageId", requireAuth, getThread);
router.post("/thread/:messageId", requireAuth, postThreadReply);
router.get("/:messageId/thread-count", requireAuth, getThreadCount);

module.exports = router;
