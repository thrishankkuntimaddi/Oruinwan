const logger = require('../../../utils/logger');
const Message = require("../messages/message.model.js");
const Channel = require("../../features/channels/channel.model.js");
const { followThread, unfollowThread, getFollowStatus, getFollowerIds } = require('./threads.service');
const { checkThreadAccess } = require('./threadAccess');

exports.getChannelThreads = async (req, res) => {
    try {
        const { channelId } = req.params;
        const userId = req.user.sub;

        
        const channel = await Channel.findById(channelId);

        if (!channel) {
            return res.status(404).json({ message: "Channel not found" });
        }

        const memberEntry = channel.members.find(m => String(m.user || m) === String(userId));
        if (!memberEntry && !channel.isDefault) {
            return res.status(403).json({ message: "Access denied: You are not a member of this channel" });
        }

        
        const userJoinedAt = memberEntry?.joinedAt || memberEntry?.createdAt || null;

        
        const query = {
            channel: channelId,
            replyCount: { $gt: 0 },
            parentId: null 
        };

        
        if (userJoinedAt) {
            query.createdAt = { $gte: new Date(userJoinedAt) };
        }

        const threads = await Message.find(query)
            .populate("sender", "_id username profilePicture")
            .sort({ lastReplyAt: -1, createdAt: -1 }) 
            .lean();

        return res.json({
            threads,
            count: threads.length,
            channelId,
            userJoinedAt: userJoinedAt || null
        });
    } catch (err) {
        logger.error("[THREADS][GET_CHANNEL_THREADS] Error:", err);
        return res.status(500).json({ message: "Server error fetching threads" });
    }
};

