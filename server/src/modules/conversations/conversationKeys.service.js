/**
 * Conversation Keys Service - Server-side
 * 
 * Manages encrypted conversation keys for channels and DMs
 * CRITICAL: Server NEVER generates keys, only stores encrypted blobs from client
 */

const ConversationKey = require('../../../models/ConversationKey');

// ==================== KEY STORAGE ====================

/**
 * Store encrypted conversation keys
 * Client generates the key and encrypts it for each participant
 * 
 * @param {Object} params
 * @param {String} params.conversationId - Channel/DM ID
 * @param {String} params.conversationType - 'channel' or 'dm'
 * @param {String} params.workspaceId - Workspace ID
 * @param {String} params.createdBy - User who created the key
 * @param {Array} params.encryptedKeys - [{userId, encryptedKey, ephemeralPublicKey?, algorithm}]
 * @returns {Promise<Object>} Created conversation key document
 */
async function storeConversationKeys(params) {
    const { conversationId, conversationType, workspaceId, createdBy, encryptedKeys, workspaceEncryptedKey, workspaceKeyIv, workspaceKeyAuthTag } = params;

    try {
        // Check if keys already exist for this conversation
        const existing = await ConversationKey.findByConversation(conversationId, conversationType);

        if (existing) {
            throw new Error('Conversation keys already exist. Use addParticipant to add new users.');
        }

        // Create new conversation key document
        const conversationKey = await ConversationKey.create({
            conversationId,
            conversationType,
            workspaceId,
            createdBy,
            encryptedKeys,
            workspaceEncryptedKey,
            workspaceKeyIv,
            workspaceKeyAuthTag,
            version: 1,
            isActive: true
        });

        console.log(`✅ Stored conversation keys for ${conversationType}:${conversationId} (${encryptedKeys.length} participants)`);
        return conversationKey;
    } catch (error) {
        console.error('Failed to store conversation keys:', error);
        throw error;
    }
}

// ==================== KEY RETRIEVAL ====================

/**
 * Get user's encrypted key for a specific conversation
 * 
 * @param {String} conversationId - Channel/DM ID
 * @param {String} conversationType - 'channel' or 'dm'
 * @param {String} userId - User requesting the key
 * @returns {Promise<Object|null>} Encrypted key data or null
 */
async function getUserConversationKey(conversationId, conversationType, userId) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            return null;
        }

        // Check if user has access
        if (!conversationKey.hasAccess(userId)) {
            // Return null instead of throwing - allows controller to return 404
            console.log(`User ${userId} does not have access to ${conversationType}:${conversationId}`);
            return null;
        }

        // Get user's encrypted key
        const encryptedKeyData = conversationKey.getEncryptedKeyForUser(userId);

        if (!encryptedKeyData) {
            console.log(`No encrypted key found for user ${userId} in ${conversationType}:${conversationId}`);
            return null;
        }

        return {
            conversationId: conversationKey.conversationId,
            conversationType: conversationKey.conversationType,
            encryptedKey: encryptedKeyData.encryptedKey,
            ephemeralPublicKey: encryptedKeyData.ephemeralPublicKey,
            algorithm: encryptedKeyData.algorithm,
            version: conversationKey.version
        };
    } catch (error) {
        console.error('Failed to get user conversation key:', error);
        throw error;
    }
}

/**
 * Get all conversation keys user has access to in a workspace
 * 
 * @param {String} userId - User ID
 * @param {String} workspaceId - Workspace ID
 * @returns {Promise<Array>} Array of encrypted key data
 */
async function getUserWorkspaceConversationKeys(userId, workspaceId) {
    try {
        const conversationKeys = await ConversationKey.findByUser(userId, workspaceId);

        return conversationKeys.map(ck => {
            const encryptedKeyData = ck.getEncryptedKeyForUser(userId);
            return {
                conversationId: ck.conversationId,
                conversationType: ck.conversationType,
                encryptedKey: encryptedKeyData.encryptedKey,
                ephemeralPublicKey: encryptedKeyData.ephemeralPublicKey,
                algorithm: encryptedKeyData.algorithm,
                version: ck.version
            };
        });
    } catch (error) {
        console.error('Failed to get user workspace conversation keys:', error);
        throw error;
    }
}

