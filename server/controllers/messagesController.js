/**
 * @owner messages-module
 * @status legacy
 * @remove-after 2026-03
 * @deprecated Use src/modules/messages/ instead
 *
 * FROZEN: This file is in legacy mode.
 * NO plaintext messages allowed.
 * E2EE is mandatory.
 */

const Message = require("../models/Message");
const Channel = require("../models/Channel");
const User = require("../models/User");
const DMSession = require("../models/DMSession");
const Workspace = require("../models/Workspace");
const Task = require("../models/Task");
const { handleError } = require("../utils/responseHelpers");
const { isMember } = require("../utils/memberHelpers");

/* =====================================================
   SEND DIRECT MESSAGE (E2EE ONLY)
===================================================== */
exports.sendDirectMessage = async (req, res) => {
  try {
    const senderId = req.user.sub;
    const {
      receiverId,
      workspaceId,
      attachments,
      replyTo,
      ciphertext,
      messageIv,
      isEncrypted
    } = req.body;

    /* ---------- HARD ENFORCEMENT ---------- */
    if (!isEncrypted || !ciphertext || !messageIv) {
      return res.status(400).json({ message: "E2EE required" });
    }

    if (!receiverId || !workspaceId) {
      return res.status(400).json({ message: "receiverId and workspaceId required" });
    }

    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    /* ---------- DM SESSION ---------- */
    let dmSession = await DMSession.findOne({
      workspace: workspaceId,
      participants: { $all: [senderId, receiverId], $size: 2 }
    });

    if (!dmSession) {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({ message: "Workspace not found" });
      }

      dmSession = await DMSession.create({
        workspace: workspaceId,
        company: workspace.company || null,
        participants: [senderId, receiverId]
      });
    }

    dmSession.lastMessageAt = new Date();
    await dmSession.save();

    /* ---------- CREATE MESSAGE ---------- */
    const message = await Message.create({
      type: "message",
      company: dmSession.company,
      workspace: workspaceId,
      dm: dmSession._id,
      sender: senderId,
      parentId: replyTo || null,
      payload: {
        ciphertext,
        messageIv,
        isEncrypted: true,
        attachments: attachments || []
      }
    });

    await message.populate("sender", "username email profilePicture");

    /* ---------- SOCKET (AFTER DB WRITE) ---------- */
    if (req.io) {
      req.io.to(`dm:${dmSession._id}`).emit("new-message", message);
    }

    return res.status(201).json({ message });
  } catch (err) {
    return handleError(res, err, "SEND DM ERROR");
  }
};

/* =====================================================
   RESOLVE USER ID TO DM SESSION ID
   Find or create DM session with encryption keys
   GET /api/messages/workspace/:workspaceId/dm/resolve/:userId
===================================================== */
exports.resolveDMSession = async (req, res) => {
  try {
    const { workspaceId, userId: otherUserId } = req.params;
    const senderId = req.user.sub;

    console.log(`[resolveDMSession] Finding/creating DM: ${senderId} <-> ${otherUserId} in workspace ${workspaceId}`);

    // Validate inputs
    if (!otherUserId) {
      return res.status(400).json({ message: "User ID required" });
    }

    if (String(senderId) === String(otherUserId)) {
      return res.status(400).json({ message: "Cannot create DM with yourself" });
    }

    // Validate other user exists
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({ message: "User not found" });
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // DM E2EE FIX: Delegate to centralized service that bootstraps encryption keys
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // This ensures every DM session has encryption keys BEFORE the frontend opens it
    const dmSession = await messagesService.findOrCreateDMSession(
      senderId,
      otherUserId,
      workspaceId
    );

    console.log(`[resolveDMSession] Success - DM session ID: ${dmSession._id}`);

    return res.status(200).json({
      success: true,
      dmSessionId: dmSession._id.toString(),
      otherUserId: otherUserId,
      encrypted: true
    });
  } catch (error) {
    console.error('[resolveDMSession] Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to resolve DM session"
    });
  }
};

