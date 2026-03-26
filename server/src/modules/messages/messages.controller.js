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
            clientTempId,
            mentionText = '',   // plaintext for mention parsing (never stored as content)
            // Phase-7 fields
            type = 'message',
            poll = null,
            contact = null,
            meeting = null,
            linkPreview = null,
        } = req.body;

        // ============================================================
        // E2EE HARD ENFORCEMENT — bypassed for structured message types
        // ============================================================
        const STRUCTURED_TYPES_DM = ['image', 'video', 'file', 'voice', 'poll', 'contact', 'meeting'];
        if (!STRUCTURED_TYPES_DM.includes(type) && (!ciphertext || !messageIv || !isEncrypted)) {
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

        // Create message (E2EE enforced in service layer for type='message')
        const message = await messagesService.createMessage(
            {
                type,
                company: dmSession.company,
                workspace: dmSession.workspace,
                dm: dmSession._id,
                sender: senderId,
                attachments,
                parentId: replyTo || null,
                quotedMessageId: req.body.quotedMessageId || null,
                ciphertext,
                messageIv,
                isEncrypted,
                clientTempId,
                mentionText,
                // Phase-7
                poll,
                contact,
                meeting,
                linkPreview,
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

        // ✅ FIX: Fetch workspace to carry company into DMSession
        // Without company, messages created via this DM have undefined company field
        const Workspace = require('../../../models/Workspace');
        const workspace = await Workspace.findById(workspaceId).select('company members').lean();

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        // Verify both users are workspace members
        const memberIds = workspace.members.map(m => String(m.user || m));
        if (!memberIds.includes(String(currentUserId))) {
            return res.status(403).json({ message: 'You are not a member of this workspace' });
        }
        if (!memberIds.includes(String(otherUserId))) {
            return res.status(403).json({ message: 'Target user is not a member of this workspace' });
        }

        // Sort participants so [A,B] === [B,A] for consistent index matching
        const sortedParticipants = [
            new mongoose.Types.ObjectId(currentUserId),
            new mongoose.Types.ObjectId(otherUserId)
        ].sort((a, b) => a.toString().localeCompare(b.toString()));

        // Find existing DM session
        let dmSession = await DMSession.findOne({
            workspace: workspaceId,
            participants: {
                $all: sortedParticipants,
                $size: 2
            }
        });

        let isNewSession = false;

        // If not exist, create new DM session safely
        if (!dmSession) {
            try {
                dmSession = await DMSession.create({
                    workspace: workspaceId,
                    company: workspace.company || null,
                    participants: sortedParticipants,
                    createdAt: new Date()
                });
                isNewSession = true;
            } catch (createErr) {
                // Race condition: another request just created the session — fetch it
                if (createErr.code === 11000) {
                    dmSession = await DMSession.findOne({
                        workspace: workspaceId,
                        participants: { $all: sortedParticipants, $size: 2 }
                    });
                    if (!dmSession) throw createErr; // genuine error, re-throw
                    isNewSession = false;
                } else {
                    throw createErr;
                }
            }
        }

        // Bootstrap E2EE keys ONLY for newly created sessions
        // (idempotent: bootstrapConversationKey skips if key already exists)
        if (isNewSession) {
            try {
                await conversationKeysService.bootstrapConversationKey({
                    conversationId: dmSession._id,
                    conversationType: 'dm',
                    workspaceId: workspaceId,
                    members: [String(currentUserId), String(otherUserId)]
                });
                console.log(`✅ [MESSAGES:MODULAR][RESOLVE_DM] Created new DM session ${dmSession._id} with keys`);
            } catch (keyErr) {
                // Non-blocking: session exists even if key bootstrap fails
                // Client will retry key fetch when opening the chat
                console.error(`⚠️ [MESSAGES:MODULAR][RESOLVE_DM] Key bootstrap failed (non-fatal):`, keyErr.message);
            }
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
            replyTo,          // ← legacy: thread reply (parentId)
            quotedMessageId,  // ← new: WhatsApp-style inline reply (NOT parentId)
            ciphertext,
            messageIv,
            isEncrypted,
            clientTempId,
            mentionText = '',   // plaintext for mention parsing (never stored as content)
            // Phase-7 fields
            type = 'message',
            poll = null,
            contact = null,
            meeting = null,
            linkPreview = null,
        } = req.body;

        // ============================================================
        // E2EE HARD ENFORCEMENT — bypassed for structured message types
        // ============================================================
        const STRUCTURED_TYPES_CH = ['image', 'video', 'file', 'voice', 'poll', 'contact', 'meeting'];
        if (!STRUCTURED_TYPES_CH.includes(type) && (!ciphertext || !messageIv || !isEncrypted)) {
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

        // Create message (E2EE enforced in service layer for type='message')
        const message = await messagesService.createMessage(
            {
                type,
                company: channel.company,
                workspace: channel.workspace,
                channel: channelId,
                sender: senderId,
                attachments,
                parentId: replyTo || null,
                quotedMessageId: quotedMessageId || null,
                ciphertext,
                messageIv,
                isEncrypted,
                clientTempId,
                mentionText,
                // Phase-7
                poll,
                contact,
                meeting,
                linkPreview,
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
        const Message = require('../../features/messages/message.model');
        const originalMessage = await Message.findById(messageId);

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

                    // Create forwarded message — re-use original encrypted payload from source
                    const srcCiphertext = originalMessage.payload?.ciphertext || originalMessage.ciphertext;
                    const srcMessageIv = originalMessage.payload?.messageIv || originalMessage.messageIv;

                    await messagesService.createMessage({
                        type: 'message',
                        company: channel.company,
                        workspace: channel.workspace,
                        channel: id,
                        sender: userId,
                        ciphertext: srcCiphertext,
                        messageIv: srcMessageIv,
                        isEncrypted: true,
                        attachments: originalMessage.payload?.attachments || originalMessage.attachments || [],
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

                    // Create forwarded message — re-use original encrypted payload from source
                    const srcCiphertext = originalMessage.payload?.ciphertext || originalMessage.ciphertext;
                    const srcMessageIv = originalMessage.payload?.messageIv || originalMessage.messageIv;

                    await messagesService.createMessage({
                        type: 'message',
                        company: dmSession.company,
                        workspace: dmSession.workspace,
                        dm: id,
                        sender: userId,
                        ciphertext: srcCiphertext,
                        messageIv: srcMessageIv,
                        isEncrypted: true,
                        attachments: originalMessage.payload?.attachments || originalMessage.attachments || [],
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

        if (!text && !ciphertext) {
            return res.status(400).json({ message: 'text or ciphertext is required' });
        }

        const io = req.app?.get('io');
        const message = await messagesService.editMessage(
            messageId,
            userId,
            { text, ciphertext, messageIv },
            io
        );

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

        // Permission: sender OR channel admin can pin/unpin
        // In DMs: any participant can pin any message
        const isSender = String(message.sender) === String(userId);
        let isChannelAdmin = false;
        let isDMParticipant = false;

        if (message.dm) {
            // DM context — any participant may pin
            const DMSession = require('../../../models/DMSession');
            const dmSession = await DMSession.findById(message.dm).select('participants').lean();
            if (dmSession) {
                isDMParticipant = dmSession.participants.some(p => String(p) === String(userId));
            }
        } else if (message.channel) {
            // Channel context — any channel member may pin/unpin
            const Channel = require('../../features/channels/channel.model');
            const channel = await Channel.findById(message.channel).select('members admins createdBy isDefault').lean();
            if (channel) {
                isChannelAdmin = channel.isDefault || // default (general) channel — everyone implicitly
                    (channel.members || []).some(m => {
                        const memberId = m.user?.toString() || m.toString();
                        return memberId === userId.toString();
                    }) ||
                    (channel.admins || []).map(id => id.toString()).includes(userId.toString()) ||
                    channel.createdBy?.toString() === userId.toString();
            }
        }

        if (!isSender && !isChannelAdmin && !isDMParticipant) {
            return res.status(403).json({ message: 'You must be a channel member to pin messages' });
        }

        message.isPinned = pin;
        message.pinnedBy = pin ? userId : null;
        message.pinnedAt = pin ? new Date() : null;
        await message.save();

        const io = req.app?.get('io');

        // Emit pin/unpin socket event for instant UI update (channel OR DM)
        if (io) {
            const pinRoom = message.channel
                ? `channel:${message.channel}`
                : `dm:${message.dm}`;

            // ✅ FIX: Fetch pinner name for display in both channels and DMs
            let pinnedByName = null;
            try {
                const User = require('../../../models/User');
                const pinner = await User.findById(userId).select('username').lean();
                pinnedByName = pinner?.username || null;
            } catch (_e) { /* non-fatal */ }

            io.to(pinRoom).emit(pin ? 'message-pinned' : 'message-unpinned', {
                messageId,
                pinnedBy: userId,
                pinnedByName,
                pinnedAt: message.pinnedAt
            });
        }

        // ── System message: "Alice pinned / unpinned a message" ──────────
        if (message.channel) {
            // Channel pin system event
            try {
                const User = require('../../../models/User');
                const pinner = await User.findById(userId).select('username').lean();

                // Short snippet of the pinned message for context
                const snippet = message.payload?.text || message.text || message.decryptedContent || '';
                const messageSnippet = snippet.length > 60 ? snippet.slice(0, 57) + '…' : snippet;

                const systemMsg = await Message.create({
                    type: 'system',
                    systemEvent: pin ? 'message_pinned' : 'message_unpinned',
                    sender: userId,
                    channel: message.channel,
                    workspace: message.workspace,
                    systemData: {
                        userId,
                        userName: pinner?.username || 'Someone',
                        messageSnippet,
                        pinnedMessageId: messageId,
                    },
                });
                if (io) io.to(`channel:${message.channel}`).emit('new-message', systemMsg);
            } catch (sysErr) {
                console.error('[SYSTEM MSG] pin system message failed:', sysErr);
            }
        } else if (message.dm) {
            // ✅ DM pin system event — shows a pill like "Alice pinned a message"
            try {
                const User = require('../../../models/User');
                const pinner = await User.findById(userId).select('username').lean();

                const snippet = message.payload?.text || message.text || '';
                const messageSnippet = snippet.length > 60 ? snippet.slice(0, 57) + '…' : snippet;

                const systemMsg = await Message.create({
                    type: 'system',
                    systemEvent: pin ? 'dm_message_pinned' : 'dm_message_unpinned',
                    sender: userId,
                    dm: message.dm,
                    workspace: message.workspace,
                    systemData: {
                        userId,
                        userName: pinnedByName || pinner?.username || 'Someone',
                        messageSnippet,
                        pinnedMessageId: messageId,
                    },
                });
                if (io) io.to(`dm:${message.dm}`).emit('new-message', systemMsg);
            } catch (sysErr) {
                console.error('[SYSTEM MSG] DM pin system message failed:', sysErr);
            }
        }
        // ─────────────────────────────────────────────────────────────────

        return res.json({ message });
    } catch (err) {
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

// ==================== POLL MESSAGES (Phase 7.3) ====================

/**
 * Create a poll-as-message
 * POST /api/v2/messages/poll
 * Body: { channelId, poll: { question, options[], allowMultiple, anonymous, endDate } }
 *
 * Polls are embedded inside the Message document (type:'poll').
 * E2EE is bypassed because poll data is structured, not a text payload.
 */
exports.createPollMessage = async (req, res) => {
    try {
        const senderId = req.user.sub;
        const { channelId, dmId, poll } = req.body;

        // — Validate inputs —
        if (!channelId && !dmId) {
            return res.status(400).json({ message: 'channelId or dmId is required' });
        }
        if (!poll || !poll.question || !Array.isArray(poll.options) || poll.options.length < 2) {
            return res.status(400).json({ message: 'poll.question and at least 2 options are required' });
        }
        if (poll.options.length > 10) {
            return res.status(400).json({ message: 'Maximum 10 poll options allowed' });
        }

        // — Build embedded poll subdoc —
        const pollDoc = {
            question: poll.question.trim(),
            options: poll.options.map(opt => ({
                text: (typeof opt === 'string' ? opt : opt.text).trim(),
                votes: [],
            })),
            allowMultiple: poll.allowMultiple || false,
            anonymous: poll.anonymous || false,
            createdBy: senderId,
            endDate: poll.endDate || null,
            isActive: true,
            totalVotes: 0,
        };

        let messagePayload;

        if (channelId) {
            // — Channel poll: membership check —
            const channel = await Channel.findById(channelId);
            if (!channel) return res.status(404).json({ message: 'Channel not found' });
            if (!channel.isMember(senderId)) {
                return res.status(403).json({ message: 'Not a channel member' });
            }

            messagePayload = {
                type: 'poll',
                company: channel.company,
                workspace: channel.workspace,
                channel: channelId,
                sender: senderId,
                poll: pollDoc,
            };
        } else {
            // — DM poll: participant check —
            const DMSession = require('../../../models/DMSession');
            const dmSession = await DMSession.findById(dmId).select('participants workspace company').lean();
            if (!dmSession) return res.status(404).json({ message: 'DM session not found' });

            const isParticipant = dmSession.participants.some(p => String(p) === String(senderId));
            if (!isParticipant) {
                return res.status(403).json({ message: 'Not a participant in this DM' });
            }

            messagePayload = {
                type: 'poll',
                company: dmSession.company || null,
                workspace: dmSession.workspace,
                dm: dmId,
                sender: senderId,
                poll: pollDoc,
            };
        }

        // — createMessage bypasses E2EE for type !== 'message' —
        const message = await messagesService.createMessage(messagePayload, req.io);

        return res.status(201).json({ message });
    } catch (err) {
        return handleError(res, err, 'CREATE POLL MESSAGE ERROR');
    }
};


/**
 * Vote on an embedded poll
 * POST /api/v2/messages/:messageId/vote
 * Body: { optionIndices: [0, 2] }  ← zero-based indices
 *
 * Atomically:
 *   1. Remove voter's previous votes from all options
 *   2. Add their vote to selected options
 *   3. Recount totalVotes (unique voters)
 *   4. Emit poll:vote_updated to the channel room
 */
exports.voteOnPoll = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { messageId } = req.params;
        const { optionIndices } = req.body; // array of zero-based indices

        // — Validate —
        // optionIndices must be an array; empty array = remove vote (allowed)
        if (!Array.isArray(optionIndices)) {
            return res.status(400).json({ message: 'optionIndices must be an array' });
        }

        const Message = require('../../features/messages/message.model');
        const message = await Message.findById(messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });
        if (message.type !== 'poll') {
            return res.status(400).json({ message: 'Message is not a poll' });
        }

        const poll = message.poll;
        if (!poll || !poll.isActive) {
            return res.status(400).json({ message: 'Poll is closed or not found' });
        }

        // — Channel membership check —
        if (message.channel) {
            const channel = await Channel.findById(message.channel);
            if (!channel || !channel.isMember(userId)) {
                return res.status(403).json({ message: 'Not a channel member' });
            }
        }

        // — Validate indices (only when non-empty) —
        if (optionIndices.length > 0 && optionIndices.some(i => i < 0 || i >= poll.options.length)) {
            return res.status(400).json({ message: 'Invalid option index' });
        }

        // — Single-choice enforcement —
        if (!poll.allowMultiple && optionIndices.length > 1) {
            return res.status(400).json({ message: 'This poll only allows one selection' });
        }


        // — Remove previous votes from all options —
        const userIdStr = userId.toString();
        poll.options.forEach(opt => {
            opt.votes = opt.votes.filter(v => v.toString() !== userIdStr);
        });

        // — Add new votes —
        optionIndices.forEach(idx => {
            const opt = poll.options[idx];
            if (opt && !opt.votes.some(v => v.toString() === userIdStr)) {
                opt.votes.push(userId);
            }
        });

        // — Recount total unique voters —
        const allVoters = new Set();
        poll.options.forEach(opt => opt.votes.forEach(v => allVoters.add(v.toString())));
        poll.totalVotes = allVoters.size;

        // Mongoose doesn't detect sub-array mutations automatically
        message.markModified('poll');
        await message.save();

        // — Enrich with voter names (best-effort — vote is already saved above) —
        let pollWithVoterNames;
        try {
            await message.populate('sender', 'username profilePicture');
            const User = require('../../../models/User');
            const allVoterIds = new Set();
            message.poll.options.forEach(opt => opt.votes.forEach(v => allVoterIds.add(v.toString())));
            const voterDocs = allVoterIds.size > 0
                ? await User.find({ _id: { $in: [...allVoterIds] } }).select('_id username').lean()
                : [];
            const voterMap = {};
            voterDocs.forEach(u => { voterMap[u._id.toString()] = u.username; });
            pollWithVoterNames = {
                ...message.poll.toObject(),
                options: message.poll.options.map(opt => ({
                    ...opt.toObject(),
                    votes: opt.votes.map(v => ({
                        _id: v.toString(),
                        username: voterMap[v.toString()] || '?'
                    }))
                }))
            };
        } catch (enrichErr) {
            console.warn('[voteOnPoll] Voter name enrichment failed (vote saved OK):', enrichErr.message);
            pollWithVoterNames = message.poll.toObject();
        }

        // — Socket: broadcast vote update to channel room —
        const io = req.io || req.app?.get('io');
        if (io && message.channel) {
            io.to(`channel:${message.channel}`).emit('poll:vote_updated', {
                messageId: message._id,
                poll: pollWithVoterNames,
            });
        }

        return res.json({ message: { ...message.toObject(), poll: pollWithVoterNames } });
    } catch (err) {
        return handleError(res, err, 'VOTE ON POLL ERROR');
    }
};


/**
 * Get full message info: readBy list, members, reactions
 * GET /api/v2/messages/:messageId/info
 */
exports.getMessageInfo = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { messageId } = req.params;

        const Message = require('../../features/messages/message.model');
        const Workspace = require('../../../models/Workspace');

        // Fetch message with populated readBy users
        const message = await Message.findById(messageId)
            .populate('sender', 'username profilePicture')
            .populate('readBy', 'username profilePicture')
            .lean();

        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        let channelMembers = [];

        if (message.channel) {
            const channel = await Channel.findById(message.channel)
                .populate('members.user', 'username profilePicture')
                .lean();

            if (!channel) return res.status(404).json({ message: 'Channel not found' });

            // Auth check (lean object — use manual check)
            const isMember = channel.isDefault || channel.members?.some(m =>
                String(m.user?._id || m.user) === String(userId)
            );
            if (!isMember) return res.status(403).json({ message: 'Not authorized' });

            // If default channel, members array may be empty → fetch all workspace members
            if (channel.isDefault && (!channel.members || channel.members.length === 0)) {
                const workspace = await Workspace.findById(channel.workspace)
                    .populate('members.user', 'username profilePicture')
                    .lean();
                channelMembers = (workspace?.members || []).map(m => ({
                    _id: String(m.user?._id || m.user),
                    username: m.user?.username || 'Unknown',
                    profilePicture: m.user?.profilePicture || null
                }));
            } else {
                channelMembers = (channel.members || []).map(m => ({
                    _id: String(m.user?._id || m.user),
                    username: m.user?.username || 'Unknown',
                    profilePicture: m.user?.profilePicture || null
                }));
            }

        } else if (message.dm) {
            const dmSession = await DMSession.findById(message.dm)
                .populate('participants', 'username profilePicture')
                .lean();
            const isParticipant = dmSession?.participants?.some(
                p => String(p._id || p) === String(userId)
            );
            if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });
            channelMembers = (dmSession?.participants || []).map(p => ({
                _id: String(p._id || p),
                username: p.username || 'Unknown',
                profilePicture: p.profilePicture || null
            }));
        }

        // Normalize readBy
        const readByIds = new Set(
            (message.readBy || []).map(u => String(u._id || u))
        );

        console.log(`[MESSAGE INFO] msgId=${messageId} members=${channelMembers.length} readBy=${readByIds.size}`);

        return res.json({
            message: {
                _id: message._id,
                text: message.text,
                isEncrypted: !!(message.payload?.ciphertext || message.isEncrypted),
                payload: message.payload,
                createdAt: message.createdAt,
                sender: message.sender,
                reactions: message.reactions || [],
                readBy: [...readByIds]
            },
            members: channelMembers,
            readBy: [...readByIds]
        });

    } catch (err) {
        return handleError(res, err, 'GET MESSAGE INFO ERROR');
    }
};

// ===========================================================================
// PHASE-8: REMINDERS
// ===========================================================================

const reminderService = require('../../features/messages/reminder.service');

/**
 * POST /api/v2/messages/:messageId/reminder
 * Body: { remindAt: ISO-string, note?: string }
 */
exports.scheduleReminder = async (req, res) => {
    try {
        const userId     = req.user.sub;
        const { messageId } = req.params;
        const { remindAt, note = '' } = req.body;

        if (!remindAt) return res.status(400).json({ message: 'remindAt is required' });

        const reminder = await reminderService.scheduleReminder(userId, messageId, remindAt, note);
        return res.status(201).json({ success: true, reminder });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

/**
 * GET /api/v2/messages/reminders
 * Returns pending reminders for the authenticated user.
 */
exports.getUserReminders = async (req, res) => {
    try {
        const userId = req.user.sub;
        const reminders = await reminderService.getUserReminders(userId);
        return res.json({ reminders });
    } catch (err) {
        return handleError(res, err, 'GET REMINDERS ERROR');
    }
};

/**
 * DELETE /api/v2/messages/reminders/:reminderId
 */
exports.cancelReminder = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { reminderId } = req.params;
        await reminderService.cancelReminder(reminderId, userId);
        return res.json({ success: true });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

// ===========================================================================
// PHASE-8: CHECKLIST TOGGLE
// ===========================================================================

/**
 * POST /api/v2/messages/:messageId/checklist/:itemIdx
 */
exports.checklistToggle = async (req, res) => {
    try {
        const userId     = req.user.sub;
        const { messageId, itemIdx } = req.params;
        const io = req.app?.get('io');

        const checklist = await messagesService.checklistToggle(
            messageId,
            parseInt(itemIdx, 10),
            userId,
            io
        );
        return res.json({ checklist });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

// ===========================================================================
// PHASE-8: MESSAGE DIFF (edit history)
// ===========================================================================

/**
 * GET /api/v2/messages/:messageId/diff
 */
exports.getMessageDiff = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { messageId } = req.params;
        const diff = await messagesService.getMessageDiff(messageId, userId);
        return res.json(diff);
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

// ===========================================================================
// PHASE-8: CONVERT MESSAGE → TASK
// ===========================================================================

/**
 * POST /api/v2/messages/:messageId/convert-task
 * Body: { title?, description?, dueDate?, priority?, workspaceId?, projectId? }
 */
exports.convertToTask = async (req, res) => {
    try {
        const userId     = req.user.sub;
        const { messageId } = req.params;
        const taskData   = req.body || {};
        const io = req.app?.get('io');

        const task = await messagesService.convertToTask(messageId, userId, taskData, io);
        return res.status(201).json({ task });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({ message: err.message });
    }
};

// ===========================================================================
// PHASE-8: AI MESSAGING — Smart Replies, Translation, Thread Summary
// ===========================================================================

const aiMessagingService = require('../../modules/ai/ai-messaging.service');

/**
 * POST /api/v2/messages/ai/suggestions
 * Body: { messageText, messageId?, contextMessages? }
 */
exports.getSmartReplies = async (req, res) => {
    try {
        const { messageText, messageId, contextMessages = [] } = req.body;
        if (!messageText) return res.status(400).json({ message: 'messageText is required' });

        const suggestions = await aiMessagingService.getSmartReplies(
            messageText,
            messageId || null,
            contextMessages
        );
        return res.json({ suggestions });
    } catch (err) {
        return res.status(500).json({ message: 'AI suggestions unavailable', error: err.message });
    }
};

/**
 * POST /api/v2/messages/ai/translate
 * Body: { text, targetLang, messageId? }
 */
exports.translateMessage = async (req, res) => {
    try {
        const { text, targetLang, messageId } = req.body;
        if (!text || !targetLang) {
            return res.status(400).json({ message: 'text and targetLang are required' });
        }
        const result = await aiMessagingService.translateMessage(text, targetLang, messageId);
        return res.json(result);
    } catch (err) {
        return res.status(500).json({ message: 'Translation unavailable', error: err.message });
    }
};

/**
 * POST /api/v2/messages/ai/thread-summary
 * Body: { parentMessageId, replies: [{ text, senderName }], parentText? }
 */
exports.getThreadSummary = async (req, res) => {
    try {
        const { parentMessageId, replies = [], parentText = '' } = req.body;
        if (!parentMessageId) return res.status(400).json({ message: 'parentMessageId is required' });

        const summary = await aiMessagingService.summarizeThread(
            parentMessageId,
            replies,
            parentText
        );
        return res.json({ summary });
    } catch (err) {
        return res.status(500).json({ message: 'Thread summary unavailable', error: err.message });
    }
};
