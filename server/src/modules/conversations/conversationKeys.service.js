/**
 * Conversation Keys Service - Server-side
 * 
 * Manages encrypted conversation keys for channels and DMs
 * CRITICAL: Server NEVER generates keys, only stores encrypted blobs from client
 */

const crypto = require('crypto');
const ConversationKey = require('../../../models/ConversationKey');
const UserIdentityKey = require('../../../models/UserIdentityKey');
const cryptoUtils = require('./cryptoUtils');

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
 * Distribute conversation key to new member (server-side)
 * 
 * This is the CANONICAL way to distribute keys when users join channels
 * Uses SERVER_KEK to unwrap workspace-encrypted key, then re-encrypts for new user
 * 
 * @param {String} conversationId - Channel/DM ID
 * @param {String} conversationType - 'channel' or 'dm'
 * @param {String} newUserId - ID of user who needs the key
 * @returns {Promise<Boolean>} True if successful
 */
async function distributeKeyToNewMember(conversationId, conversationType, newUserId) {
    try {
        console.log(`🔐 [Server Distribution] Distributing key for ${conversationType}:${conversationId} to user ${newUserId}`);

        // 1. Fetch conversation key document
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            console.error(`❌ [Server Distribution] No conversation key found for ${conversationType}:${conversationId}`);
            return false;
        }

        // 2. Check if workspace-wrapped key exists
        if (!conversationKey.workspaceEncryptedKey) {
            console.error(`❌ [Server Distribution] Conversation key not wrapped with workspace key`);
            console.error(`   This indicates the key was created before mandatory workspace wrapping`);
            return false;
        }

        // 3. Check if user already has access
        if (conversationKey.hasAccess(newUserId)) {
            console.log(`✅ [Server Distribution] User ${newUserId} already has access`);
            return true;
        }

        // 4. Fetch new user's public key
        // FIX: Fetch from UserIdentityKey model
        const newUserKeyDoc = await UserIdentityKey.findByUserId(newUserId);

        if (!newUserKeyDoc || !newUserKeyDoc.publicKey) {
            console.error(`❌ [Server Distribution] User ${newUserId} has no E2EE public key`);
            return false;
        }


        // 5. Unwrap conversation key using SERVER_KEK
        console.log(`🔓 [Server Distribution] Unwrapping conversation key with SERVER_KEK...`);
        const conversationKeyBytes = cryptoUtils.unwrapWithServerKEK(
            conversationKey.workspaceEncryptedKey,
            conversationKey.workspaceKeyIv,
            conversationKey.workspaceKeyAuthTag
        );

        // 6. Re-encrypt for new user's public key
        console.log(`🔐 [Server Distribution] Re-encrypting for user ${newUserId}...`);
        const wrapped = cryptoUtils.wrapForUser(conversationKeyBytes, newUserKeyDoc.publicKey);

        // 7. Store new encrypted key entry
        conversationKey.encryptedKeys.push({
            userId: newUserId,
            encryptedKey: wrapped.encryptedKey,
            algorithm: wrapped.algorithm
        });

        await conversationKey.save();

        console.log(`✅ [Server Distribution] Key distributed successfully to user ${newUserId} for ${conversationType}:${conversationId}`);
        return true;

    } catch (error) {
        console.error(`❌ [Server Distribution] Failed to distribute key:`, error);
        return false;
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

// ==================== BOOTSTRAP (Server-Side Key Generation) ====================

/**
 * Bootstrap conversation key server-side
 * ⚠️ CRITICAL: Use ONLY for default channels during workspace creation
 * 
 * This is server-assisted key generation for default channels (#general, #announcements)
 * to ensure atomic workspace creation. Regular channels use client-side generation.
 * 
 * @param {Object} params
 * @param {String} params.conversationId - Channel ID
 * @param {String} params.conversationType - 'channel' (only channels supported)
 * @param {String} params.workspaceId - Workspace ID
 * @param {Array} params.members - Array of user IDs
 * @returns {Promise<Object>} Created conversation key document
 */
async function bootstrapConversationKey({ conversationId, conversationType, workspaceId, members }) {
    try {
        console.log(`🔐 [Bootstrap] Creating conversation key for ${conversationType}:${conversationId}`);

        // Check if already exists
        const existing = await ConversationKey.findByConversation(conversationId, conversationType);
        if (existing) {
            console.log(`✅ Conversation key already exists for ${conversationType}:${conversationId}`);
            return existing;
        }

        // 1. Generate random AES-256 conversation key (server-side)
        const conversationKey = crypto.randomBytes(32);

        // 2. Wrap with SERVER_KEK (acts as workspace wrapper for default channels)
        const workspaceWrapped = cryptoUtils.encryptWithWorkspaceKey(conversationKey, workspaceId);

        // 3. Wrap for each user - fetch public keys from UserIdentityKey model
        const identityKeys = await UserIdentityKey.batchFindByUserIds(members);

        // Map userId -> publicKey
        const publicKeyMap = new Map();
        identityKeys.forEach(k => publicKeyMap.set(k.userId.toString(), k));

        const encryptedKeys = [];
        for (const userId of members) {
            const keyDoc = publicKeyMap.get(userId.toString());

            if (!keyDoc || !keyDoc.publicKey) {
                console.warn(`⚠️ User ${userId} has no E2EE public key, skipping`);
                continue;
            }

            // Re-encrypt conversation key for this user
            const wrapped = cryptoUtils.wrapForUser(conversationKey, keyDoc.publicKey);
            encryptedKeys.push({
                userId: userId.toString(),
                encryptedKey: wrapped.encryptedKey,
                algorithm: wrapped.algorithm
            });
        }

        if (encryptedKeys.length === 0) {
            throw new Error('No users with E2EE keys found');
        }

        // 4. Store in database
        const conversationKeyDoc = await ConversationKey.create({
            conversationId,
            conversationType,
            workspaceId,
            createdBy: members[0],
            encryptedKeys,
            workspaceEncryptedKey: workspaceWrapped.ciphertext,
            workspaceKeyIv: workspaceWrapped.iv,
            workspaceKeyAuthTag: workspaceWrapped.authTag,
            version: 1,
            isActive: true
        });

        console.log(`✅ [Bootstrap] Conversation key created for ${conversationType}:${conversationId} (${encryptedKeys.length} users)`);
        return conversationKeyDoc;

    } catch (error) {
        console.error(`❌ [Bootstrap] Failed to create conversation key:`, error);
        throw error;
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
    distributeKeyToNewMember,
    bootstrapConversationKey  // Server-side key generation for default channels
};
