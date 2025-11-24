// server/controllers/messagesController.js
const Message = require("../models/Message");
const Channel = require("../models/Channel");
const User = require("../models/User");

// -----------------------------------------------------
// SEND DIRECT MESSAGE (user → user)
// -----------------------------------------------------
exports.sendDirectMessage = async (req, res) => {
  try {
    const senderId = req.user.sub;
    const { receiverId, text, attachments, replyTo } = req.body;

    if (!receiverId)
      return res.status(400).json({ message: "receiverId required" });

    const receiver = await User.findById(receiverId);
    if (!receiver)
      return res.status(404).json({ message: "Receiver not found" });

    const message = await Message.create({
      senderId,
      receiverId,
      text: text || "",
      attachments: attachments || [],
      replyTo: replyTo || null,
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
    if (!channel.members.includes(senderId))
      return res.status(403).json({ message: "Not a channel member" });

    const message = await Message.create({
      senderId,
      channelId,
      text: text || "",
      attachments: attachments || [],
      replyTo: replyTo || null,
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
    const otherUserId = req.params.userId;

    const messages = await Message.find({
      $or: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId }
      ]
    })
      .sort({ createdAt: 1 })
      .populate("senderId", "username email")
      .populate("receiverId", "username email")
      .populate("replyTo");

    return res.json({ messages });
  } catch (err) {
    console.error("GET DM ERROR:", err);
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

    if (!channel.members.includes(userId))
      return res.status(403).json({ message: "Not a channel member" });

    const messages = await Message.find({ channelId })
      .sort({ createdAt: 1 })
      .populate("senderId", "username email")
      .populate("replyTo");

    return res.json({ messages });
  } catch (err) {
    console.error("GET CHANNEL ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
