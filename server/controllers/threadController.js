// server/controllers/threadController.js
const Message = require("../models/Message");

/**
 * Get all replies to a specific message (thread)
 * GET /api/messages/thread/:messageId
 */
exports.getThread = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;

        // Get the parent message first
        const parentMessage = await Message.findById(messageId)
            .populate("senderId", "_id username profilePicture")
            .lean();

        if (!parentMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Check if user has access to this message
        // For DMs: user must be sender or receiver
        // For channels: user must be a member (we'll check via Channel model)
        if (parentMessage.receiverId) {
            // DM message
            const isSender = String(parentMessage.senderId._id || parentMessage.senderId) === String(userId);
            const isReceiver = String(parentMessage.receiverId) === String(userId);

            if (!isSender && !isReceiver) {
                return res.status(403).json({ message: "Access denied" });
            }
        } else if (parentMessage.channelId) {
            // Channel message - check membership
            const Channel = require("../models/Channel");
            const channel = await Channel.findById(parentMessage.channelId);

            if (!channel || !channel.members.map(String).includes(String(userId))) {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        // Get all replies to this message
        const replies = await Message.find({ replyTo: messageId })
            .populate("senderId", "_id username profilePicture")
            .sort({ createdAt: 1 }) // Oldest first for threads
            .lean();

        return res.json({
            parent: parentMessage,
            replies,
            count: replies.length,
        });
    } catch (err) {
        console.error("GET THREAD ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Post a reply to a thread
 * POST /api/messages/thread/:messageId
 * Body: { text, attachments? }
 */
exports.postThreadReply = async (req, res) => {
    try {
        const { messageId } = req.params;
        const { text, attachments = [] } = req.body;
        const userId = req.user.sub;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ message: "Message text required" });
        }

        // Get parent message to determine context (DM or channel)
        const parentMessage = await Message.findById(messageId);

        if (!parentMessage) {
            return res.status(404).json({ message: "Parent message not found" });
        }

        // Create the reply message
        const replyData = {
            senderId: userId,
            text: text.trim(),
            attachments,
            replyTo: messageId,
            readBy: [userId], // Sender has read it
        };

        // Set context (DM or channel)
        if (parentMessage.receiverId) {
            replyData.receiverId = parentMessage.receiverId;
        } else if (parentMessage.channelId) {
            replyData.channelId = parentMessage.channelId;
        }

        const reply = await Message.create(replyData);

        // Populate sender info
        await reply.populate("senderId", "_id username profilePicture");

        // Emit socket event for real-time updates
        const io = req.app?.get("io");
        if (io) {
            if (parentMessage.channelId) {
                // Broadcast to channel
                io.to(`channel_${parentMessage.channelId}`).emit("thread-reply", {
                    parentId: messageId,
                    reply: reply.toObject(),
                });
            } else if (parentMessage.receiverId) {
                // Send to both DM participants
                io.to(`user_${parentMessage.senderId}`).emit("thread-reply", {
                    parentId: messageId,
                    reply: reply.toObject(),
                });
                io.to(`user_${parentMessage.receiverId}`).emit("thread-reply", {
                    parentId: messageId,
                    reply: reply.toObject(),
                });
            }
        }

        return res.status(201).json({ reply });
    } catch (err) {
        console.error("POST THREAD REPLY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get thread count for a message (how many replies)
 * GET /api/messages/:messageId/thread-count
 */
exports.getThreadCount = async (req, res) => {
    try {
        const { messageId } = req.params;

        const count = await Message.countDocuments({ replyTo: messageId });

        return res.json({ count });
    } catch (err) {
        console.error("GET THREAD COUNT ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
