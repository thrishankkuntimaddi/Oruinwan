/**
 * Identity Controller
 * 
 * HTTP endpoints for identity key management
 */

const identityService = require('./identity.service');
const { handleError } = require('../../../utils/responseHelpers');

// ==================== UPLOAD PUBLIC KEY ====================

/**
 * Upload user's public identity key
 * POST /api/v2/identity/public-key
 * 
 * Body: {
 *   publicKey: string (PEM),
 *   algorithm: 'X25519' | 'RSA-2048',
 *   version: number
 * }
 */
exports.uploadPublicKey = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { publicKey, algorithm, version } = req.body;

        // Validation
        if (!publicKey || !algorithm) {
            return res.status(400).json({
                message: 'publicKey and algorithm are required'
            });
        }

        if (!['X25519', 'RSA-2048'].includes(algorithm)) {
            return res.status(400).json({
                message: 'algorithm must be X25519 or RSA-2048'
            });
        }

        // Store key
        const keyDoc = await identityService.storePublicKey(
            userId,
            publicKey,
            algorithm,
            version || 1
        );

        // 🔐 AUTOMATIC KEY DISTRIBUTION
        // After uploading public key, distribute conversation keys for all channels
        // this user has access to but doesn't have keys for yet (e.g., OAuth users
        // who created workspaces before uploading their public keys)
        try {
            console.log(`🔐 [Identity] Public key uploaded for user ${userId}, distributing conversation keys...`);

            // Get all channels/conversations user is a member of
            const Channel = require('../../../models/Channel');
            const ConversationKey = require('../../../models/ConversationKey');
            const conversationKeysService = require('../conversations/conversationKeys.service');

            // Find all channels user is a member of
            const channels = await Channel.find({
                'members.user': userId
            }).select('_id');

            let distributedCount = 0;
            for (const channel of channels) {
                try {
                    // Check if conversation key exists for this channel
                    const conversationKey = await ConversationKey.findByConversation(
                        channel._id.toString(),
                        'channel'
                    );

                    if (!conversationKey) {
                        console.log(`⚠️ No conversation key found for channel ${channel._id}`);
                        continue;
                    }

                    // Check if user already has access
                    if (conversationKey.hasAccess(userId)) {
                        // User already has key, skip
                        continue;
                    }

                    // Distribute key to this user
                    const distributed = await conversationKeysService.distributeKeyToNewMember(
                        channel._id.toString(),
                        'channel',
                        userId
                    );

                    if (distributed) {
                        distributedCount++;
                    }
                } catch (channelError) {
                    console.error(`Failed to distribute key for channel ${channel._id}:`, channelError);
                    // Continue with other channels
                }
            }

            if (distributedCount > 0) {
                console.log(`✅ [Identity] Distributed ${distributedCount} conversation keys to user ${userId}`);
            }
        } catch (distributionError) {
            // Non-blocking: User's public key is still stored
            console.error('⚠️ [Identity] Failed to auto-distribute conversation keys:', distributionError);
        }

        return res.status(201).json({
            message: 'Public key stored successfully',
            algorithm: keyDoc.algorithm,
            version: keyDoc.version
        });
    } catch (err) {
        return handleError(res, err, 'UPLOAD PUBLIC KEY ERROR');
    }
};

// ==================== GET PUBLIC KEY ====================

/**
 * Get a user's public identity key
 * GET /api/v2/identity/users/:userId/public-key
 */
exports.getUserPublicKey = async (req, res) => {
    try {
        const { userId } = req.params;

        // Fetch key
        const keyDoc = await identityService.getPublicKey(userId);

        if (!keyDoc) {
            return res.status(404).json({
                message: 'Public key not found for this user'
            });
        }

        return res.json({
            userId: keyDoc.userId,
            publicKey: keyDoc.publicKey,
            algorithm: keyDoc.algorithm,
            version: keyDoc.version
        });
    } catch (err) {
        return handleError(res, err, 'GET PUBLIC KEY ERROR');
    }
};

// ==================== BATCH GET PUBLIC KEYS ====================

/**
 * Batch fetch multiple users' public keys
 * POST /api/v2/identity/public-keys
 * 
 * Body: {
 *   userIds: string[]
 * }
 */
exports.batchGetPublicKeys = async (req, res) => {
    try {
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                message: 'userIds array is required'
            });
        }

        // Limit to 100 keys per request
        if (userIds.length > 100) {
            return res.status(400).json({
                message: 'Maximum 100 user IDs per request'
            });
        }

        // Fetch keys
        const keyDocs = await identityService.batchGetPublicKeys(userIds);

        // Format response
        const publicKeys = keyDocs.map(doc => ({
            userId: doc.userId,
            publicKey: doc.publicKey,
            algorithm: doc.algorithm,
            version: doc.version
        }));

        return res.json({
            publicKeys,
            count: publicKeys.length
        });
    } catch (err) {
        return handleError(res, err, 'BATCH GET PUBLIC KEYS ERROR');
    }
};

// ==================== CHECK KEY EXISTENCE ====================

/**
 * Check if user has uploaded public key
 * GET /api/v2/identity/users/:userId/has-key
 */
exports.checkHasPublicKey = async (req, res) => {
    try {
        const { userId } = req.params;

        const hasKey = await identityService.hasPublicKey(userId);

        return res.json({
            hasKey
        });
    } catch (err) {
        return handleError(res, err, 'CHECK PUBLIC KEY ERROR');
    }
};

// ==================== DELETE PUBLIC KEY ====================

/**
 * Delete user's public key
 * DELETE /api/v2/identity/public-key
 * 
 * User can only delete their own key
 */
exports.deletePublicKey = async (req, res) => {
    try {
        const userId = req.user.sub;

        const deleted = await identityService.deletePublicKey(userId);

        if (deleted) {
            return res.json({
                message: 'Public key deleted successfully'
            });
        } else {
            return res.status(404).json({
                message: 'No public key found to delete'
            });
        }
    } catch (err) {
        return handleError(res, err, 'DELETE PUBLIC KEY ERROR');
    }
};
