// server/src/modules/threads/threads.controller.js
const Message = require("../../features/messages/message.model.js");
const Channel = require("../../features/channels/channel.model.js");

/**
 * Get all active threads for a channel
 * GET /api/threads/channels/:channelId/threads
 * 
 * Returns parent messages that have at least one reply (replyCount > 0)
 * Sorted by most recent reply first
 */
exports.getChannelThreads = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.user.sub;

        // 1. Verify user is a member of this channel and get their join date
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ message: "Channel not found" });
        }

        const memberEntry = channel.members.find(m => String(m.user || m) === String(userId));
        if (!memberEntry && !channel.isDefault) {
            return res.status(403).json({ message: "Access denied: You are not a member of this channel" });
        }

        // Get user's join date (or epoch for default channels / if joinedAt missing)
        const userJoinedAt = memberEntry?.joinedAt || memberEntry?.createdAt || null;

        // 2. Find all parent messages with replies, filtered to after user joined
        const query = {
            channel: channelId,
            replyCount: { $gt: 0 },
            parentId: null // Only parent messages, not replies
        };

        // Filter out threads the user wasn't around for
        if (userJoinedAt) {
            query.createdAt = { $gte: new Date(userJoinedAt) };
        }

        const threads = await Message.find(query)
            .populate("sender", "_id username profilePicture")
            .sort({ lastReplyAt: -1, createdAt: -1 }) // Most recent activity first
            .lean();

        return res.json({
            threads,
            count: threads.length,
            channelId,
            userJoinedAt: userJoinedAt || null
        });
    } catch (err) {
        console.error("[THREADS][GET_CHANNEL_THREADS] Error:", err);
        return res.status(500).json({ message: "Server error fetching threads" });
    }
};

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
            const _isSender = String(parentMessage.sender._id || parentMessage.sender) === String(userId);
            // For DM, check if user is a participant in the DMSession
            const DMSession = require("../../../models/DMSession");
            const dmSession = await DMSession.findById(parentMessage.dm);

            if (!dmSession || !dmSession.participants.map(String).includes(String(userId))) {
                return res.status(403).json({ message: "Access denied" });
            }
        } else if (parentMessage.channel) {
            // Channel message - check membership
            const Channel = require("../../features/channels/channel.model.js");
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
 * Body: { ciphertext, messageIv, attachments?, clientTempId? }
 */
exports.postThreadReply = async (req, res) => {
    try {
        const { messageId } = req.params;
        // E2EE: Expect ciphertext/iv instead of text
        const { ciphertext, messageIv, attachments = [], clientTempId } = req.body;
        const userId = req.user.sub;

        if (!ciphertext || !messageIv) {
            return res.status(400).json({ message: "Encrypted payload required (ciphertext + messageIv)" });
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
                ciphertext,
                messageIv,
                attachments,
                isEncrypted: true
            },
            parentId: messageId,
            readBy: [userId], // Sender has read it (array of ObjectIds)
            workspace: parentMessage.workspace,
            company: parentMessage.company,
            clientTempId // Store optimistic ID if provided
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

        // Update parent message reply count and timestamp
        await Message.findByIdAndUpdate(messageId, {
            $inc: { replyCount: 1 },
            $set: { lastReplyAt: new Date() }
        });

        // Get updated parent message for broadcasting
        const updatedParent = await Message.findById(messageId)
            .populate("sender", "_id username profilePicture")
            .lean();

        // Emit socket event for real-time updates
        const io = req.app?.get("io");

        if (io) {
            const roomName = parentMessage.channel
                ? `channel:${parentMessage.channel}`
                : `dm:${parentMessage.dm}`;

            // ✅ THREAD AWARENESS: Emit thread:created on FIRST reply only
            if (updatedParent.replyCount === 1) {
                io.to(roomName).emit("thread:created", {
                    parentMessageId: messageId,
                    channelId: parentMessage.channel,
                    dmId: parentMessage.dm,
                    replyCount: 1,
                    lastReplyAt: new Date().toISOString(),
                    parentMessage: updatedParent
                });
            }

            if (parentMessage.channel) {
                // Broadcast thread-reply to channel for thread panel updates
                io.to(`channel:${parentMessage.channel}`).emit("thread-reply", {
                    parentId: messageId,
                    reply: reply.toObject(),
                    clientTempId // ✅ Include for optimistic UI reconciliation
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
                io.to(`dm:${parentMessage.dm}`).emit("thread-reply", {
                    parentId: messageId,
                    reply: reply.toObject(),
                    clientTempId // ✅ Include for optimistic UI reconciliation
                });

                // Broadcast message-updated to update reply count in main chat
                io.to(`dm:${parentMessage.dm}`).emit("message-updated", {
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
