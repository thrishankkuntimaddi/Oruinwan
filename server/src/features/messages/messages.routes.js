// server/routes/messages.js
// CANONICAL: src/modules/messages/messages.controller.js
const express = require("express");
const router = express.Router();

const requireAuth = require("../../shared/middleware/auth");
const { upload } = require("../../../utils/fileUpload");

const {
  sendDirectMessage,
  sendChannelMessage,
  getDMs,
  getChannelMessages,
  getWorkspaceDMList,
  resolveDMSession
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

// Resolve user ID to DM session ID (find or create with encryption)
router.get("/workspace/:workspaceId/dm/resolve/:userId", requireAuth, resolveDMSession);

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
} = require("../../modules/threads/threads.controller");

router.get("/thread/:messageId", requireAuth, getThread);
router.post("/thread/:messageId", requireAuth, postThreadReply);
router.get("/:messageId/thread-count", requireAuth, getThreadCount);

// -----------------------
// MISSED MESSAGES (Offline Recovery)
// GET /api/messages/missed?conversationId=<id>&type=channel|dm&lastSeenMessageId=<id>
// Returns messages created AFTER lastSeenMessageId, or latest 50 if null.
// Validates membership before returning any data.
// -----------------------
const Message = require('../../features/messages/message.model');
const Channel = require('../../features/channels/channel.model');
const DMSession = require('../../../models/DMSession');
const mongoose = require('mongoose');

router.get('/missed', requireAuth, async (req, res) => {
  try {
    const { conversationId, type, lastSeenMessageId } = req.query;
    const userId = req.user.sub || req.user._id;

    // ── 1. Input validation ──────────────────────────────────────────
    if (!conversationId || !type) {
      return res.status(400).json({ message: 'conversationId and type are required' });
    }
    if (!['channel', 'dm'].includes(type)) {
      return res.status(400).json({ message: 'type must be "channel" or "dm"' });
    }
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({ message: 'Invalid conversationId' });
    }
    if (lastSeenMessageId && !mongoose.Types.ObjectId.isValid(lastSeenMessageId)) {
      return res.status(400).json({ message: 'Invalid lastSeenMessageId' });
    }

    // ── 2. Membership check — do NOT load messages before this ───────
    if (type === 'channel') {
      const channel = await Channel.findById(conversationId).select('members isPrivate isDefault').lean();
      if (!channel) return res.status(404).json({ message: 'Channel not found' });

      const isMember = !channel.isPrivate || channel.isDefault ||
        channel.members.some(m => {
          const memberId = m.user ? m.user.toString() : m.toString();
          return memberId === userId.toString();
        });

      if (!isMember) return res.status(403).json({ message: 'Not a member of this channel' });

    } else { // dm
      const dmSession = await DMSession.findById(conversationId).select('participants').lean();
      if (!dmSession) return res.status(404).json({ message: 'DM session not found' });

      const isParticipant = dmSession.participants.some(p => p.toString() === userId.toString());
      if (!isParticipant) return res.status(403).json({ message: 'Not a participant of this DM' });
    }

    // ── 3. Build query — uses existing compound indexes ──────────────
    // Index hit: { channel, createdAt } or { dm, createdAt } (both defined in message.model.js)
    const query = type === 'channel'
      ? { channel: conversationId }
      : { dm: conversationId };

    // ObjectId values are monotonically ordered by creation time —
    // filtering _id > lastSeenMessageId is equivalent to "created after"
    // and uses the _id index with no extra index required.
    if (lastSeenMessageId) {
      query._id = { $gt: new mongoose.Types.ObjectId(lastSeenMessageId) };
    }

    // Exclude messages hidden from this user
    query.hiddenFor = { $ne: userId };

    // ── 4. Fetch — hard cap at 50, ascending order ───────────────────
    const messages = await Message.find(query)
      .sort({ _id: 1 })                                   // ascending = chronological
      .limit(50)                                          // never load unbounded set
      .select('-hiddenFor -readBy')                       // strip large arrays from payload
      .populate('sender', 'username profilePicture')
      .lean();

    return res.json({
      messages,
      count: messages.length,
      hasMore: messages.length === 50                     // client can paginate if needed
    });

  } catch (err) {
    console.error('[GET /messages/missed] Error:', err);
    return res.status(500).json({ message: 'Failed to fetch missed messages' });
  }
});

module.exports = router;
