// server/src/modules/messages/messages.controller.js
/**
 * Messages Controller - HTTP Request Handler
 * Handles all message-related HTTP endpoints
 * 
 * @module messages/controller
 */

const messagesService = require('./messages.service');
const Channel = require("../../features/channels/channel.model.js");
const User = require('../../../models/User');
const DMSession = require('../../../models/DMSession');
const { handleError } = require('../../../utils/responseHelpers');
const conversationKeysService = require('../conversations/conversationKeys.service');
const mongoose = require('mongoose');

// ==================== DIRECT MESSAGES ====================

/**
 * Send a direct message
 * POST /api/messages/direct
 */
exports.sendDirectMessage = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: sendDirectMessage');
    try {
        const senderId = req.user.sub;
        const {
            receiverId,
            dmSessionId,  // NEW: Accept DM session ID directly
            workspaceId,
            attachments,
            replyTo,
            ciphertext,
            messageIv,
            isEncrypted,
            clientTempId
        } = req.body;

        // ============================================================
        // E2EE HARD ENFORCEMENT
        // ============================================================
        if (!ciphertext || !messageIv || !isEncrypted) {
            return res.status(400).json({
                message: 'E2EE required: ciphertext and messageIv must be provided'
            });
        }

        // ============================================================
        // DUAL MODE: Accept either dmSessionId OR receiverId
        // ============================================================
        let dmSession;

        if (dmSessionId) {
            // MODE 1: Use existing DM session (recommended, more efficient)
            console.log('📨 [sendDirectMessage] Using DM session ID:', dmSessionId);

            dmSession = await DMSession.findById(dmSessionId);
            if (!dmSession) {
                return res.status(404).json({ message: 'DM Session not found' });
            }

            // Verify sender is a participant
            const isParticipant = dmSession.participants.some(
                (p) => String(p) === String(senderId)
            );
            if (!isParticipant) {
                return res.status(403).json({
                    message: 'Not authorized to send messages in this DM'
                });
            }

            console.log('✅ [sendDirectMessage] DM session verified, participants:',
                dmSession.participants.map(p => String(p)));

        } else if (receiverId) {
            // MODE 2: Legacy mode - find/create by receiver ID
            console.log('📨 [sendDirectMessage] Using receiver ID:', receiverId);

            // Validation
            if (!workspaceId) {
                return res.status(400).json({ message: 'workspaceId required when using receiverId' });
            }

            // Verify receiver exists
            const receiver = await User.findById(receiverId);
            if (!receiver) {
                return res.status(404).json({ message: 'Receiver not found' });
            }

            // Find or create DM session
            dmSession = await messagesService.findOrCreateDMSession(
                senderId,
                receiverId,
                workspaceId
            );

            console.log('✅ [sendDirectMessage] DM session resolved:', dmSession._id);
        } else {
            return res.status(400).json({
                message: 'Either dmSessionId or receiverId must be provided'
            });
        }

        // Create message (E2EE enforced in service layer)
        const message = await messagesService.createMessage(
            {
                type: 'message',
                company: dmSession.company,
                workspace: dmSession.workspace,
                dm: dmSession._id,
                sender: senderId,
                attachments,
                parentId: replyTo || null,
                ciphertext,
                messageIv,
                isEncrypted,
                clientTempId
            },
            req.io
        );

        return res.status(201).json({ message });
    } catch (err) {
        return handleError(res, err, 'SEND DM ERROR');
    }
};

/**
 * Get direct messages for a DM session
 * GET /api/messages/workspace/:workspaceId/dm/:dmSessionId
 */
