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
        const { conversationType, workspaceId, encryptedKeys, workspaceEncryptedKey, workspaceKeyIv, workspaceKeyAuthTag } = req.body;
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
            encryptedKeys,
            workspaceEncryptedKey,
            workspaceKeyIv,
            workspaceKeyAuthTag
        });

        return res.status(201).json({
            message: 'Conversation keys stored successfully',
            conversationId: conversationKey.conversationId,
            participantCount: conversationKey.encryptedKeys.length
        });
    } catch (_err) {
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

        // 🔐 CRITICAL PHASE 4 FIX: Check if conversation key EXISTS at all
        const keyExists = await conversationKeysService.hasConversationKeys(
            conversationId,
            conversationType
        );

        if (!keyExists) {
            // 🚨 PHASE 5 INVARIANT CHECK: Log if this is a channel (should NEVER happen post-Phase 5)
            if (conversationType === 'channel') {
                console.error(`🚨 [INVARIANT VIOLATION] Channel ${conversationId} exists but has NO conversation key`);
                console.error(`   ⚠️ This should NEVER happen in Phase 5+`);
                console.error(`   ⚠️ ALL channels must have keys at creation time`);
                console.error(`   📝 User ${userId} attempted to access channel that violated Phase 5`);
            }

            // ✅ PHASE 3: No key exists at all - client should generate
            return res.status(404).json({
                error: 'KEY_NOT_INITIALIZED',
                phase: 'UNINITIALIZED',
                message: 'No conversation key exists yet',
                hint: 'This is a new conversation. First message will trigger key generation.',
                conversationId,
                conversationType,
                invariantViolation: conversationType === 'channel' // Flag for monitoring
            });
        }

        // Key exists - now check if user has access
        const encryptedKeyData = await conversationKeysService.getUserConversationKey(
            conversationId,
            conversationType,
            userId
        );

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1 AUDIT: Log key fetch authorization decision
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log(`🔑 [AUDIT][PHASE1][FETCH] Key fetch request`);
        console.log(`   ├─ User ID: ${userId}`);
        console.log(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.log(`   └─ Checking if user is in encryptedKeys[] array...`);


        if (!encryptedKeyData) {
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // PHASE 1 AUDIT: Log access DENIED
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            console.warn(`🚫 [AUDIT][PHASE1][FETCH] Key access DENIED`);
            console.warn(`   ├─ User ID: ${userId}`);
            console.warn(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            console.warn(`   ├─ Reason: User NOT in encryptedKeys[] array`);
            console.warn(`   ├─ Conversation key exists: YES`);
            console.warn(`   ├─ User has access: NO`);
            console.warn(`   ├─ ⚠️ INVARIANT VIOLATION: User may be in channel.members but NOT in encryptedKeys[]`);
            console.warn(`   └─ Response: 403 KEY_NOT_DISTRIBUTED`);
            console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

            // 🔐 PHASE 4: Key exists but NOT distributed to this user
            return res.status(403).json({
                error: 'KEY_NOT_DISTRIBUTED',
                phase: 'AWAITING_DISTRIBUTION',
                message: 'Conversation key exists but you do not have access yet',
                hint: 'Wait for automatic distribution or request key share from existing member.',
                conversationId,
                conversationType
            });
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1 AUDIT: Log access GRANTED
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log(`✅ [AUDIT][PHASE1][FETCH] Key access GRANTED`);
        console.log(`   ├─ User ID: ${userId}`);
        console.log(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.log(`   ├─ User is in encryptedKeys[] array: YES`);
        console.log(`   └─ Response: 200 with encrypted key data`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);


        return res.json(encryptedKeyData);
    } catch (_err) {
        return handleError(res, err, 'GET CONVERSATION KEY ERROR');
    }
};

/**
 * Add encrypted key for a specific user (client-mediated distribution)
 * POST /api/v2/conversations/:conversationId/keys/add-user
 */
exports.addUserKey = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId, encryptedKey, ephemeralPublicKey, algorithm, conversationType } = req.body;
        const requestingUserId = req.user.sub || req.user.userId;

        console.log(`🔐 Adding encrypted key for user ${userId} in ${conversationType}:${conversationId}`);

        // Verify requesting user has access (can only distribute if you have the key)
        const requestingUserKey = await service.getUserConversationKey(
            conversationId,
            conversationType,
            requestingUserId
        );

        if (!requestingUserKey) {
            return res.status(403).json({
                error: 'Cannot distribute key - you do not have access to this conversation'
            });
        }

        // Add encrypted key for the new user
        const added = await service.addEncryptedKeyForUser(
            conversationId,
            conversationType,
            userId,
            encryptedKey,
            ephemeralPublicKey,
            algorithm
        );

        if (added) {
            console.log(`✅ Added encrypted key for user ${userId}`);
            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ error: 'Failed to add encrypted key' });
        }
    } catch (_error) {
        console.error('ADD USER KEY ERROR:', error);
        res.status(500).json({ error: 'Failed to add user key' });
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
    } catch (_err) {
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
    } catch (_err) {
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
    } catch (_err) {
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
    } catch (_err) {
        return handleError(res, err, 'CHECK KEYS EXIST ERROR');
    }
};

// ==================== PHASE 2: AUTOMATIC REPAIR ====================

/**
 * Trigger automatic repair for all user's channels
 * POST /api/v2/conversations/repair-access
 * 
 * Called by client after identity initialization to repair any missing keys
 */
exports.repairUserAccess = async (req, res) => {
    try {
        const userId = req.user.sub;

        console.log(`🔧 [Controller] Repair access request from user ${userId}`);

        const results = await conversationKeysService.repairUserConversationAccess(userId);

        return res.json({
            success: true,
            message: 'Automatic repair completed',
            ...results
        });
    } catch (_err) {
        console.error('❌ [Controller] Repair access failed:', err);
        // 🔴 FIX 2: Even on error, return 200 to keep client flow non-blocking
        // Client should treat this as fire-and-forget
        return res.status(200).json({
            success: false,
            message: 'Repair failed (non-critical)',
            error: err.message
        });
    }
};