exports.getThread = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;

        
        const parentMessage = await Message.findById(messageId)
            .populate("sender", "_id username profilePicture")
            .lean();

        if (!parentMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        
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

        
        const replies = await Message.find({ parentId: messageId })
            .populate("sender", "_id username profilePicture")
            .sort({ createdAt: 1 })
            .lean();

        
        const followerStrings = (parentMessage.followers || []).map(String);
        const isFollowing = followerStrings.includes(String(userId));

        // Everyone who took part: the author first, then repliers by first reply.
        const participants = [];
        const seen = new Map();
        for (const m of [parentMessage, ...replies]) {
            const u = m.sender;
            const id = u?._id ? String(u._id) : null;
            if (!id) continue;
            if (!seen.has(id)) {
                const entry = { _id: id, username: u.username, profilePicture: u.profilePicture || null, replyCount: 0 };
                seen.set(id, entry);
                participants.push(entry);
            }
            if (m !== parentMessage) seen.get(id).replyCount += 1;
        }

        let resolvedBy = null;
        if (parentMessage.resolvedBy) {
            const User = require("../../../models/User");
            resolvedBy = await User.findById(parentMessage.resolvedBy).select("_id username").lean();
        }

        return res.json({
            parent: parentMessage,
            replies,
            count: replies.length,
            participants,
            resolved: !!parentMessage.resolvedThreadAt,
            resolvedThreadAt: parentMessage.resolvedThreadAt || null,
            resolvedBy,
            
            followStatus: {
                following: isFollowing,
                followerCount: followerStrings.length,
            },
        });
    } catch (err) {
        logger.error("GET THREAD ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.postThreadReply = async (req, res) => {
    try {
        const { messageId } = req.params;
        
        const { ciphertext, messageIv, attachments = [], clientTempId } = req.body;
        const userId = req.user.sub;

        if (!ciphertext || !messageIv) {
            return res.status(400).json({ message: "Encrypted payload required (ciphertext + messageIv)" });
        }

        
        const parentMessage = await Message.findById(messageId);

        if (!parentMessage) {
            return res.status(404).json({ message: "Parent message not found" });
        }

        const access = await checkThreadAccess(parentMessage, userId, { forWrite: true });
        if (!access.ok) return res.status(access.status).json({ message: access.error });

        
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

        
        if (parentMessage.dm) {
            replyData.dm = parentMessage.dm;
        } else if (parentMessage.channel) {
            replyData.channel = parentMessage.channel;
        }

        const reply = await Message.create(replyData);

        
        await reply.populate("sender", "_id username profilePicture");

        
        await Message.findByIdAndUpdate(messageId, {
            $inc: { replyCount: 1 },
            $set: { lastReplyAt: new Date() }
        });

        
        const updatedParent = await Message.findById(messageId)
            .populate("sender", "_id username profilePicture")
            .lean();

        
        const io = req.app?.get("io");

        if (io) {
            const roomName = parentMessage.channel
                ? `channel:${parentMessage.channel}`
                : `dm:${parentMessage.dm}`;

            
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

        
        
        
        
        (async () => {
            try {
                const notificationService = require('../notifications/notificationService');

                
                // The replier follows the thread; on the first reply the message's
                // author does too (after that, their follow choice is respected).
                const autoFollow = [userId];
                if ((parentMessage.replyCount || 0) === 0 && parentMessage.sender) autoFollow.push(parentMessage.sender);
                await Message.findByIdAndUpdate(messageId, {
                    $addToSet: { followers: { $each: autoFollow } }
                });

                
                const allFollowers = await getFollowerIds(messageId);
                const recipientIds = allFollowers.filter(id => id !== String(userId));

                if (recipientIds.length === 0) return;

                
                let channelName = null;
                if (parentMessage.channel) {
                    try {
                        const channelDoc = await Channel.findById(parentMessage.channel).select('name').lean();
                        channelName = channelDoc?.name || null;
                    } catch (_) {  }
                }

                const senderUsername = reply.sender?.username || 'Someone';

                
                await notificationService.threadReply(io, {
                    followerIds: recipientIds,
                    senderUsername,
                    workspaceId: parentMessage.workspace,
                    channelId: parentMessage.channel ? String(parentMessage.channel) : null,
                    channelName,
                    parentMessageId: String(messageId),
                });

                logger.info(`[THREADS] 🔔 thread_reply notifications → ${recipientIds.length} follower(s)`);
            } catch (followErr) {
                logger.error('[THREADS] Follow/notify error (non-fatal):', followErr.message);
            }
        })();

        return res.status(201).json({ reply });
    } catch (err) {
        logger.error("POST THREAD REPLY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.getThreadCount = async (req, res) => {
    try {
        const { messageId } = req.params;
        const count = await Message.countDocuments({ parentId: messageId });
        return res.json({ count });
    } catch (err) {
        logger.error("GET THREAD COUNT ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.followThread = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const access = await checkThreadAccess(messageId, userId);
        if (!access.ok) return res.status(access.status).json({ message: access.error });
        const result = await followThread(messageId, userId);
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

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

exports.getFollowStatus = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const access = await checkThreadAccess(messageId, userId);
        if (!access.ok) return res.status(access.status).json({ message: access.error });
        const result = await getFollowStatus(messageId, userId);
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

exports.resolveThread = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const io = req.app?.get('io');

        const messagesService = require('../messages/messages.service');
        const result = await messagesService.resolveThread(messageId, userId, io);
        return res.json(result);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

exports.summarizeThread = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;

        
        const parentMsg = await Message.findById(messageId)
            .select('text payload channel dm workspace')
            .lean();
        if (!parentMsg) return res.status(404).json({ message: 'Thread not found' });

        
        if (parentMsg.dm) {
            const DMSession = require('../../../models/DMSession');
            const dm = await DMSession.findById(parentMsg.dm).select('participants').lean();
            if (!dm || !dm.participants.map(String).includes(String(userId))) {
                return res.status(403).json({ message: 'Access denied' });
            }
        } else if (parentMsg.channel) {
            const channelDoc = await Channel.findById(parentMsg.channel).lean();
            if (!channelDoc || !channelDoc.members.map(m => String(m.user || m)).includes(String(userId))) {
                return res.status(403).json({ message: 'Access denied' });
            }
        }

        
        const replies = await Message.find({ parentId: messageId })
            .select('text sender')
            .populate('sender', 'username')
            .sort({ createdAt: 1 })
            .lean();

        const replyObjs = replies
            .filter(r => r.text) 
            .map(r => ({ text: r.text, senderName: r.sender?.username || 'User' }));

        const parentText = parentMsg.text || '';

        
        const aiMessagingService = require('../../modules/ai/ai-messaging.service');
        const summary = await aiMessagingService.summarizeThread(messageId, replyObjs, parentText);

        return res.json({ summary, replyCount: replies.length });
    } catch (err) {
        logger.error('[THREADS] summarizeThread error:', err);
        return res.status(500).json({ message: 'Thread summary failed', error: err.message });
    }
};
