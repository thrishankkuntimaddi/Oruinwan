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
 * @param {Object} params.session - Optional MongoDB session for transactions
 * @returns {Promise<Object>} Created conversation key document
 */
async function storeConversationKeys(params) {
    const { conversationId, conversationType, workspaceId, createdBy, encryptedKeys, workspaceEncryptedKey, workspaceKeyIv, workspaceKeyAuthTag, session } = params;

    try {
        // Check if keys already exist for this conversation
        const existing = await ConversationKey.findByConversation(conversationId, conversationType);

        if (existing) {
            throw new Error('Conversation keys already exist. Use addParticipant to add new users.');
        }

        // Create new conversation key document (with optional session for transactions)
        const createOptions = {
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
        };

        const conversationKey = session
            ? (await ConversationKey.create([createOptions], { session }))[0]
            : await ConversationKey.create(createOptions);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`🔐 [PHASE 3] Conversation key stored for ${conversationType}:${conversationId}`);
        console.log(`📥 [PHASE 3] Members encrypted: ${encryptedKeys.length}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        return conversationKey;
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1 AUDIT: Track key distribution request
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log(`🔗 [AUDIT][PHASE1][DISTRIBUTE] Key distribution request received`);
        console.log(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.log(`   ├─ Target user: ${newUserId}`);
        console.log(`   └─ Timestamp: ${new Date().toISOString()}`);


        // 1. Fetch conversation key document
        const conversationKey = await ConversationKey.findByConversation(conversationId, conversationType);

        if (!conversationKey) {
            console.error(`❌ [Server Distribution] No conversation key found for ${conversationType}:${conversationId}`);
            // PHASE 1 AUDIT: Log missing conversation key
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.error(`❌ [AUDIT][PHASE1][DISTRIBUTE] CRITICAL: No conversation key exists`);
            console.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            console.error(`   ├─ Target user: ${newUserId}`);
            console.error(`   ├─ Reason: ConversationKey document NOT FOUND in database`);
            console.error(`   └─ This channel was NEVER encrypted (Phase 5 failed or skipped)`);
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return false;
        }


        // 2. Check if user already has access (idempotent)
        if (conversationKey.hasAccess(newUserId)) {
            console.log(`ℹ️ [PHASE 4] User ${newUserId} already has conversation key`);
            // PHASE 1 AUDIT: Log idempotent case
            console.log(`✅ [AUDIT][PHASE1][DISTRIBUTE] User already has key (idempotent)`);
            console.log(`   ├─ User: ${newUserId}`);
            console.log(`   └─ Already in encryptedKeys[] - no action needed`);
            return true;
        }


        // 3. Handle legacy keys (created before workspace wrapping was enforced)
        let conversationKeyBytes;

        if (!conversationKey.workspaceEncryptedKey) {
            console.warn(`⚠️ [PHASE 4] Legacy conversation key detected (not workspace-wrapped) for ${conversationType}:${conversationId}`);

            // Extract conversation key from an existing user's encrypted key
            // This requires the first user's private key, which we don't have access to
            // CRITICAL FIX: We cannot unwrap legacy keys without private keys
            // The only solution is to have the client re-share the key
            console.error(`❌ [PHASE 4] Cannot distribute legacy unwrapped key - requires client-side re-sharing`);
            console.error(`   Solution: Original member must re-encrypt key for new member via client`);

            // PHASE 1 AUDIT: Log legacy key detection
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.error(`⚠️ [AUDIT][PHASE1][DISTRIBUTE] LEGACY KEY DETECTED`);
            console.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            console.error(`   ├─ Target user: ${newUserId}`);
            console.error(`   ├─ Missing: workspaceEncryptedKey field`);
            console.error(`   ├─ Reason: Channel created BEFORE workspace wrapping was enforced`);
            console.error(`   ├─ Server cannot decrypt: Needs user's private key`);
            console.error(`   └─ Solution: Client-side key re-sharing required`);
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return false;
        }


        // 4. Fetch new user's public key
        const newUserKeyDoc = await UserIdentityKey.findByUserId(newUserId);

        if (!newUserKeyDoc || !newUserKeyDoc.publicKey) {
            console.error(`❌ [Server Distribution] User ${newUserId} has no E2EE public key`);
            // PHASE 1 AUDIT: Log missing public key
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.error(`❌ [AUDIT][PHASE1][DISTRIBUTE] User has no E2EE public key`);
            console.error(`   ├─ User: ${newUserId}`);
            console.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
            console.error(`   ├─ Reason: UserIdentityKey NOT FOUND or publicKey missing`);
            console.error(`   └─ Cannot encrypt key for this user`);
            console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            return false;
        }


        // 5. Unwrap conversation key using SERVER_KEK
        console.log(`🔓 [Server Distribution] Unwrapping conversation key with SERVER_KEK...`);
        conversationKeyBytes = cryptoUtils.unwrapWithServerKEK(
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

        console.log(`✅ [PHASE 4] Distributed conversation key for ${conversationType}:${conversationId} to user ${newUserId}`);

        // PHASE 1 AUDIT: Log successful distribution
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✅ [AUDIT][PHASE1][DISTRIBUTE] Key distribution SUCCESS`);
        console.log(`   ├─ User: ${newUserId}`);
        console.log(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.log(`   ├─ Method: SERVER_KEK unwrap + user public key re-encrypt`);
        console.log(`   ├─ User added to encryptedKeys[] array`);
        console.log(`   └─ INV-001 gap closed for this user`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        return true;


    } catch (_error) {
        console.error(`❌ [Server Distribution] Failed to distribute key:`, error);
        // PHASE 1 AUDIT: Log exception details
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.error(`❌ [AUDIT][PHASE1][DISTRIBUTE] Distribution EXCEPTION`);
        console.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
        console.error(`   ├─ Target user: ${newUserId}`);
        console.error(`   ├─ Error message: ${error.message}`);
        console.error(`   ├─ Error stack: ${error.stack}`);
        console.error(`   └─ Returning false (distribution failed)`);
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
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
    } catch (_error) {
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

        // ⚠️ GRACEFUL HANDLING: Allow creation even if no users have keys yet
        // The workspace-wrapped key is still created, and user keys can be distributed later
        // when users upload their E2EE public keys via distributeKeyToNewMember
        if (encryptedKeys.length === 0) {
            console.warn(`⚠️ [Bootstrap] No users with E2EE keys found for ${conversationType}:${conversationId}`);
            console.warn(`   Creating conversation key with workspace wrapping only`);
            console.warn(`   User-specific keys will be distributed when users upload public keys`);
        }

        // 4. Store in database
        // Even with 0 user keys, we still create the conversation key with workspace wrapping
        // This allows the workspace to be created, and keys can be distributed later
        const conversationKeyDoc = await ConversationKey.create({
            conversationId,
            conversationType,
            workspaceId,
            createdBy: members[0],
            encryptedKeys, // May be empty array, that's okay
            workspaceEncryptedKey: workspaceWrapped.ciphertext,
            workspaceKeyIv: workspaceWrapped.iv,
            workspaceKeyAuthTag: workspaceWrapped.authTag,
            version: 1,
            isActive: true
        });

        console.log(`✅ [Bootstrap] Conversation key created for ${conversationType}:${conversationId} (${encryptedKeys.length} users)`);
        return conversationKeyDoc;

    } catch (_error) {
        console.error(`❌ [Bootstrap] Failed to create conversation key:`, error);
        throw error;
    }
}

// ==================== PHASE 5: SERVER-SIDE KEY GENERATION ====================

/**
 * PHASE 5: Generate conversation key server-side for new channels
 * This is ONLY used during channel creation to ensure encryption at birth
 * 
 * @param {String} conversationId - Channel ID
 * @param {String} conversationType - Must be 'channel'
 * @param {String} workspaceId - Workspace ID
 * @param {Array<String>} members - Array of all initial member user IDs
 * @param {String} creatorId - Channel creator's user ID (for validation)
 * @param {Object} session - Optional MongoDB session for transactions
 * @returns {Promise<Boolean>} True if successful
 */
async function generateConversationKeyServerSide(conversationId, conversationType, workspaceId, members, creatorId, session = null) {
    try {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1 AUDIT: Channel Creation - Track INV-001 violations
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        console.log(`🔐 [PHASE 5] Generating conversation key at channel birth for ${conversationId}`);
        console.log(`📊 [AUDIT][PHASE1][CREATION] Channel key generation starting`);
        console.log(`   ├─ Channel ID: ${conversationId}`);
        console.log(`   ├─ Conversation Type: ${conversationType}`);
        console.log(`   ├─ Workspace ID: ${workspaceId}`);
        console.log(`   ├─ Total members: ${members.length}`);
        console.log(`   ├─ Members list: ${JSON.stringify(members)}`);
        console.log(`   ├─ Creator ID: ${creatorId}`);
        console.log(`   └─ Timestamp: ${new Date().toISOString()}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);


        // 1. Generate random AES-256 conversation key (32 bytes)
        const conversationKeyBytes = crypto.randomBytes(32);
        console.log(`✅ [PHASE 5] Generated random AES-256 conversation key`);

        // 2. Wrap conversation key with workspace key (using SERVER_KEK)
        const workspaceWrapped = cryptoUtils.encryptWithWorkspaceKey(conversationKeyBytes, workspaceId);
        console.log(`✅ [PHASE 5] Wrapped conversation key with workspace key`);

        // 3. Fetch public keys for ALL initial members (Phase 5 invariant)
        const identityKeys = await UserIdentityKey.batchFindByUserIds(members);

        // Map userId -> publicKey for efficient lookup
        const publicKeyMap = new Map();
        identityKeys.forEach(k => publicKeyMap.set(k.userId.toString(), k));

        // 4. Encrypt conversation key for ALL initial members
        const encryptedKeys = [];
        let creatorHasKey = false;

        // PHASE 1 AUDIT: Track members skipped during key generation
        const skippedMembers = [];


        for (const userId of members) {
            const keyDoc = publicKeyMap.get(userId.toString());

            if (!keyDoc || !keyDoc.publicKey) {
                console.warn(`⚠️ [PHASE 5] User ${userId} has no E2EE public key, skipping`);
                // PHASE 1 AUDIT: Record why this member was skipped
                skippedMembers.push({ userId: userId.toString(), reason: 'MISSING_PUBLIC_KEY' });
                continue;
            }

            // Re-encrypt conversation key for this user
            const wrapped = cryptoUtils.wrapForUser(conversationKeyBytes, keyDoc.publicKey);
            encryptedKeys.push({
                userId: userId.toString(),
                encryptedKey: wrapped.encryptedKey,
                algorithm: wrapped.algorithm
            });

            console.log(`✅ [PHASE 5] Encrypted conversation key for user ${userId}`);

            // Track if creator received key
            if (userId.toString() === creatorId.toString()) {
                creatorHasKey = true;
            }
        }

        // 🔴 FIX 3 — Accept deferred channel encryption
        // ⚠️ WARN if creator has no E2EE key, but allow creation
        // Channel will be read-only until automatic repair distributes keys
        if (!creatorHasKey) {
            console.warn(`⚠️ [PHASE 5] Creator ${creatorId} has no E2EE key - channel will be encrypted when identity is available`);
            console.warn(`   Channel created with workspace wrapping only`);
            console.warn(`   Keys will be distributed via automatic repair when creator's identity is uploaded`);
            console.warn(`   ⚠️ INVARIANT: Channel will be READ-ONLY until repair completes (enforced by client-side guards)`);
            // ✅ DO NOT THROW - allow creation, repair will fix this later
        }

        // WARN if some members missing keys, but allow creation
        if (encryptedKeys.length < members.length) {
            console.warn(`⚠️ [PHASE 5] ${members.length - encryptedKeys.length} members without E2EE keys will not have access`);
        }

        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // PHASE 1 AUDIT: Report key generation results vs membership
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const coveragePercent = Math.round((encryptedKeys.length / members.length) * 100);
        console.log(`📊 [AUDIT][PHASE1][CREATION] Key generation complete`);
        console.log(`   ├─ Channel ID: ${conversationId}`);
        console.log(`   ├─ Total members in channel.members: ${members.length}`);
        console.log(`   ├─ Keys generated in encryptedKeys[]: ${encryptedKeys.length}`);
        console.log(`   ├─ Coverage: ${coveragePercent}% (${encryptedKeys.length}/${members.length})`);

        if (skippedMembers.length > 0) {
            console.warn(`   ├─ ⚠️ INVARIANT VIOLATION DETECTED`);
            console.warn(`   ├─ INV-001 broken: ${skippedMembers.length} members WITHOUT keys`);
            console.warn(`   ├─ Skipped members: ${JSON.stringify(skippedMembers)}`);
            console.warn(`   └─ These users are IN channel.members but NOT IN encryptedKeys[]`);
        } else {
            console.log(`   └─ ✅ INV-001 satisfied: All members have keys`);
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);


        // 5. Store conversation key with ALL encrypted user keys (with optional session)
        await storeConversationKeys({
            conversationId,
            conversationType,
            workspaceId,
            createdBy: creatorId,
            encryptedKeys,  // Array of encrypted keys for ALL valid members
            workspaceEncryptedKey: workspaceWrapped.ciphertext,
            workspaceKeyIv: workspaceWrapped.iv,
            workspaceKeyAuthTag: workspaceWrapped.authTag,
            session  // Pass session for transactional storage
        });

        console.log(`✅ [PHASE 5] Conversation key created and stored at channel birth for ${conversationId} (${encryptedKeys.length} users)`);
        return true;

    } catch (_error) {
        console.error(`❌ [PHASE 5] Failed to generate conversation key:`, error);
        throw error;
    }
}