exports.getDMs = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: getDMs');
    try {
        const userId = req.user.sub;
        const { workspaceId, dmSessionId, dmId } = req.params;
        const { limit, before } = req.query;

        console.log('🔍 [getDMs] DEBUG:', {
            userId,
            workspaceId,
            dmSessionId,
            dmId,
            allParams: req.params,
            fullPath: req.path,
            originalUrl: req.originalUrl
        });

        // Support both parameter names for backward compatibility
        const sessionId = dmSessionId || dmId;

        console.log('🔍 [getDMs] Looking up DM session:', {
            sessionId,
            sessionIdType: typeof sessionId,
            sessionIdLength: sessionId?.length
        });

        // Validate DM session
        let dmSession = await DMSession.findById(sessionId);

        console.log('🔍 [getDMs] DM session lookup result:', {
            found: !!dmSession,
            sessionId,
            dmSessionData: dmSession ? {
                _id: dmSession._id,
                workspace: dmSession.workspace,
                participants: dmSession.participants
            } : null
        });

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // AUTO-FIX: If DM session doesn't exist, try treating sessionId as userId
        // This handles cases where frontend passes userId instead of sessionId
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (!dmSession) {
            console.log('⚠️ [getDMs] DM session not found, attempting to resolve as userId...');
            console.log('🔄 [getDMs] Treating sessionId as otherUserId and creating DM session');

            try {
                // Try to create/find DM session using the ID as a user ID
                dmSession = await messagesService.findOrCreateDMSession(
                    userId,           // Current user
                    sessionId,        // Treat sessionId as the other user's ID
                    workspaceId
                );

                console.log('✅ [getDMs] DM session resolved/created:', {
                    newSessionId: dmSession._id,
                    originalIdWasUserId: true
                });
            } catch (resolveError) {
                console.error('❌ [getDMs] Failed to resolve DM session:', resolveError.message);
                return res.status(404).json({
                    message: 'DM Session not found and could not be created',
                    details: resolveError.message
                });
            }
        }

        // Verify user is a participant
        const isParticipant = dmSession.participants.some(
            (p) => String(p) === String(userId)
        );
        if (!isParticipant) {
            return res.status(403).json({ message: 'Not a participant in this DM' });
        }

        // Fetch messages
        const result = await messagesService.fetchMessages(
            { dm: dmSession._id },  // Use the resolved session ID
            {
                limit: parseInt(limit) || 50,
                before,
                populateReplies: true,
                userId   // ← exclude messages hidden by this user
            }
        );

        // ✅ CRITICAL: Tell frontend if we auto-created/resolved a different session
        // This allows frontend to redirect to the correct URL
        const wasAutoResolved = String(sessionId) !== String(dmSession._id);

        return res.json({
            ...result,
            // Include session metadata for frontend
            dmSessionId: dmSession._id,
            redirectRequired: wasAutoResolved,
            ...(wasAutoResolved && {
                notice: 'DM session was resolved from user ID to session ID'
            })
        });
    } catch (err) {
        return handleError(res, err, 'GET DMs ERROR');
    }
};

/**
 * Get all DM sessions for user in workspace
 * GET /api/messages/workspace/:workspaceId/dms
 */
exports.getWorkspaceDMList = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: getWorkspaceDMList');
    try {
        const userId = req.user.sub;
        const { workspaceId } = req.params;

        const sessions = await messagesService.getUserDMSessions(userId, workspaceId);

        return res.json({ sessions });
    } catch (err) {
        return handleError(res, err, 'GET WORKSPACE DM LIST ERROR');
    }
};

/**
 * Resolve user ID to DM session ID
 * Find or create DM session with encryption keys
 * GET /api/messages/workspace/:workspaceId/dm/resolve/:userId
 */
exports.resolveDMSession = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: resolveDMSession');
    try {
        const { workspaceId, userId: otherUserId } = req.params;
        const currentUserId = req.user.sub;

        // Find existing DM session
        let dmSession = await DMSession.findOne({
            workspace: workspaceId,
            participants: {
                $all: [
                    new mongoose.Types.ObjectId(currentUserId),
                    new mongoose.Types.ObjectId(otherUserId)
                ],
                $size: 2
            }
        });

        // If not exist, create new DM session + conversation key
        if (!dmSession) {
            dmSession = await DMSession.create({
                workspace: workspaceId,
                participants: [currentUserId, otherUserId],
                createdAt: new Date()
            });

            // Create conversation key for DM (E2EE bootstrapping)
            await conversationKeysService.bootstrapConversationKey({
                conversationId: dmSession._id,
                conversationType: 'dm',
                workspaceId: workspaceId,
                members: [currentUserId, otherUserId]
            });

            console.log(`✅ [MESSAGES:MODULAR][RESOLVE_DM] Created new DM session ${dmSession._id} with keys`);
        } else {
            console.log(`✅ [MESSAGES:MODULAR][RESOLVE_DM] Found existing DM session ${dmSession._id}`);
        }

        return res.json({
            success: true,
            dmSessionId: dmSession._id,
            otherUserId: otherUserId,
            workspaceId: dmSession.workspace,
            participants: dmSession.participants
        });
    } catch (err) {
        console.error('[MESSAGES:MODULAR][RESOLVE_DM] ERROR:', err);
        return handleError(res, err, 'RESOLVE DM SESSION ERROR');
    }
};

// ==================== CHANNEL MESSAGES ====================

/**
 * Send a channel message
 * POST /api/messages/channel
 */