// ==================== PARTICIPANT MANAGEMENT ====================

/**
 * Add participant to conversation
 * Client encrypts the conversation key for the new user
 * 
 * @param {String} conversationId - Channel/DM ID
 * @param {String} conversationType - 'channel' or 'dm'
 * @param {String} userId - New participant's user ID
 * @param {String} encryptedKey - Conversation key encrypted for new user
 * @param {String} ephemeralPublicKey - (Optional) For X25519
 * @param {String} algorithm - Encryption algorithm used
 * @returns {Promise<Object>} Updated conversation key document
 */
async function addParticipant(conversationId, conversationType, userId, encryptedKey, ephemeralPublicKey, algorithm) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            throw new Error('Conversation keys not found');
        }

        // Check if user already has access
        if (conversationKey.hasAccess(userId)) {
            console.log(`User ${userId} already has access to ${conversationType}:${conversationId}`);
            return conversationKey;
        }

        // Add new encrypted key
        conversationKey.encryptedKeys.push({
            userId,
            encryptedKey,
            ephemeralPublicKey,
            algorithm,
            addedAt: new Date()
        });

        await conversationKey.save();

        console.log(`✅ Added participant ${userId} to ${conversationType}:${conversationId}`);
        return conversationKey;
    } catch (error) {
        console.error('Failed to add participant:', error);
        throw error;
    }
}

/**
 * Remove participant from conversation
 * Deletes their encrypted key (they can no longer decrypt future messages)
 * 
 * @param {String} conversationId - Channel/DM ID
 * @param {String} conversationType - 'channel' or 'dm'
 * @param {String} userId - User to remove
 * @returns {Promise<Boolean>} True if removed
 */
async function removeParticipant(conversationId, conversationType, userId) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            throw new Error('Conversation keys not found');
        }

        // Remove user's encrypted key
        const initialLength = conversationKey.encryptedKeys.length;
        conversationKey.encryptedKeys = conversationKey.encryptedKeys.filter(
            ek => ek.userId.toString() !== userId.toString()
        );

        if (conversationKey.encryptedKeys.length === initialLength) {
            console.log(`User ${userId} not found in ${conversationType}:${conversationId}`);
            return false;
        }

        await conversationKey.save();

        console.log(`🗑️ Removed participant ${userId} from ${conversationType}:${conversationId}`);
        return true;
    } catch (error) {
        console.error('Failed to remove participant:', error);
        throw error;
    }
}

/**
 * Add encrypted key for a user (client-mediated distribution)
 * Called when an existing member distributes the key to a new joiner
 * 
 * @param {String} conversationId - Channel/DM ID
 * @param {String} conversationType - 'channel' or 'dm'
 * @param {String} userId - User ID to add key for
 * @param {String} encryptedKey - Encrypted key (base64)
 * @param {String} ephemeralPublicKey - Ephemeral public key (base64, optional)
 * @param {String} algorithm - Encryption algorithm
 * @returns {Promise<Boolean>} True if successful
 */
async function addEncryptedKeyForUser(conversationId, conversationType, userId, encryptedKey, ephemeralPublicKey, algorithm) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            throw new Error('Conversation keys not found');
        }

        // Check if user already has access
        if (conversationKey.hasAccess(userId)) {
            console.log(`User ${userId} already has access to ${conversationType}:${conversationId}`);
            return true;
        }

        // Add encrypted key
        conversationKey.encryptedKeys.push({
            userId,
            encryptedKey,
            ephemeralPublicKey: ephemeralPublicKey || undefined,
            algorithm
        });

        await conversationKey.save();

        console.log(`✅ Added encrypted key for user ${userId} in ${conversationType}:${conversationId}`);
        return true;
    } catch (error) {
        console.error('Failed to add encrypted key for user:', error);
        throw error;
    }
}

// ==================== KEY DISTRIBUTION ====================

