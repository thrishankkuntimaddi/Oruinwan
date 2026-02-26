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

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📥 [PHASE 1] Public key upload request from user ${userId}`);
        console.log(`📥 [PHASE 1] Algorithm: ${algorithm}, Version: ${version || 1}`);

        // Validation
        if (!publicKey || !algorithm) {
            console.error('❌ [PHASE 1] Missing required fields');
            return res.status(400).json({
                message: 'publicKey and algorithm are required'
            });
        }

        if (!['X25519', 'RSA-2048'].includes(algorithm)) {
            console.error(`❌ [PHASE 1] Invalid algorithm: ${algorithm}`);
            return res.status(400).json({
                message: 'algorithm must be X25519 or RSA-2048'
            });
        }

        // Store key (PURE PHASE 1 OPERATION - NO SIDE EFFECTS)
        const keyDoc = await identityService.storePublicKey(
            userId,
            publicKey,
            algorithm,
            version || 1
        );

        console.log(`✅ [PHASE 1] Public ${algorithm} key stored successfully`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // ============================================================
        // 🔧 PHASE 2: AUTO-REPAIR - Fix any invariant violations
        // When a user uploads their public key (possibly late), scan
        // all channels they're a member of and repair missing keys
        // ============================================================
        try {
            console.log('🔧 [PHASE 2] Starting auto-repair for late key upload...');

            const Channel = require("../../features/channels/channel.model.js");
            const conversationKeysService = require('../conversations/conversationKeys.service');

            // Find all channels user is a member of
            const channels = await Channel.find({
                'members.user': userId
            }).select('_id name').lean();

            if (channels.length === 0) {
                console.log('ℹ️ [PHASE 2] User is not a member of any channels yet');
            } else {
                console.log(`🔍 [PHASE 2] Found ${channels.length} channels to check`);

                let repaired = 0;
                let alreadyOk = 0;
                let cannotRepair = 0;

                for (const channel of channels) {
                    try {
                        const repairResult = await conversationKeysService.repairConversationKeyForUser(
                            channel._id.toString(),
                            userId
                        );

                        if (repairResult.result === 'REPAIR_SUCCESS') {
                            console.log(`   ✅ Repaired: ${channel.name} (${channel._id})`);
                            repaired++;
                        } else if (repairResult.result === 'NO_REPAIR_NEEDED') {
                            alreadyOk++;
                        } else {
                            console.log(`   ⚠️ Cannot repair: ${channel.name} - ${repairResult.reason}`);
                            cannotRepair++;
                        }
                    } catch (repairError) {
                        console.error(`   ❌ Error repairing ${channel.name}:`, repairError.message);
                        cannotRepair++;
                    }
                }

                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                console.log('📊 [PHASE 2] Auto-repair summary:');
                console.log(`   ✅ Repaired: ${repaired}`);
                console.log(`   ℹ️  Already OK: ${alreadyOk}`);
                console.log(`   ⚠️  Cannot repair: ${cannotRepair}`);
                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            }
        } catch (autoRepairError) {
            // Don't fail the upload if auto-repair fails
            console.error('⚠️ [PHASE 2] Auto-repair failed (non-fatal):', autoRepairError);
            console.error('   Public key upload was successful, but auto-repair skipped');
        }
        // ============================================================
        // END PHASE 2
        // ============================================================

        return res.status(201).json({
            message: 'Public key stored successfully',
            algorithm: keyDoc.algorithm,
            version: keyDoc.version
        });
    } catch (err) {
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('❌ [PHASE 1] Upload public key error:', err);
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
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
