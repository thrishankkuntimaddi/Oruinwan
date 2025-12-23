// server/routes/messages.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../middleware/auth");
const {
  sendDirectMessage,
  sendChannelMessage,
  getDMs,
  getChannelMessages,
  getWorkspaceDMList
} = require("../controllers/messagesController");

// -----------------------
// DIRECT MESSAGES (Workspace-scoped)
// -----------------------
router.post("/dm/send", requireAuth, sendDirectMessage);
router.get("/dm/:workspaceId/:dmSessionId", requireAuth, getDMs);
router.get("/workspace/:workspaceId/dms", requireAuth, getWorkspaceDMList);

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
