// server/controllers/chatController.js
const Message = require("../messages/message.model.js");
const Channel = require("../channels/channel.model.js");
const User = require("../../../models/User");
const mongoose = require("mongoose");

// Helper to format preview
function snippet(text, len = 60) {
  if (!text) return "";
  return text.length > len ? text.slice(0, len - 1) + "…" : text;
}

// GET /api/chat/list
// Returns combined DM + Channel list sorted by lastMessageAt desc
exports.getChatList = async (req, res) => {
  try {
    const me = req.user.sub;

    // 1) Channels: channels the user is member of
    const channels = await Channel.find({ members: me }).select("_id name members");

    const channelPromises = channels.map(async (ch) => {
      const lastMsg = await Message.findOne({ channelId: ch._id })
        .sort({ createdAt: -1 })
        .select("text createdAt senderId")
        .populate("senderId", "username");

      // unread count: messages in the channel not read by this user and not sent by the user
      const unreadCount = await Message.countDocuments({
        channelId: ch._id,
        senderId: { $ne: mongoose.Types.ObjectId(me) },
        $or: [{ readBy: { $exists: false } }, { readBy: { $ne: mongoose.Types.ObjectId(me) } }],
      });

      return {
        type: "channel",
        id: ch._id,
        name: ch.name,
        lastMessage: lastMsg ? snippet(lastMsg.text) : "",
        lastMessageAt: lastMsg ? lastMsg.createdAt : null,
        lastMessageSender: lastMsg?.senderId?.username || null,
        unreadCount,
      };
    });

    const channelsResolved = await Promise.all(channelPromises);

    // 2) Direct messages (DMs) — consider all users that have had messages with me OR all users (choose strategy)
    // We'll include users with whom there is at least one message OR all users (your app may want all users).
    // Here: include all users except me (for completeness), but compute lastMessage/unread efficiently.

    const users = await User.find({ _id: { $ne: me } }).select("_id username profilePicture");

    const dmPromises = users.map(async (u) => {
      // last message between me and u
      const lastMsg = await Message.findOne({
        $or: [
          { senderId: me, receiverId: u._id },
          { senderId: u._id, receiverId: me }
        ]
      })
        .sort({ createdAt: -1 })
        .select("text createdAt senderId")
        .populate("senderId", "username");

      // unread count for DMs: messages sent by the other user to me that I haven't read
      const unreadCount = await Message.countDocuments({
        senderId: u._id,
        receiverId: me,
        $or: [{ readBy: { $exists: false } }, { readBy: { $ne: mongoose.Types.ObjectId(me) } }],
      });

      return {
        type: "dm",
        id: u._id,
        name: u.username,
        lastMessage: lastMsg ? snippet(lastMsg.text) : "",
        lastMessageAt: lastMsg ? lastMsg.createdAt : null,
        lastMessageSender: lastMsg?.senderId?.username || null,
        unreadCount,
      };
    });

    const dmsResolved = await Promise.all(dmPromises);

    // Combine and sort by lastMessageAt (nulls last)
    const combined = [...channelsResolved, ...dmsResolved].sort((a, b) => {
      const ta = a.lastMessageAt ? a.lastMessageAt.getTime() : 0;
      const tb = b.lastMessageAt ? b.lastMessageAt.getTime() : 0;
      return tb - ta;
    });

    return res.json({ chats: combined });
  } catch (_err) {
    console.error("GET CHAT LIST ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// POST /api/chat/reset-unread
// Body: { type: "dm"|"channel", id: "<userId|channelId>" }
exports.resetUnread = async (req, res) => {
  try {
    const me = req.user.sub;
    const { type, id } = req.body;

    if (!type || !id) return res.status(400).json({ message: "type and id required" });

    if (type === "dm") {
      const otherUserId = id;
      // mark all messages from otherUser to me as read (add me to readBy)
      await Message.updateMany(
        { senderId: otherUserId, receiverId: me, $or: [{ readBy: { $exists: false } }, { readBy: { $ne: me } }] },
        { $addToSet: { readBy: me } }
      );
      return res.json({ message: "DM unread reset" });
    } else if (type === "channel") {
      const channelId = id;
      const channel = await Channel.findById(channelId);
      if (!channel) return res.status(404).json({ message: "Channel not found" });
      // ensure member
      if (!channel.members.some((m) => m.toString() === me)) return res.status(403).json({ message: "Not a member" });

      await Message.updateMany(
        { channelId: channelId, senderId: { $ne: me }, $or: [{ readBy: { $exists: false } }, { readBy: { $ne: me } }] },
        { $addToSet: { readBy: me } }
      );
      return res.json({ message: "Channel unread reset" });
    } else {
      return res.status(400).json({ message: "Invalid type" });
    }
  } catch (_err) {
    console.error("RESET UNREAD ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
