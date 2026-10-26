const logger = require('../../../utils/logger');
const conversationKeysService = require('./conversationKeys.service');
const { handleError } = require('../../../utils/responseHelpers');

exports.storeConversationKeys = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const { conversationType, workspaceId, encryptedKeys, workspaceEncryptedKey, workspaceKeyIv, workspaceKeyAuthTag } = req.body;
        const createdBy = req.user.sub;

        
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

        
        for (const ek of encryptedKeys) {
            if (!ek.userId || !ek.encryptedKey || !ek.algorithm) {
                return res.status(400).json({
                    message: 'Each encryptedKey must have userId, encryptedKey, and algorithm'
                });
            }
        }

        if (!(await conversationKeysService.isConversationMember(conversationId, conversationType, createdBy))) {
            return res.status(403).json({ message: 'You are not a member of this conversation' });
        }
        // The key belongs to the conversation's own workspace, and copies only to its members.
        const { checkConversationAccess } = require('./conversationAccess');
        const access = await checkConversationAccess({ [conversationType === 'dm' ? 'dm' : 'channel']: conversationId }, createdBy);
        if (!access.ok) return res.status(access.status).json({ message: access.error });
        if (String(workspaceId) !== String(access.workspaceId)) {
            return res.status(400).json({ message: 'workspaceId does not match the conversation' });
        }
        for (const ek of encryptedKeys) {
            if (!(await conversationKeysService.isConversationMember(conversationId, conversationType, ek.userId))) {
                return res.status(400).json({ message: 'A key copy is for someone who is not in this conversation' });
            }
        }

        
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
    } catch (err) {
        
        if (err.message === 'Conversation keys already exist. Use addParticipant to add new users.') {
            return res.status(409).json({
                message: 'Conversation keys already exist',
                error: 'KEY_EXISTS',
                conversationId: req.params.id,
                conversationType: req.body.conversationType
                
                
            });
        }

        return handleError(res, err, 'STORE CONVERSATION KEYS ERROR');
    }
};

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

        // Only people in the conversation now (and active in its workspace) get its key. A copy
        // left behind by a removal that failed half way is never handed out.
        if (!(await conversationKeysService.isConversationMember(conversationId, conversationType, userId))) {
            return res.status(403).json({ error: 'NOT_A_PARTICIPANT', message: 'You are not a member of this conversation', conversationId, conversationType });
        }

        // DM keys are server-managed: create a missing key and hand it to any
        // participant who lacks it before answering, so a DM never gets stuck.
        if (conversationType === 'dm') {
            try {
                const ensured = await conversationKeysService.ensureDMConversationKey(conversationId, userId);
                if (ensured.status === 'NOT_FOUND') {
                    return res.status(404).json({ error: 'DM_NOT_FOUND', message: 'DM session not found', conversationId, conversationType });
                }
                if (ensured.status === 'NOT_PARTICIPANT') {
                    return res.status(403).json({ error: 'NOT_A_PARTICIPANT', message: 'You are not a participant in this conversation', conversationId, conversationType });
                }
            } catch (ensureErr) {
                logger.error({ err: ensureErr, conversationId }, '[DM][E2EE] ensureDMConversationKey failed');
            }
        }

        // Channel members who joined (or set up encryption) after the key was made get their
        // copy now from the server copy, instead of a "key not ready" error.
        if (conversationType === 'channel') {
            try {
                const existingKey = await conversationKeysService.getUserConversationKey(conversationId, 'channel', userId);
                if (!existingKey && await conversationKeysService.isConversationMember(conversationId, 'channel', userId)) {
                    await conversationKeysService.distributeKeyToNewMember(conversationId, 'channel', userId);
                }
            } catch (lazyErr) {
                logger.warn({ err: lazyErr.message, conversationId }, '[E2EE] Lazy channel key distribution failed');
            }
        }

        const keyExists = await conversationKeysService.hasConversationKeys(
            conversationId,
            conversationType
        );

        if (!keyExists) {
            
            if (conversationType === 'channel') {
                logger.error(`🚨 [INVARIANT VIOLATION] Channel ${conversationId} exists but has NO conversation key`);
                logger.error(`   ⚠️ This should NEVER happen in Phase 5+`);
                logger.error(`   ⚠️ ALL channels must have keys at creation time`);
                logger.error(`   📝 User ${userId} attempted to access channel that violated Phase 5`);
            }

            
            return res.status(404).json({
                error: 'KEY_NOT_INITIALIZED',
                phase: 'UNINITIALIZED',
                message: 'No conversation key exists yet',
                hint: 'This is a new conversation. First message will trigger key generation.',
                conversationId,
                conversationType,
                invariantViolation: conversationType === 'channel' 
            });
        }

        
        const encryptedKeyData = await conversationKeysService.getUserConversationKey(
            conversationId,
            conversationType,
            userId
        );

        
        
        
        logger.info(`🔑 [AUDIT][PHASE1][FETCH] Key fetch request`);
        logger.info(`   ├─ User ID: ${userId}`);
        logger.info(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        logger.info(`   └─ Checking if user is in encryptedKeys[] array...`);

        if (!encryptedKeyData) {
            
            
            
            logger.warn(`🚫 [AUDIT][PHASE1][FETCH] Key access DENIED`);
            logger.warn(`   ├─ User ID: ${userId}`);
            logger.warn(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            logger.warn(`   ├─ Reason: User NOT in encryptedKeys[] array`);
            logger.warn(`   ├─ Conversation key exists: YES`);
            logger.warn(`   ├─ User has access: NO`);
            logger.warn(`   ├─ ⚠️ INVARIANT VIOLATION: User may be in channel.members but NOT in encryptedKeys[]`);
            logger.warn(`   └─ Response: 403 KEY_NOT_DISTRIBUTED`);
            logger.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

            
            return res.status(403).json({
                error: 'KEY_NOT_DISTRIBUTED',
                phase: 'AWAITING_DISTRIBUTION',
                message: 'Conversation key exists but you do not have access yet',
                hint: 'Wait for automatic distribution or request key share from existing member.',
                conversationId,
                conversationType
            });
        }

        
        
        
        logger.info(`✅ [AUDIT][PHASE1][FETCH] Key access GRANTED`);
        logger.info(`   ├─ User ID: ${userId}`);
        logger.info(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        logger.info(`   ├─ User is in encryptedKeys[] array: YES`);
        logger.info(`   └─ Response: 200 with encrypted key data`);
        logger.info(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        // serverCopy=false: an older key without a server copy; the client sends one (escrow)
        // so members who join later can be given the key.
        const doc = await require('../../identity/queries/auth').conversationKeyDocs.findByConversation(conversationId, conversationType);
        return res.json({ ...encryptedKeyData, serverCopy: !!doc?.workspaceEncryptedKey });
    } catch (err) {
        return handleError(res, err, 'GET CONVERSATION KEY ERROR');
    }
};

exports.addUserKey = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId, encryptedKey, ephemeralPublicKey, algorithm, conversationType } = req.body;
        const requestingUserId = req.user.sub || req.user.userId;

        if (!['channel', 'dm'].includes(conversationType) || !userId || !encryptedKey || !algorithm) {
            return res.status(400).json({ error: 'conversationType, userId, encryptedKey and algorithm are required' });
        }

        logger.info(`🔐 Adding encrypted key for user ${userId} in ${conversationType}:${conversationId}`);

        // Only share a key with someone who actually belongs to the conversation.
        if (!(await conversationKeysService.isConversationMember(conversationId, conversationType, userId))) {
            return res.status(403).json({ error: 'Target user is not a member of this conversation' });
        }

        // The sharer must still be in the conversation themselves, not just hold an old copy.
        if (!(await conversationKeysService.isConversationMember(conversationId, conversationType, requestingUserId))) {
            return res.status(403).json({ error: 'Cannot distribute key - you are not a member of this conversation' });
        }

        const requestingUserKey = await conversationKeysService.getUserConversationKey(
            conversationId,
            conversationType,
            requestingUserId
        );

        if (!requestingUserKey) {
            return res.status(403).json({
                error: 'Cannot distribute key - you do not have access to this conversation'
            });
        }

        
        const added = await conversationKeysService.addEncryptedKeyForUser(
            conversationId,
            conversationType,
            userId,
            encryptedKey,
            ephemeralPublicKey,
            algorithm
        );

        if (added) {
            logger.info(`✅ Added encrypted key for user ${userId}`);
            res.status(200).json({ success: true });
        } else {
            res.status(400).json({ error: 'Failed to add encrypted key' });
        }
    } catch (error) {
        logger.error('ADD USER KEY ERROR:', error);
        res.status(500).json({ error: 'Failed to add user key' });
    }
};

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

