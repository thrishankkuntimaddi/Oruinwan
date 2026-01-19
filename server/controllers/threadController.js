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
            .populate("sender", "_id username profilePicture")
            .lean();

        if (!parentMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Check if user has access to this message
        // For DMs: user must be sender or participant
        // For channels: user must be a member (we'll check via Channel model)
        if (parentMessage.dm) {
            // DM message
            const isSender = String(parentMessage.sender._id || parentMessage.sender) === String(userId);
            // For DM, check if user is a participant in the DMSession
            const DMSession = require("../models/DMSession");
            const dmSession = await DMSession.findById(parentMessage.dm);

            if (!dmSession || !dmSession.participants.map(String).includes(String(userId))) {
                return res.status(403).json({ message: "Access denied" });
            }
        } else if (parentMessage.channel) {
            // Channel message - check membership
            const Channel = require("../models/Channel");
            const channel = await Channel.findById(parentMessage.channel);

            if (!channel || !channel.members.map(m => String(m.user || m)).includes(String(userId))) {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        // Get all replies to this message
        const replies = await Message.find({ parentId: messageId })
            .populate("sender", "_id username profilePicture")
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
            type: 'message',
            sender: userId,
            payload: {
                text: text.trim(),
                attachments
            },
            parentId: messageId,
            readBy: [{ user: userId, readAt: new Date() }], // Sender has read it
            workspace: parentMessage.workspace,
            company: parentMessage.company,
        };

        // Set context (DM or channel)
        if (parentMessage.dm) {
            replyData.dm = parentMessage.dm;
        } else if (parentMessage.channel) {
            replyData.channel = parentMessage.channel;
        }

        const reply = await Message.create(replyData);

        // Populate sender info
        await reply.populate("sender", "_id username profilePicture");

        // Update parent message reply count
        await Message.findByIdAndUpdate(messageId, {
            $inc: { replyCount: 1 }
        });

        // Get updated parent message for broadcasting
        const updatedParent = await Message.findById(messageId)
            .populate("sender", "_id username profilePicture")
            .lean();

        // Emit socket event for real-time updates
        const io = req.app?.get("io");
        if (io) {
            if (parentMessage.channel) {
                // Broadcast thread-reply to channel for thread panel updates
                io.to(`channel:${parentMessage.channel}`).emit("thread-reply", {
                    parentId: messageId,
                    reply: reply.toObject(),
                });

                // Broadcast message-updated to update reply count in main chat
                io.to(`channel:${parentMessage.channel}`).emit("message-updated", {
                    messageId: messageId,
                    updates: {
                        replyCount: updatedParent.replyCount
                    },
                    fullMessage: updatedParent
                });
            } else if (parentMessage.dm) {
                // Send to DM session room
                io.to(`dm_${parentMessage.dm}`).emit("thread-reply", {
                    parentId: messageId,
                    reply: reply.toObject(),
                });

                // Broadcast message-updated to update reply count in main chat
                io.to(`dm_${parentMessage.dm}`).emit("message-updated", {
                    messageId: messageId,
                    updates: {
                        replyCount: updatedParent.replyCount
                    },
                    fullMessage: updatedParent
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

        const count = await Message.countDocuments({ parentId: messageId });

        return res.json({ count });
    } catch (err) {
        console.error("GET THREAD COUNT ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