exports.sendChannelMessage = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: sendChannelMessage');
    try {
        const senderId = req.user.sub;
        const {
            channelId,
            attachments,
            replyTo,
            ciphertext,
            messageIv,
            isEncrypted,
            clientTempId
        } = req.body;

        // ============================================================
        // E2EE HARD ENFORCEMENT
        // ============================================================
        if (!ciphertext || !messageIv || !isEncrypted) {
            return res.status(400).json({
                message: 'E2EE required: ciphertext and messageIv must be provided'
            });
        }

        // Validation
        if (!channelId) {
            return res.status(400).json({ message: 'channelId required' });
        }

        // Find channel
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        // Verify membership
        if (!channel.isMember(senderId)) {
            return res.status(403).json({ message: 'Not a channel member' });
        }

        // Create message (E2EE enforced in service layer)
        const message = await messagesService.createMessage(
            {
                type: 'message',
                company: channel.company,
                workspace: channel.workspace,
                channel: channelId,
                sender: senderId,
                attachments,
                parentId: replyTo || null,
                ciphertext,
                messageIv,
                isEncrypted,
                clientTempId
            },
            req.io
        );

        return res.status(201).json({ message });
    } catch (err) {
        return handleError(res, err, 'SEND CHANNEL ERROR');
    }
};

/**
 * Get channel messages
 * GET /api/messages/channel/:channelId
 */
exports.getChannelMessages = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: getChannelMessages');
    try {
        const userId = req.user.sub;
        const { channelId } = req.params;
        const { limit, before } = req.query;

        // Find channel
        const channel = await Channel.findById(channelId);
        if (!channel) {
            return res.status(404).json({ message: 'Channel not found' });
        }

        // Verify membership
        const isUserMember = channel.isMember(userId);
        if (!isUserMember) {
            return res.status(403).json({ message: 'Not a channel member' });
        }

        // Get user's join date for privacy filtering
        const userJoinedAt = channel.getUserJoinDate(userId);

        // Fetch messages
        const result = await messagesService.fetchMessages(
            { channel: channelId },
            {
                limit: parseInt(limit) || 50,
                before,
                populateReplies: true,
                userJoinedAt,
                userId   // ← exclude messages hidden by this user
            }
        );

        // Get channel members for join markers
        const channelMembers = channel.members.map((m) => ({
            userId: m.user ? m.user.toString() : m.toString(),
            joinedAt: m.joinedAt || channel.createdAt
        }));

        // Populate member usernames
        const populatedMembers = await Promise.all(
            channelMembers.map(async (member) => {
                const user = await User.findById(member.userId).select('username');
                return {
                    ...member,
                    username: user?.username || 'Unknown'
                };
            })
        );

        return res.json({
            ...result,
            userJoinedAt,
            channelMembers: populatedMembers
        });
    } catch (err) {
        return handleError(res, err, 'GET CHANNEL ERROR');
    }
};

// ==================== MESSAGE ACTIONS ====================

/**
 * Forward a message to multiple targets (channels/DMs)
 * POST /api/messages/forward
 */
exports.forwardMessage = async (req, res) => {
    console.log('🔄 [MESSAGES:MODULAR] Function invoked: forwardMessage');
    try {
        const userId = req.user.sub;
        const { messageId, targets } = req.body;

        // Validation
        if (!messageId || !targets || !Array.isArray(targets) || targets.length === 0) {
            return res.status(400).json({
                message: 'messageId and targets array are required'
            });
        }

        // Find the original message
        const InternalMessage = require('../../../models/InternalMessage');
        const originalMessage = await InternalMessage.findById(messageId);

        if (!originalMessage) {
            return res.status(404).json({ message: 'Original message not found' });
        }

        // Verify user has access to the original message
        // Check if user is in the channel/DM where the message exists
        if (originalMessage.channel) {
            const channel = await Channel.findById(originalMessage.channel);
            if (!channel || !channel.isMember(userId)) {
                return res.status(403).json({ message: 'Not authorized to access this message' });
            }
        } else if (originalMessage.dm) {
            const dmSession = await DMSession.findById(originalMessage.dm);
            if (!dmSession || !dmSession.participants.some(p => String(p) === String(userId))) {
                return res.status(403).json({ message: 'Not authorized to access this message' });
            }
        }

        let forwardedCount = 0;
        const errors = [];

        // Forward to each target
        for (const target of targets) {
            try {
                const { type, id } = target;

                if (type === 'channel') {
                    // Verify user is a member of target channel
                    const channel = await Channel.findById(id);
                    if (!channel) {
                        errors.push({ target, error: 'Channel not found' });
                        continue;
                    }
                    if (!channel.isMember(userId)) {
                        errors.push({ target, error: 'Not a member of target channel' });
                        continue;
                    }

                    // Create forwarded message
                    await messagesService.createMessage({
                        type: 'message',
                        company: channel.company,
                        workspace: channel.workspace,
                        channel: id,
                        sender: userId,
                        ciphertext: originalMessage.ciphertext,
                        messageIv: originalMessage.messageIv,
                        isEncrypted: originalMessage.isEncrypted,
                        attachments: originalMessage.attachments || [],
                        forwardedFrom: messageId
                    }, req.io);

                    forwardedCount++;

                } else if (type === 'dm') {
                    // Verify user is a participant in target DM
                    const dmSession = await DMSession.findById(id);
                    if (!dmSession) {
                        errors.push({ target, error: 'DM session not found' });
                        continue;
                    }
                    if (!dmSession.participants.some(p => String(p) === String(userId))) {
                        errors.push({ target, error: 'Not a participant in target DM' });
                        continue;
                    }

                    // Create forwarded message
                    await messagesService.createMessage({
                        type: 'message',
                        company: dmSession.company,
                        workspace: dmSession.workspace,
                        dm: id,
                        sender: userId,
                        ciphertext: originalMessage.ciphertext,
                        messageIv: originalMessage.messageIv,
                        isEncrypted: originalMessage.isEncrypted,
                        attachments: originalMessage.attachments || [],
                        forwardedFrom: messageId
                    }, req.io);

                    forwardedCount++;
                } else {
                    errors.push({ target, error: 'Invalid target type (must be channel or dm)' });
                }
            } catch (targetError) {
                console.error(`Error forwarding to ${target.type}:${target.id}:`, targetError);
                errors.push({ target, error: targetError.message });
            }
        }

        return res.json({
            success: true,
            forwardedCount,
            totalTargets: targets.length,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        return handleError(res, err, 'FORWARD MESSAGE ERROR');
    }
};

// ==================== MESSAGE MUTATIONS ====================

/**
 * Edit a message
 * PATCH /api/v2/messages/:messageId
 * Body: { text } (plaintext) OR { ciphertext, messageIv } (E2EE)
 */
exports.editMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const { text, ciphertext, messageIv } = req.body;

        // Accept either plaintext edit or E2EE payload
        const newText = text || ciphertext || null;
        if (!newText) {
            return res.status(400).json({ message: 'text or ciphertext is required' });
        }

        const io = req.app?.get('io');
        const message = await messagesService.editMessage(messageId, userId, newText, io);

        return res.json({ message });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message || 'Server error' });
    }
};

