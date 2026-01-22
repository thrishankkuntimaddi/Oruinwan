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

        // Validation
        if (!receiverId) {
            return res.status(400).json({ message: 'receiverId required' });
        }
        if (!workspaceId) {
            return res.status(400).json({ message: 'workspaceId required' });
        }

        // Verify receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json({ message: 'Receiver not found' });
        }

        // Find or create DM session
        const dmSession = await messagesService.findOrCreateDMSession(
            senderId,
            receiverId,
            workspaceId
        );

        // Create message (E2EE enforced in service layer)
        const message = await messagesService.createMessage(
            {
                type: 'message',
                company: dmSession.company,
                workspace: workspaceId,
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

        // Support both parameter names for backward compatibility
        const sessionId = dmSessionId || dmId;

        // Validate DM session
        const dmSession = await DMSession.findById(sessionId);
        if (!dmSession) {
            return res.status(404).json({ message: 'DM Session not found' });
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
            { dm: sessionId },
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
