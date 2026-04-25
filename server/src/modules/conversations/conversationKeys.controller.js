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

        
        const keyExists = await conversationKeysService.hasConversationKeys(
            conversationId,
            conversationType
        );

        if (!keyExists) {
            
            if (conversationType === 'channel') {
                console.error(`🚨 [INVARIANT VIOLATION] Channel ${conversationId} exists but has NO conversation key`);
                console.error(`   ⚠️ This should NEVER happen in Phase 5+`);
                console.error(`   ⚠️ ALL channels must have keys at creation time`);
                console.error(`   📝 User ${userId} attempted to access channel that violated Phase 5`);
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

        
        
        
        console.log(`🔑 [AUDIT][PHASE1][FETCH] Key fetch request`);
        console.log(`   ├─ User ID: ${userId}`);
        console.log(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.log(`   └─ Checking if user is in encryptedKeys[] array...`);

        if (!encryptedKeyData) {
            
            
            
            console.warn(`🚫 [AUDIT][PHASE1][FETCH] Key access DENIED`);
            console.warn(`   ├─ User ID: ${userId}`);
            console.warn(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            console.warn(`   ├─ Reason: User NOT in encryptedKeys[] array`);
            console.warn(`   ├─ Conversation key exists: YES`);
            console.warn(`   ├─ User has access: NO`);
            console.warn(`   ├─ ⚠️ INVARIANT VIOLATION: User may be in channel.members but NOT in encryptedKeys[]`);
            console.warn(`   └─ Response: 403 KEY_NOT_DISTRIBUTED`);
            console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

            
            return res.status(403).json({
                error: 'KEY_NOT_DISTRIBUTED',
                phase: 'AWAITING_DISTRIBUTION',
                message: 'Conversation key exists but you do not have access yet',
                hint: 'Wait for automatic distribution or request key share from existing member.',
                conversationId,
                conversationType
            });
        }

        
        
        
        console.log(`✅ [AUDIT][PHASE1][FETCH] Key access GRANTED`);
        console.log(`   ├─ User ID: ${userId}`);
        console.log(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.log(`   ├─ User is in encryptedKeys[] array: YES`);
        console.log(`   └─ Response: 200 with encrypted key data`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return res.json(encryptedKeyData);
    } catch (err) {
        return handleError(res, err, 'GET CONVERSATION KEY ERROR');
    }
};

exports.addUserKey = async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { userId, encryptedKey, ephemeralPublicKey, algorithm, conversationType } = req.body;
        const requestingUserId = req.user.sub || req.user.userId;

        console.log(`🔐 Adding encrypted key for user ${userId} in ${conversationType}:${conversationId}`);

        
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
    } catch (error) {
        console.error('ADD USER KEY ERROR:', error);
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

exports.addParticipant = async (req, res) => {
    try {
        const { id: conversationId } = req.params;
        const { conversationType, userId, encryptedKey, ephemeralPublicKey, algorithm } = req.body;

        
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

        console.log(`🔧 [Controller] Repair access request from user ${userId}`);

        const results = await conversationKeysService.repairUserConversationAccess(userId);

        return res.json({
            success: true,
            message: 'Automatic repair completed',
            ...results
        });
    } catch (err) {
        console.error('❌ [Controller] Repair access failed:', err);
        
        
        return res.status(200).json({
            success: false,
            message: 'Repair failed (non-critical)',
            error: err.message
        });
    }
};
