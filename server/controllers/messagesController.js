// server/controllers/messagesController.js
const Message = require("../models/Message");
const Channel = require("../models/Channel");
const User = require("../models/User");
const DMSession = require("../models/DMSession");
const Workspace = require("../models/Workspace");

// -----------------------------------------------------
// SEND DIRECT MESSAGE (user → user)
// -----------------------------------------------------
exports.sendDirectMessage = async (req, res) => {
  try {
    const senderId = req.user.sub;
    const { receiverId, workspaceId, text, attachments, replyTo } = req.body;

    if (!receiverId)
      return res.status(400).json({ message: "receiverId required" });
    if (!workspaceId)
      return res.status(400).json({ message: "workspaceId required for scoped DMs" });

    const receiver = await User.findById(receiverId);
    if (!receiver)
      return res.status(404).json({ message: "Receiver not found" });

    // Find or create DMSession for this workspace
    let dmSession = await DMSession.findOne({
      workspace: workspaceId,
      participants: { $all: [senderId, receiverId], $size: 2 }
    });

    if (!dmSession) {
      const workspace = await Workspace.findById(workspaceId);
      if (!workspace) return res.status(404).json({ message: "Workspace not found" });

      dmSession = await DMSession.create({
        workspace: workspaceId,
        company: workspace.company || null,
        participants: [senderId, receiverId],
        lastMessageAt: new Date()
      });
    } else {
      dmSession.lastMessageAt = new Date();
      await dmSession.save();
    }

    const message = await Message.create({
      company: dmSession.company,
      workspace: workspaceId,
      dm: dmSession._id,
      sender: senderId,
      text: text || "",
      attachments: attachments || [],
      threadParent: replyTo || null,
    });

    return res.status(201).json({ message });
  } catch (err) {
    console.error("SEND DM ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// -----------------------------------------------------
// SEND CHANNEL MESSAGE
// -----------------------------------------------------
exports.sendChannelMessage = async (req, res) => {
  try {
    const senderId = req.user.sub;
    const { channelId, text, attachments, replyTo } = req.body;

    if (!channelId)
      return res.status(400).json({ message: "channelId required" });

    const channel = await Channel.findById(channelId);
    if (!channel)
      return res.status(404).json({ message: "Channel not found" });

    // Ensure user is a member of the channel
    if (!channel.members.some(m => String(m) === String(senderId)))
      return res.status(403).json({ message: "Not a channel member" });

    const message = await Message.create({
      company: channel.company,
      workspace: channel.workspace,
      channel: channelId,
      sender: senderId,
      text: text || "",
      attachments: attachments || [],
      threadParent: replyTo || null,
    });

    return res.status(201).json({ message });
  } catch (err) {
    console.error("SEND CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// -----------------------------------------------------
// GET DIRECT MESSAGES (conversation between 2 users)
// -----------------------------------------------------
exports.getDMs = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { workspaceId, dmSessionId } = req.params;

    // Validate DMSession
    const dmSession = await DMSession.findById(dmSessionId);
    if (!dmSession) return res.status(404).json({ message: "DM Session not found" });

    // Verify participant
    if (!dmSession.participants.some(p => String(p) === String(userId))) {
      return res.status(403).json({ message: "Not a participant in this DM" });
    }

    const messages = await Message.find({ dm: dmSessionId })
      .sort({ createdAt: 1 })
      .populate("sender", "username email profilePicture")
      .populate("threadParent");

    return res.json({ messages });
  } catch (err) {
    console.error("GET DMs ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// -----------------------------------------------------
// GET CHANNEL MESSAGES
// -----------------------------------------------------
exports.getChannelMessages = async (req, res) => {
  try {
    const userId = req.user.sub;
    const channelId = req.params.channelId;

    const channel = await Channel.findById(channelId);
    if (!channel)
      return res.status(404).json({ message: "Channel not found" });

    // Ensure user is a member of the channel (handle both formats)
    const isMember = channel.members.some(m => {
      const memberId = m.user ? m.user.toString() : m.toString();
      return memberId === userId.toString();
    });

    if (!isMember)
      return res.status(403).json({ message: "Not a channel member" });

    const messages = await Message.find({ channel: channelId })
      .sort({ createdAt: 1 })
      .populate("sender", "username email profilePicture")
      .populate("threadParent");

    // Get user's join date for timeline marker
    const userJoinedAt = channel.getUserJoinDate(userId);

    return res.json({ messages, userJoinedAt });
  } catch (err) {
    console.error("GET CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * Get all DM sessions for a user in a specific workspace
 * GET /api/messages/workspace/:workspaceId/dms
 */
exports.getWorkspaceDMList = async (req, res) => {
  try {
    const userId = req.user.sub;
    const { workspaceId } = req.params;

    const sessions = await DMSession.find({
      workspace: workspaceId,
      participants: userId
    }).populate("participants", "username email profilePicture isOnline");

    // Return sessions with recent message preview and unread counts
    const sessionList = await Promise.all(sessions.map(async (s) => {
      const lastMsg = await Message.findOne({ dm: s._id })
        .sort({ createdAt: -1 })
        .select("text createdAt sender")
        .populate("sender", "username");

      // Filter out current user from participants list to get the "other user"
      const otherUser = s.participants.find(p => String(p._id) !== String(userId));

      // Compute unread count: messages in this DM session not sent by current user and not read by current user
      const unreadCount = await Message.countDocuments({
        dm: s._id,
        sender: { $ne: userId },
        readBy: { $ne: userId }
      });

      return {
        id: s._id,
        otherUser: otherUser || { username: "Self" },
        otherUserId: otherUser?._id,
        lastMessage: lastMsg?.text || "No messages yet",
        lastMessageAt: lastMsg?.createdAt || s.createdAt,
        unreadCount
      };
    }));

    return res.json({ sessions: sessionList });
  } catch (err) {
    console.error("GET WORKSPACE DM LIST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
