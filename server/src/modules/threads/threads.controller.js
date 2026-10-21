const { hydrate } = require("../../identity/hydrate");
const SENDER = { type: 'user', fields: ['username', 'profilePicture'] };
const logger = require('../../../utils/logger');
const Message = require("../messages/message.model.js");
const Channel = require("../../features/channels/channel.model.js");
const { followThread, unfollowThread, getFollowStatus, LIVE_REPLY, followAndNotify } = require('./threads.service');
const { checkThreadAccess } = require('./threadAccess');
const { sanitizeAttachments } = require('../uploads/attachmentSanitizer');
const { normalizeClientMessageId, findByClientMessageId, isDuplicateKeyError } = require('../messages/clientMessageId');

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
            .sort({ lastReplyAt: -1, createdAt: -1 }) 
            .lean();
        await hydrate(threads, { sender: SENDER });

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

        const parentMessage = await Message.findById(messageId).lean();
        if (!parentMessage) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Same rule as replying: DM participants, channel members (public channels: workspace members).
        const access = await checkThreadAccess(parentMessage, userId);
        if (!access.ok) return res.status(access.status === 404 ? 403 : access.status).json({ message: "Access denied" });
        await hydrate(parentMessage, { sender: SENDER });

        // A deleted parent keeps its thread, but not its content.
        if (parentMessage.isDeletedUniversally || parentMessage.isDeleted) {
            parentMessage.payload = { isDeleted: true };
            parentMessage.text = '';
        }

        // Replies deleted for everyone, or hidden by this user, are left out.
        const replies = await Message.find({ parentId: messageId, ...LIVE_REPLY, hiddenFor: { $ne: userId } })
            .sort({ createdAt: 1 })
            .lean();
        await hydrate(replies, { sender: SENDER });

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

        // Opening a thread reads it: its reply and mention notifications clear on every device.
        try {
            require('../notifications/notificationService')
                .markConversationRead?.(req.app?.get?.('io'), { userId, threadId: messageId })
                ?.catch?.(() => {});
        } catch { /* reading the thread never fails because of notifications */ }

        let resolvedBy = null;
        if (parentMessage.resolvedBy) {
            const u = await require("../../identity").users.findById(parentMessage.resolvedBy);
            resolvedBy = u ? { _id: u._id, username: u.username } : null;
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
        const { ciphertext, messageIv, attachments = [], clientTempId } = req.body || {};
        const userId = req.user.sub;

        if (!ciphertext || !messageIv) {
            return res.status(400).json({ message: "Encrypted payload required (ciphertext + messageIv)" });
        }

        const parentMessage = await Message.findById(messageId).lean();
        if (!parentMessage) {
            return res.status(404).json({ message: "Parent message not found" });
        }
        // Threads are one level deep: a reply cannot start its own thread.
        if (parentMessage.parentId) {
            return res.status(400).json({ message: "Reply in the original thread instead" });
        }

        const access = await checkThreadAccess(parentMessage, userId, { forWrite: true });
        if (!access.ok) return res.status(access.status).json({ message: access.error });

        // Same check as channel and DM messages: only files the sender uploaded and can read,
        // since a file referenced by a message becomes readable to that conversation.
        let cleanAttachments;
        try {
            cleanAttachments = await sanitizeAttachments(attachments, userId);
        } catch (err) {
            if (err && err.status && err.status < 500) return res.status(err.status).json({ message: err.message, code: err.code });
            throw err;
        }

        const replyData = {
            type: 'message',
            sender: userId,
            payload: {
                ciphertext,
                messageIv,
                isEncrypted: true
            },
            // Files sit on the message like channel and DM files (the payload schema has no
            // attachments field, so files put there were silently dropped).
            attachments: cleanAttachments,
            parentId: messageId,
            readBy: [userId],
            workspace: parentMessage.workspace,
            company: parentMessage.company,
            clientTempId
        };
        if (parentMessage.dm) replyData.dm = parentMessage.dm;
        else if (parentMessage.channel) replyData.channel = parentMessage.channel;

        // Offline-queue resend (same clientMessageId): return the stored reply.
        const clientMessageId = normalizeClientMessageId(req.body?.clientMessageId);
        const replayed = async () => {
            const existing = await findByClientMessageId(Message, userId, clientMessageId);
            if (!existing) return null;
            const out = existing.toObject();
            await hydrate(out, { sender: SENDER });
            return res.status(200).json({ reply: out, duplicate: true });
        };
        if (clientMessageId) {
            replyData.clientMessageId = clientMessageId;
            const sent = await replayed();
            if (sent) return sent;
        }

        let reply;
        try {
            reply = await Message.create(replyData);
        } catch (err) {
            if (clientMessageId && isDuplicateKeyError(err)) {
                const sent = await replayed();
                if (sent) return sent;
            }
            throw err;
        }
        const replyOut = reply.toObject();
        await hydrate(replyOut, { sender: SENDER });

        const lastReplyAt = replyOut.createdAt || new Date();
        const updatedParent = await Message.findByIdAndUpdate(messageId, {
            $inc: { replyCount: 1 },
            $set: { lastReplyAt }
        }, { new: true }).lean();
        if (updatedParent) await hydrate(updatedParent, { sender: SENDER });

        const io = req.app?.get("io");
        if (io && updatedParent) {
            const roomName = parentMessage.channel ? `channel:${parentMessage.channel}` : `dm:${parentMessage.dm}`;
            const lastReplyIso = new Date(lastReplyAt).toISOString();

            if (updatedParent.replyCount === 1) {
                io.to(roomName).emit("thread:created", {
                    parentMessageId: messageId,
                    channelId: parentMessage.channel,
                    dmId: parentMessage.dm,
                    replyCount: 1,
                    lastReplyAt: lastReplyIso,
                    parentMessage: updatedParent
                });
            }
            io.to(roomName).emit("thread-reply", { parentId: messageId, reply: replyOut, clientTempId });
            io.to(roomName).emit("message-updated", {
                messageId,
                channelId: parentMessage.channel ? String(parentMessage.channel) : null,
                dmId: parentMessage.dm ? String(parentMessage.dm) : null,
                updates: { replyCount: updatedParent.replyCount, lastReplyAt: lastReplyIso },
                fullMessage: updatedParent
            });
        }

        // Following and notifications never delay or fail the reply.
        followAndNotify(io, { parent: parentMessage, replierId: userId, senderUsername: replyOut.sender?.username, mentionText: typeof req.body?.mentionText === "string" ? req.body.mentionText : "", replyId: reply._id })
            .catch((err) => logger.error('[THREADS] Follow/notify error (non-fatal):', err.message));

        return res.status(201).json({ reply: replyOut });
    } catch (err) {
        logger.error("POST THREAD REPLY ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

exports.getThreadCount = async (req, res) => {
    try {
        const { messageId } = req.params;
        const access = await checkThreadAccess(messageId, req.user.sub);
        if (!access.ok) return res.status(access.status).json({ message: access.error });
        const count = await Message.countDocuments({ parentId: messageId, ...LIVE_REPLY });
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
            .sort({ createdAt: 1 })
            .lean();
        await hydrate(replies, { sender: { type: 'user', fields: ['username'] } });

        const replyObjs = replies
            .filter(r => r.text) 
            .map(r => ({ text: r.text, senderName: r.sender?.username || 'User' }));

        const parentText = parentMsg.text || '';

        
        const aiMessagingService = require('../../modules/ai/ai-messaging.service');
        const summary = await aiMessagingService.summarizeThread(messageId, replyObjs, parentText, { userId: req.user?.sub, workspaceId: parentMsg.workspace ? String(parentMsg.workspace) : null });

        return res.json({ summary, replyCount: replies.length });
    } catch (err) {
        if (require('../../shared/plans').sendPlanLimit(res, err)) return;
        logger.error('[THREADS] summarizeThread error:', err);
        return res.status(500).json({ message: 'Thread summary failed', error: err.message });
    }
};