/**
 * Soft-delete a message
 * DELETE /api/v2/messages/:messageId
 */
exports.deleteMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const { scope = 'everyone' } = req.body;
        const io = req.app?.get('io');
        // The requester's socket id (needed for personal 'message:hidden' emit)
        const socketId = req.headers['x-socket-id'] || null;

        await messagesService.deleteMessage(messageId, userId, io, scope, socketId);

        return res.json({ success: true, messageId, scope });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message || 'Server error' });
    }
};

/**
 * Add a reaction
 * POST /api/v2/messages/:messageId/react
 * Body: { emoji }
 */
exports.addReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const { emoji } = req.body;

        console.log(`[REACT] Adding reaction: messageId=${messageId} userId=${userId} emoji=${JSON.stringify(emoji)}`);

        if (!emoji) {
            return res.status(400).json({ message: 'emoji is required' });
        }

        // Guard: reject anything that looks like a MongoDB ObjectId (24 hex characters)
        // This means the client accidentally sent a message/user ID instead of an emoji
        if (/^[0-9a-f]{24}$/i.test(emoji)) {
            console.error(`[REACT] ❌ Rejected invalid emoji (looks like ObjectId): ${emoji}`);
            return res.status(400).json({ message: 'Invalid emoji: received an ID instead of emoji character' });
        }

        const io = req.app?.get('io');
        const message = await messagesService.addReaction(messageId, userId, emoji, io);

        return res.json({ message });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message || 'Server error' });
    }
};

/**
 * Remove a reaction
 * DELETE /api/v2/messages/:messageId/react
 * Body: { emoji }
 */
exports.removeReaction = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const { emoji } = req.body;

        if (!emoji) {
            return res.status(400).json({ message: 'emoji is required' });
        }

        const io = req.app?.get('io');
        const message = await messagesService.removeReaction(messageId, userId, emoji, io);

        return res.json({ message });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message || 'Server error' });
    }
};

/**
 * Pin or unpin a message
 * POST /api/v2/messages/:messageId/pin
 * Body: { pin: true|false }
 */
exports.pinMessage = async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.user.sub;
        const { pin = true } = req.body;

        const Message = require('../../features/messages/message.model');
        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        message.isPinned = pin;
        message.pinnedBy = pin ? userId : null;
        message.pinnedAt = pin ? new Date() : null;
        await message.save();

        const io = req.app?.get('io');
        if (io) {
            const room = message.channel
                ? `channel:${message.channel}`
                : `dm:${message.dm}`;
            io.to(room).emit(pin ? 'message-pinned' : 'message-unpinned', {
                messageId,
                pinnedBy: userId,
                pinnedAt: message.pinnedAt
            });
        }

        return res.json({ message });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};
