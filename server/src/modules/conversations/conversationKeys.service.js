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
    const { conversationId, conversationType, workspaceId, createdBy, encryptedKeys } = params;

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
            throw new Error('User does not have access to this conversation');
        }

        // Get user's encrypted key
        const encryptedKeyData = conversationKey.getEncryptedKeyForUser(userId);

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
    hasConversationKeys
};