/**
 * Distribute conversation key to new member
 * Server-side re-encryption using workspace master key
 * 
 * @param {String} conversationId - Channel/DM ID
 * @param {String} conversationType - 'channel' or 'dm'
 * @param {String} newUserId - New participant's user ID
 * @param {String} workspaceId - Workspace ID
 * @returns {Promise<Boolean>} True if successful
 */
async function distributeKeyToNewMember(conversationId, conversationType, newUserId, workspaceId) {
    const crypto = require('./conversationKeys.crypto');
    const { WorkspaceKey } = require('../../../models/encryption');

    try {
        console.log(`🔐 Distributing conversation key to user ${newUserId}...`);

        // 1. Fetch conversation key document
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            throw new Error('Conversation keys not found');
        }

        // 2. Check if user already has access
        if (conversationKey.hasAccess(newUserId)) {
            console.log(`User ${newUserId} already has access to ${conversationType}:${conversationId}`);
            return true;
        }

        // 3. Check if workspace-encrypted key exists
        if (!conversationKey.workspaceEncryptedKey) {
            console.warn(`No workspace-encrypted key for ${conversationType}:${conversationId} - cannot distribute`);
            return false;
        }

        // 4. Fetch workspace master key (encrypted with admin's key)
        const workspaceKey = await WorkspaceKey.findOne({ workspaceId }).populate('creator');

        if (!workspaceKey || !workspaceKey.encryptedKeys || workspaceKey.encryptedKeys.length === 0) {
            console.warn(`No workspace master key found for workspace ${workspaceId}`);
            return false;
        }

        // 5. TODO: Decrypt workspace master key
        // BLOCKER: Requires server-side KEK or different architecture
        // For now, this returns false and relies on client-side lazy E2EE
        console.warn(`⚠️ Server-side key distribution requires server KEK (not implemented)`);
        console.warn(`User ${newUserId} will receive key via lazy E2EE on first message send`);

        return false;

        /* 
        // 6. Once server KEK is implemented:
        const workspaceMasterKeyBytes = await decryptWorkspaceKeyWithServerKEK(workspaceKey);
        
        // 7. Decrypt conversation key using workspace master key
        const conversationKeyBytes = crypto.unwrapConversationKeyWithWorkspaceKey(
            conversationKey.workspaceEncryptedKey,
            conversationKey.workspaceKeyIv,
            conversationKey.workspaceKeyAuthTag,
            workspaceMasterKeyBytes
        );

        // 8. Get new user's public key
        const userPublicKey = await crypto.getUserPublicKey(newUserId);
        
        if (!userPublicKey) {
            throw new Error(`No public key found for user ${newUserId}`);
        }

        // 9. Re-encrypt conversation key for new user
        const { encryptedKey, ephemeralPublicKey } = await crypto.wrapConversationKeyForUser(
            conversationKeyBytes,
            userPublicKey.publicKey,
            userPublicKey.algorithm
        );

        // 10. Add encrypted key to conversation key document
        conversationKey.encryptedKeys.push({
            userId: newUserId,
            encryptedKey: encryptedKey.toString('base64'),
            ephemeralPublicKey: ephemeralPublicKey ? ephemeralPublicKey.toString('base64') : undefined,
            algorithm: userPublicKey.algorithm
        });

        await conversationKey.save();

        console.log(`✅ Distributed conversation key to user ${newUserId}`);
        return true;
        */
    } catch (error) {
        console.error('Failed to distribute conversation key:', error);
        throw error;
    }
}


// ==================== KEY EXISTENCE ====================

/**
 * Check if conversation has encryption keys
 * 
 * @param {String} conversationId - Channel/DM ID
 * @param {String} conversationType - 'channel' or 'dm'
 * @returns {Promise<Boolean>} True if keys exist
 */
async function hasConversationKeys(conversationId, conversationType) {
    try {
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);
        return conversationKey !== null;
    } catch (error) {
        console.error('Failed to check conversation keys:', error);
        return false;
    }
}

// ==================== EXPORTS ====================

module.exports = {
    storeConversationKeys,
    getUserConversationKey,
    getUserWorkspaceConversationKeys,
    addParticipant,
    removeParticipant,
    addEncryptedKeyForUser,
    hasConversationKeys,
    distributeKeyToNewMember
};