/* =====================================================
   SEND CHANNEL MESSAGE (E2EE ONLY)
===================================================== */
exports.sendChannelMessage = async (req, res) => {
  try {
    const senderId = req.user.sub;
    const {
      channelId,
      attachments,
      replyTo,
      ciphertext,
      messageIv,
      isEncrypted
    } = req.body;

    /* ---------- HARD ENFORCEMENT ---------- */
    if (!isEncrypted || !ciphertext || !messageIv) {
      return res.status(400).json({ message: "E2EE required" });
    }

    if (!channelId) {
      return res.status(400).json({ message: "channelId required" });
    }

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: "Channel not found" });
    }

    if (!channel.isMember(senderId)) {
      return res.status(403).json({ message: "Not a channel member" });
    }

    /* ---------- CREATE MESSAGE ---------- */
    const message = await Message.create({
      type: "message",
      company: channel.company,
      workspace: channel.workspace,
      channel: channelId,
      sender: senderId,
      parentId: replyTo || null,
      payload: {
        ciphertext,
        messageIv,
        isEncrypted: true,
        attachments: attachments || []
      }
    });

    await message.populate("sender", "username email profilePicture");

    /* ---------- SOCKET (AFTER DB WRITE) ---------- */
    if (req.io) {
      req.io.to(`channel:${channelId}`).emit("new-message", message);
    }

    return res.status(201).json({ message });
  } catch (err) {
    return handleError(res, err, "SEND CHANNEL ERROR");
  }
};

/* =====================================================
   GET DMs (CURSOR PAGINATION - _id)
===================================================== */
exports.getDMs = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { dmSessionId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before;

    const dmSession = await DMSession.findById(dmSessionId);
    if (!dmSession) {
      return res.status(404).json({ message: "DM Session not found" });
    }

    if (!dmSession.participants.some(p => String(p) === String(userId))) {
      return res.status(403).json({ message: "Not a participant" });
    }

    const query = {
      dm: dmSessionId,
      parentId: null
    };

    if (before) {
      query._id = { $lt: before };
    }

    const messages = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit)
      .populate("sender", "username profilePicture")
      .populate("readBy.user", "username");

    messages.reverse();

    return res.json({
      messages,
      hasMore: messages.length === limit
    });
  } catch (err) {
    return handleError(res, err, "GET DMs ERROR");
  }
};

/* =====================================================
   GET CHANNEL MESSAGES (CURSOR + JOIN DATE)
===================================================== */
exports.getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { limit = 50, before } = req.query;
    const userId = req.user.sub;

    const channel = await Channel.findById(channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Channel not found' });
    }

    // Check if user is a member
    const member = channel.members.find(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId;
    });

    if (!member) {
      return res.status(403).json({ message: 'Not a member of this channel' });
    }

    // ✅ PHASE 3: Filter messages by joinedAt timestamp
    // Users should ONLY see messages created after they joined
    const joinedAt = member.joinedAt || channel.createdAt; // Fallback to channel creation for old data

    console.log(`📨 [getChannelMessages] User ${userId} joined at ${joinedAt.toISOString()}`);

    // Build query with joinedAt filter
    const query = {
      channel: channelId,
      createdAt: { $gte: joinedAt } // Only messages after join time
    };

    if (before) {
      query.createdAt.$lt = new Date(before);
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .populate('sender', 'username profilePicture')
      .lean();

    console.log(`📨 [getChannelMessages] Returning ${messages.length} messages (filtered by joinedAt)`);

    return res.json({
      messages: messages.reverse(), // Reverse to chronological order
      hasMore: messages.length === parseInt(limit)
    });
  } catch (err) {
    console.error('GET CHANNEL MESSAGES ERROR:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

/* =====================================================
   WORKSPACE DM LIST (NO PLAINTEXT ACCESS)
===================================================== */
exports.getWorkspaceDMList = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { workspaceId } = req.params;

    const sessions = await DMSession.find({
      workspace: workspaceId,
      participants: userId
    }).populate("participants", "username profilePicture");

    const list = await Promise.all(
      sessions.map(async (s) => {
        const lastMsg = await Message.findOne({ dm: s._id })
          .sort({ _id: -1 })
          .select("createdAt sender")
          .populate("sender", "username");

        const unreadCount = await Message.countDocuments({
          dm: s._id,
          sender: { $ne: userId },
          "readBy.user": { $ne: userId }
        });

        const otherUser = s.participants.find(p => String(p._id) !== String(userId));

        return {
          id: s._id,
          otherUser,
          lastMessageAt: lastMsg?.createdAt || s.createdAt,
          unreadCount
        };
      })
    );

    return res.json({ sessions: list });
  } catch (err) {
    return handleError(res, err, "GET WORKSPACE DM LIST ERROR");
  }
};

/* =====================================================
   AI COMMANDS — DISABLED FOR E2EE (BY DESIGN)
===================================================== */
// ❌ processAICommand REMOVED
// ❌ sendAIReply REMOVED
// Reason: plaintext access is forbidden under E2EE