exports.removeParticipant = async (req, res) => {
    try {
        const { id: conversationId, userId } = req.params;
        const { type: conversationType } = req.query;

        if (!conversationType || !['channel', 'dm'].includes(conversationType)) {
            return res.status(400).json({
                message: 'Query parameter "type" is required (channel or dm)'
            });
        }
        // Anyone could delete anyone's key copy here. Only your own now.
        if (String(userId) !== String(req.user.sub)) {
            return res.status(403).json({ message: 'You can only remove your own key copy' });
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

exports.repairUserAccess = async (req, res) => {
    try {
        const userId = req.user.sub;

        logger.info(`🔧 [Controller] Repair access request from user ${userId}`);

        const results = await conversationKeysService.repairUserConversationAccess(userId);

        return res.json({
            success: true,
            message: 'Automatic repair completed',
            ...results
        });
    } catch (err) {
        logger.error('❌ [Controller] Repair access failed:', err);
        
        
        return res.status(200).json({
            success: false,
            message: 'Repair failed (non-critical)',
            error: err.message
        });
    }
};

/** POST /:id/keys/escrow { type, key } — add the server copy to an older conversation key. */
exports.escrowKey = async (req, res) => {
    try {
        const { type } = req.body || {};
        if (!['channel', 'dm'].includes(type)) return res.status(400).json({ message: 'type must be channel or dm' });
        const result = await conversationKeysService.escrowConversationKey(req.params.id, type, req.user.sub, req.body.key);
        const code = { NOT_MEMBER: 403, NO_ACCESS: 403, NOT_FOUND: 404, BAD_KEY: 400 }[result.status] || 200;
        return res.status(code).json(result);
    } catch (err) {
        return handleError(res, err, 'ESCROW CONVERSATION KEY ERROR');
    }
};

/** POST /:id/keys/rewrap { type } — my copy doesn't open any more: wrap it again for my key. */
exports.rewrapKey = async (req, res) => {
    try {
        const { type } = req.body || {};
        if (!['channel', 'dm'].includes(type)) return res.status(400).json({ message: 'type must be channel or dm' });
        const result = await conversationKeysService.rewrapForUser(req.params.id, type, req.user.sub);
        const code = { NOT_MEMBER: 403, NOT_FOUND: 404, NO_SERVER_COPY: 409, FAILED: 409 }[result.status] || 200;
        return res.status(code).json(result);
    } catch (err) {
        return handleError(res, err, 'REWRAP CONVERSATION KEY ERROR');
    }
};

/**
 * GET /escrow-needed — conversations whose key I hold but the server has no copy of. Each
 * device opens these once after sign-in and sends the server its copy (POST /:id/keys/escrow),
 * so members who never got the key (joined later, or set up encryption later) are given it
 * without waiting for the key holder to open that chat.
 */
exports.escrowNeeded = async (req, res) => {
    try {
        const { conversationKeys } = require('../../identity/keys.repo');
        const conversations = await conversationKeys.listWithoutServerCopy(req.user.sub);
        return res.json({ conversations });
    } catch (err) {
        return handleError(res, err, 'ESCROW NEEDED ERROR');
    }
};
