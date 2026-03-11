// server/src/modules/threads/threads.controller.js
const Message = require("../../features/messages/message.model.js");
const Channel = require("../../features/channels/channel.model.js");
const { followThread, unfollowThread, getFollowStatus, getFollowerIds } = require('./threads.service');

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

        // Get the parent message first — include followers for client follow-status bootstrap
        const parentMessage = await Message.findById(messageId)
            .populate("sender", "_id username profilePicture")
            .lean();

        if (!parentMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Check if user has access to this message
        if (parentMessage.dm) {
            const DMSession = require("../../../models/DMSession");
            const dmSession = await DMSession.findById(parentMessage.dm);

            if (!dmSession || !dmSession.participants.map(String).includes(String(userId))) {
                return res.status(403).json({ message: "Access denied" });
            }
        } else if (parentMessage.channel) {
            const Channel = require("../../features/channels/channel.model.js");
            const channel = await Channel.findById(parentMessage.channel);

            if (!channel || !channel.members.map(m => String(m.user || m)).includes(String(userId))) {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        // Get all replies to this message
        const replies = await Message.find({ parentId: messageId })
            .populate("sender", "_id username profilePicture")
            .sort({ createdAt: 1 })
            .lean();

        // Compute follow status for the requesting user
        const followerStrings = (parentMessage.followers || []).map(String);
        const isFollowing = followerStrings.includes(String(userId));

        return res.json({
            parent: parentMessage,
            replies,
            count: replies.length,
            // Follow metadata — clients use this to bootstrap the UI without a second request
            followStatus: {
                following: isFollowing,
                followerCount: followerStrings.length,
            },
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
            readBy: [userId],
            workspace: parentMessage.workspace,
            company: parentMessage.company,
            clientTempId
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

            // Emit thread:created on FIRST reply only
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
                io.to(`channel:${parentMessage.channel}`).emit("thread-reply", {
                    parentId: messageId,
                    reply: reply.toObject(),
                    clientTempId
                });

                io.to(`channel:${parentMessage.channel}`).emit("message-updated", {
                    messageId: messageId,
                    updates: { replyCount: updatedParent.replyCount },
                    fullMessage: updatedParent
                });
            } else if (parentMessage.dm) {
                io.to(`dm:${parentMessage.dm}`).emit("thread-reply", {
                    parentId: messageId,
                    reply: reply.toObject(),
                    clientTempId
                });

                io.to(`dm:${parentMessage.dm}`).emit("message-updated", {
                    messageId: messageId,
                    updates: { replyCount: updatedParent.replyCount },
                    fullMessage: updatedParent
                });
            }
        }

        // ==================================================================
        // THREAD FOLLOW — Auto-follow sender + notify existing followers
        // Fire-and-forget: never delays the HTTP response
        // ==================================================================
        (async () => {
            try {
                const notificationService = require('../../features/notifications/notificationService');

                // 1. Auto-follow: add the replier to followers (idempotent)
                await Message.findByIdAndUpdate(messageId, {
                    $addToSet: { followers: userId }
                });

                // 2. Collect all current followers (after auto-follow) and exclude sender
                const allFollowers = await getFollowerIds(messageId);
                const recipientIds = allFollowers.filter(id => id !== String(userId));

                if (recipientIds.length === 0) return;

                // 3. Resolve channel name for notification body
                let channelName = null;
                if (parentMessage.channel) {
                    try {
                        const channelDoc = await Channel.findById(parentMessage.channel).select('name').lean();
                        channelName = channelDoc?.name || null;
                    } catch (_) { /* non-critical */ }
                }

                const senderUsername = reply.sender?.username || 'Someone';

                // 4. Send thread_reply notifications to all followers except sender
                await notificationService.threadReply(io, {
                    followerIds: recipientIds,
                    senderUsername,
                    workspaceId: parentMessage.workspace,
                    channelId: parentMessage.channel ? String(parentMessage.channel) : null,
                    channelName,
                    parentMessageId: String(messageId),
                });

                console.log(`[THREADS] 🔔 thread_reply notifications → ${recipientIds.length} follower(s)`);
            } catch (followErr) {
                console.error('[THREADS] Follow/notify error (non-fatal):', followErr.message);
            }
        })();

        return res.status(201).json({ reply });
    } catch (err) {
        console.error("POST THREAD REPLY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Get thread reply count for a message
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

// ==================================================================
// FOLLOW / UNFOLLOW ENDPOINTS
// ==================================================================

/**
 * Follow a thread
 * POST /api/threads/:messageId/follow
 */
exports.followThread = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const result = await followThread(messageId, userId);
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

/**
 * Unfollow a thread
 * DELETE /api/threads/:messageId/follow
 */
exports.unfollowThread = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const result = await unfollowThread(messageId, userId);
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

/**
 * Get follow status for the current user on a thread
 * GET /api/threads/:messageId/follow
 */
exports.getFollowStatus = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const result = await getFollowStatus(messageId, userId);
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};
