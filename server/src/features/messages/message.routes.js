// server/src/features/messages/message.routes.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../../shared/middleware/auth");
const { upload } = require("../../../utils/fileUpload");

const {
  sendDirectMessage,
  sendChannelMessage,
  getDMs,
  getChannelMessages,
  getWorkspaceDMList
} = require("../../modules/messages/messages.controller");

// -----------------------
// FILE UPLOAD
// -----------------------
router.post("/upload", requireAuth, upload.array('files', 5), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // Return file URLs
    const fileUrls = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/${file.filename}`
    }));

    return res.json({ files: fileUrls });
  } catch (err) {
    return res.status(500).json({ message: "File upload failed" });
  }
});

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
} = require("../../../controllers/threadController");

router.get("/thread/:messageId", requireAuth, getThread);
router.post("/thread/:messageId", requireAuth, postThreadReply);
router.get("/:messageId/thread-count", requireAuth, getThreadCount);

module.exports = router;
