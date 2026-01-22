/**
 * Conversation Keys Controller
 * 
 * HTTP endpoints for conversation key management
 */

const conversationKeysService = require('./conversationKeys.service');
const { handleError } = require('../../../utils/responseHelpers');

// ==================== STORE CONVERSATION KEYS ====================

/**
 * Store encrypted conversation keys
 * POST /api/v2/conversations/:id/keys
 * 
 * Body: {
 *   conversationType: 'channel' | 'dm',
 *   workspaceId: string,
 *   encryptedKeys: [{userId, encryptedKey, ephemeralPublicKey?, algorithm}]
 * }
 */
exports.storeConversationKeys = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const { conversationType, workspaceId, encryptedKeys } = req.body;
        const createdBy = req.user.sub;

        // Validation
        if (!conversationType || !['channel', 'dm'].includes(conversationType)) {
            return res.status(400).json({
                message: 'Invalid conversationType. Must be "channel" or "dm"'
            });
        }

        if (!workspaceId) {
            return res.status(400).json({
                message: 'workspaceId is required'
            });
        }

        if (!Array.isArray(encryptedKeys) || encryptedKeys.length === 0) {
            return res.status(400).json({
                message: 'encryptedKeys array is required and must not be empty'
            });
        }

        // Validate each encrypted key
        for (const ek of encryptedKeys) {
            if (!ek.userId || !ek.encryptedKey || !ek.algorithm) {
                return res.status(400).json({
                    message: 'Each encryptedKey must have userId, encryptedKey, and algorithm'
                });
            }
        }

        // Store keys
        const conversationKey = await conversationKeysService.storeConversationKeys({
            conversationId,
            conversationType,
            workspaceId,
            createdBy,
            encryptedKeys
        });

        return res.status(201).json({
            message: 'Conversation keys stored successfully',
            conversationId: conversationKey.conversationId,
            participantCount: conversationKey.encryptedKeys.length
        });
    } catch (err) {
        // 🔒 SAFEGUARD #1: Return 409 for duplicate key attempts
        if (err.message === 'Conversation keys already exist. Use addParticipant to add new users.') {
            return res.status(409).json({
                message: 'Conversation keys already exist',
                error: 'KEY_EXISTS',
                conversationId: req.params.id,
                conversationType: req.body.conversationType
                // ⚠️ Security: Do NOT return existingKey here
                // Client must fetch via normal GET endpoint
            });
        }

        return handleError(res, err, 'STORE CONVERSATION KEYS ERROR');
    }
};

// ==================== GET CONVERSATION KEYS ====================

/**
 * Get user's encrypted key for a conversation
 * GET /api/v2/conversations/:id/keys?type=channel|dm
 */
exports.getConversationKey = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const { type: conversationType } = req.query;
        const userId = req.user.sub;

        if (!conversationType || !['channel', 'dm'].includes(conversationType)) {
            return res.status(400).json({
                message: 'Query parameter "type" is required (channel or dm)'
            });
        }

        const encryptedKeyData = await conversationKeysService.getUserConversationKey(
            conversationId,
            conversationType,
            userId
        );

        if (!encryptedKeyData) {
            return res.status(404).json({
                message: 'Conversation keys not found'
            });
        }

        return res.json(encryptedKeyData);
    } catch (err) {
        return handleError(res, err, 'GET CONVERSATION KEY ERROR');
    }
};

// ==================== GET USER'S WORKSPACE KEYS ====================

/**
 * Get all conversation keys user has access to in workspace
 * GET /api/v2/conversations/workspace/:workspaceId/keys
 */
exports.getUserWorkspaceKeys = async (req, res) => {
    try {
        const { workspaceId } = req.params;
        const userId = req.user.sub;

        const conversationKeys = await conversationKeysService.getUserWorkspaceConversationKeys(
            userId,
            workspaceId
        );

        return res.json({
            workspaceId,
            conversationKeys,
            count: conversationKeys.length
        });
    } catch (err) {
        return handleError(res, err, 'GET WORKSPACE KEYS ERROR');
    }
};

// ==================== ADD PARTICIPANT ====================

/**
 * Add participant to conversation (client encrypts key for them)
 * POST /api/v2/conversations/:id/keys/add-user
 * 
 * Body: {
 *   conversationType: 'channel' | 'dm',
 *   userId: string,
 *   encryptedKey: string,
 *   ephemeralPublicKey?: string,
 *   algorithm: 'X25519' | 'RSA-2048'
 * }
 */
exports.addParticipant = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const { conversationType, userId, encryptedKey, ephemeralPublicKey, algorithm } = req.body;

        // Validation
        if (!conversationType || !['channel', 'dm'].includes(conversationType)) {
            return res.status(400).json({
                message: 'Invalid conversationType'
            });
        }

        if (!userId || !encryptedKey || !algorithm) {
            return res.status(400).json({
                message: 'userId, encryptedKey, and algorithm are required'
            });
        }

        await conversationKeysService.addParticipant(
            conversationId,
            conversationType,
            userId,
            encryptedKey,
            ephemeralPublicKey,
            algorithm
        );

        return res.status(200).json({
            message: 'Participant added successfully'
        });
    } catch (err) {
        return handleError(res, err, 'ADD PARTICIPANT ERROR');
    }
};

// ==================== REMOVE PARTICIPANT ====================

/**
 * Remove participant from conversation
 * DELETE /api/v2/conversations/:id/keys/user/:userId?type=channel|dm
 */
exports.removeParticipant = async (req, res) => {
    try {
        const { id: conversationId, userId } = req.params;
        const { type: conversationType } = req.query;

        if (!conversationType || !['channel', 'dm'].includes(conversationType)) {
            return res.status(400).json({
                message: 'Query parameter "type" is required (channel or dm)'
            });
        }

        const removed = await conversationKeysService.removeParticipant(
            conversationId,
            conversationType,
            userId
        );

        if (removed) {
            return res.json({
                message: 'Participant removed successfully'
            });
        } else {
            return res.status(404).json({
                message: 'Participant not found in conversation'
            });
        }
    } catch (err) {
        return handleError(res, err, 'REMOVE PARTICIPANT ERROR');
    }
};

// ==================== CHECK KEY EXISTS ====================

/**
 * Check if conversation has encryption keys
 * GET /api/v2/conversations/:id/keys/exists?type=channel|dm
 */
exports.checkKeysExist = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const { type: conversationType } = req.query;

        if (!conversationType || !['channel', 'dm'].includes(conversationType)) {
            return res.status(400).json({
                message: 'Query parameter "type" is required (channel or dm)'
            });
        }

        const exists = await conversationKeysService.hasConversationKeys(
            conversationId,
            conversationType
        );

        return res.json({
            exists
        });
    } catch (err) {
        return handleError(res, err, 'CHECK KEYS EXIST ERROR');
    }
};