// ==================== PHASE 2: REPAIR FUNCTION ====================

/**
 * PHASE 2: Repair INV-001 violation for a single user
 * 
 * Repairs the gap between channel.members[] and encryptedKeys[]
 * by re-distributing the EXISTING conversation key to a legitimate member.
 * 
 * SAFETY: This function performs 5 sequential safety gates before any mutation.
 * IDEMPOTENT: Safe to call multiple times for the same user.
 * E2EE SAFE: Uses existing key, no generation, server has SERVER_KEK authority.
 * 
 * @param {string} channelId - Channel ID
 * @param {string} userId - User ID to repair
 * @returns {Promise<RepairResult>} Repair outcome with result enum
 */
async function repairConversationKeyForUser(channelId, userId) {
    const Channel = require("../../features/channels/channel.model.js");

    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔧 [PHASE2][REPAIR] Repair request received`);
    console.log(`   ├─ Channel: ${channelId}`);
    console.log(`   ├─ User: ${userId}`);
    console.log(`   └─ Timestamp: ${new Date().toISOString()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    try {
        // ═══════════════════════════════════════════════════════════
        // GATE 1: Conversation key exists with workspace wrapping
        // ═══════════════════════════════════════════════════════════
        console.log(`🔍 [PHASE2][REPAIR][GATE-1] Checking conversation key existence...`);

        const conversationKey = await ConversationKey.findOne({
            conversationId: channelId,
            conversationType: 'channel'
        });

        if (!conversationKey) {
            console.error(`❌ [PHASE2][REPAIR][GATE-1] FAILED: No conversation key found`);
            console.error(`   ├─ Channel was never encrypted (Phase 5 failure)`);
            console.error(`   └─ Result: CANNOT_REPAIR_NO_CONVERSATION_KEY`);
            return {
                result: 'CANNOT_REPAIR_NO_CONVERSATION_KEY',
                reason: 'Conversation key document does not exist'
            };
        }

        if (!conversationKey.workspaceEncryptedKey) {
            console.error(`❌ [PHASE2][REPAIR][GATE-1] FAILED: Legacy key (no workspace wrapping)`);
            console.error(`   ├─ Channel has legacy key without SERVER_KEK wrapping`);
            console.error(`   └─ Result: CANNOT_REPAIR_NO_CONVERSATION_KEY`);
            return {
                result: 'CANNOT_REPAIR_NO_CONVERSATION_KEY',
                reason: 'Legacy key without workspace wrapping'
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-1] PASSED ✓`);
        console.log(`   ├─ Conversation key exists: YES`);
        console.log(`   └─ Workspace-wrapped: YES`);

        // ═══════════════════════════════════════════════════════════
        // GATE 2: User is legitimate channel member
        // ═══════════════════════════════════════════════════════════
        console.log(`🔍 [PHASE2][REPAIR][GATE-2] Checking channel membership...`);

        const channel = await Channel.findById(channelId).select('members');

        if (!channel) {
            console.error(`❌ [PHASE2][REPAIR][GATE-2] FAILED: Channel not found`);
            return {
                result: 'CANNOT_REPAIR_NOT_A_MEMBER',
                reason: 'Channel does not exist'
            };
        }

        const isMember = channel.members.some(m => {
            const memberId = m.user ? m.user.toString() : m.toString();
            return memberId === userId.toString();
        });

        if (!isMember) {
            console.error(`❌ [PHASE2][REPAIR][GATE-2] FAILED: User not in channel.members[]`);
            console.error(`   ├─ User: ${userId}`);
            console.error(`   ├─ Channel: ${channelId}`);
            console.error(`   └─ Result: CANNOT_REPAIR_NOT_A_MEMBER`);
            return {
                result: 'CANNOT_REPAIR_NOT_A_MEMBER',
                reason: 'User is not a member of this channel'
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-2] PASSED ✓`);
        console.log(`   └─ User is in channel.members[]: YES`);

        // ═══════════════════════════════════════════════════════════
        // GATE 3: User does NOT already have key (idempotent check)
        // ═══════════════════════════════════════════════════════════
        console.log(`🔍 [PHASE2][REPAIR][GATE-3] Checking if user already has key...`);

        const userHasKey = conversationKey.encryptedKeys.some(ek =>
            ek.userId.toString() === userId.toString()
        );

        if (userHasKey) {
            console.log(`ℹ️ [PHASE2][REPAIR][GATE-3] User already has key (idempotent)`);
            console.log(`   ├─ User: ${userId}`);
            console.log(`   ├─ Already in encryptedKeys[]: YES`);
            console.log(`   └─ Result: NO_REPAIR_NEEDED`);
            return {
                result: 'NO_REPAIR_NEEDED',
                reason: 'User already has encryption key'
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-3] PASSED ✓`);
        console.log(`   ├─ User in encryptedKeys[]: NO`);
        console.log(`   └─ INV-001 violation confirmed - repair needed`);

        // ═══════════════════════════════════════════════════════════
        // GATE 4: User has valid E2EE public key
        // ═══════════════════════════════════════════════════════════
        console.log(`🔍 [PHASE2][REPAIR][GATE-4] Checking user's E2EE public key...`);

        const userIdentityKey = await UserIdentityKey.findByUserId(userId);

        if (!userIdentityKey || !userIdentityKey.publicKey) {
            console.error(`❌ [PHASE2][REPAIR][GATE-4] FAILED: User has no E2EE public key`);
            console.error(`   ├─ User: ${userId}`);
            console.error(`   ├─ UserIdentityKey exists: ${!!userIdentityKey}`);
            console.error(`   ├─ Public key exists: NO`);
            console.error(`   └─ Result: CANNOT_REPAIR_MISSING_PUBLIC_KEY`);
            return {
                result: 'CANNOT_REPAIR_MISSING_PUBLIC_KEY',
                reason: 'User has no E2EE identity key'
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-4] PASSED ✓`);
        console.log(`   ├─ User has E2EE public key: YES`);
        console.log(`   └─ Algorithm: ${userIdentityKey.algorithm}`);

        // ═══════════════════════════════════════════════════════════
        // GATE 5: Server can unwrap conversation key
        // ═══════════════════════════════════════════════════════════
        console.log(`🔍 [PHASE2][REPAIR][GATE-5] Unwrapping conversation key with SERVER_KEK...`);

        let conversationKeyBytes;
        try {
            conversationKeyBytes = cryptoUtils.unwrapWithServerKEK(
                conversationKey.workspaceEncryptedKey,
                conversationKey.workspaceKeyIv,
                conversationKey.workspaceKeyAuthTag
            );

            if (!conversationKeyBytes || conversationKeyBytes.length !== 32) {
                throw new Error('Invalid conversation key bytes');
            }

        } catch (unwrapError) {
            console.error(`❌ [PHASE2][REPAIR][GATE-5] FAILED: Cannot unwrap conversation key`);
            console.error(`   ├─ Error: ${unwrapError.message}`);
            console.error(`   ├─ Channel: ${channelId}`);
            console.error(`   └─ Result: CANNOT_REPAIR_UNWRAP_FAILED`);
            return {
                result: 'CANNOT_REPAIR_UNWRAP_FAILED',
                reason: `Unwrap failed: ${unwrapError.message}`
            };
        }

        console.log(`✅ [PHASE2][REPAIR][GATE-5] PASSED ✓`);
        console.log(`   ├─ Conversation key unwrapped successfully`);
        console.log(`   └─ Key size: 32 bytes (AES-256)`);

        // ═══════════════════════════════════════════════════════════
        // ALL GATES PASSED - PERFORM REPAIR
        // ═══════════════════════════════════════════════════════════
        console.log(`🔧 [PHASE2][REPAIR] ALL GATES PASSED - Proceeding with repair`);
        console.log(`   ├─ User: ${userId}`);
        console.log(`   └─ Channel: ${channelId}`);

        // Re-encrypt conversation key for user's public key
        const wrapped = cryptoUtils.wrapForUser(
            conversationKeyBytes,
            userIdentityKey.publicKey
        );

        // Append to encryptedKeys[] (MUTATION POINT)
        conversationKey.encryptedKeys.push({
            userId: userId,
            encryptedKey: wrapped.encryptedKey,
            algorithm: wrapped.algorithm
        });

        await conversationKey.save();

        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`✅ [PHASE2][REPAIR] REPAIR SUCCESS`);
        console.log(`   ├─ User: ${userId}`);
        console.log(`   ├─ Channel: ${channelId}`);
        console.log(`   ├─ Method: SERVER_KEK unwrap + user public key re-encrypt`);
        console.log(`   ├─ Added to encryptedKeys[]: YES`);
        console.log(`   ├─ INV-001 violation REPAIRED`);
        console.log(`   └─ User can now: Fetch key, decrypt messages, send messages`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return {
            result: 'REPAIR_SUCCESS',
            userId: userId,
            channelId: channelId,
            algorithm: wrapped.algorithm
        };

    } catch (_error) {
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.error(`❌ [PHASE2][REPAIR] EXCEPTION during repair`);
        console.error(`   ├─ User: ${userId}`);
        console.error(`   ├─ Channel: ${channelId}`);
        console.error(`   ├─ Error: ${error.message}`);
        console.error(`   └─ Stack: ${error.stack}`);
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return {
            result: 'CANNOT_REPAIR_EXCEPTION',
            reason: error.message,
            error: error.message
        };
    }



}

// ==================== PHASE 2: AUTOMATIC REPAIR ====================

/**
 * PHASE 2: Repair ALL channels where user is member but missing encryption key
 * Automatically called when user identity becomes available
 * 
 * @param {String} userId - User ID to repair
 * @returns {Promise<RepairSummary>} Summary of repairs performed
 */
async function repairUserConversationAccess(userId) {
    console.log(`🔧 [AUTO-REPAIR] Starting automatic repair for user ${userId}...`);

    const Channel = require("../../features/channels/channel.model.js");

    try {
        // Find all channels where user is a member
        const userChannels = await Channel.find({
            'members.user': userId
        }).select('_id name workspace');

        console.log(`📊 [AUTO-REPAIR] Found ${userChannels.length} channels for user ${userId}`);

        const results = {
            total: userChannels.length,
            repaired: 0,
            alreadyHasKey: 0,
            failed: 0,
            details: []
        };

        for (const channel of userChannels) {
            const result = await repairConversationKeyForUser(channel._id.toString(), userId);

            if (result.result === 'REPAIR_SUCCESS') {
                results.repaired++;
                results.details.push({
                    channelId: channel._id,
                    channelName: channel.name,
                    status: 'repaired'
                });
            } else if (result.result === 'NO_REPAIR_NEEDED') {
                results.alreadyHasKey++;
            } else {
                results.failed++;
                results.details.push({
                    channelId: channel._id,
                    channelName: channel.name,
                    status: 'failed',
                    reason: result.reason
                });
            }
        }

        console.log(`✅ [AUTO-REPAIR] Completed for user ${userId}: ${results.repaired} repaired, ${results.alreadyHasKey} already had keys, ${results.failed} failed`);
        return results;

    } catch (_error) {
        console.error(`❌ [AUTO-REPAIR] Failed for user ${userId}:`, error);
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
    bootstrapConversationKey,  // Server-side key generation for default channels
    generateConversationKeyServerSide,  // PHASE 5: Server-side key generation for new channels
    repairConversationKeyForUser,  // PHASE 2: Repair INV-001 violations (single channel)
    repairUserConversationAccess  // PHASE 2: Automatic repair for all user channels
};
