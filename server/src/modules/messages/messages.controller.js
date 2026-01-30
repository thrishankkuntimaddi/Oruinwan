// server/src/modules/messages/messages.controller.js
/**
 * Messages Controller - HTTP Request Handler
 * Handles all message-related HTTP endpoints
 * 
 * @module messages/controller
 */

const messagesService = require('./messages.service');
const Channel = require('../../../models/Channel');
const User = require('../../../models/User');
const DMSession = require('../../../models/DMSession');
const { handleError } = require('../../../utils/responseHelpers');

// ==================== DIRECT MESSAGES ====================

/**
 * Send a direct message
 * POST /api/messages/direct
 */
exports.sendDirectMessage = async (req, res) => {
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
                populateReplies: true
            }
        );

        return res.json(result);
    } catch (err) {
        return handleError(res, err, 'GET DMs ERROR');
    }
};

/**
 * Get all DM sessions for user in workspace
 * GET /api/messages/workspace/:workspaceId/dms
 */
exports.getWorkspaceDMList = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId } = req.params;

        const sessions = await messagesService.getUserDMSessions(userId, workspaceId);

        return res.json({ sessions });
    } catch (err) {
        return handleError(res, err, 'GET WORKSPACE DM LIST ERROR');
    }
};

// ==================== CHANNEL MESSAGES ====================

/**
 * Send a channel message
 * POST /api/messages/channel
 */
exports.sendChannelMessage = async (req, res) => {
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
                userJoinedAt
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
