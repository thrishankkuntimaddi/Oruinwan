/**
 * Conversation Key Service - Client-side
 * 
 * Manages conversation-level encryption keys for channels and DMs
 * CRITICAL: Keys are generated CLIENT-SIDE ONLY, never on server
 */

import { generateWorkspaceKey, exportKey, importKey } from '../utils/crypto';
import { wrapKeyWithRSA, wrapKeyWithX25519, unwrapKeyWithRSA, unwrapKeyWithX25519 } from '../utils/cryptoIdentity';
import identityKeyService from './identityKeyService';

// ==================== CONVERSATION KEY SERVICE ====================

class ConversationKeyService {
    constructor() {
        this.conversationKeys = new Map(); // conversationId → {key: CryptoKey, algorithm: string}

        // ✅ FIX 2: Setup logout listener to clear cache
        this.setupLogoutListener();
    }

    /**
     * Setup logout event listener (FIX 2)
     * Clears all cached conversation keys when user logs out
     */
    setupLogoutListener() {
        window.addEventListener('auth:logout', () => {
            this.clearCache();
        });
    }

    // ==================== KEY GENERATION ====================

    /**
     * Generate a new random AES-256 conversation key
     * CRITICAL: This is RANDOM, NEVER password-derived
     * 
     * @returns {Promise<CryptoKey>} Random AES-256-GCM key
     */
    async generateConversationKey() {

        // Use the same function as workspace keys - it generates random AES-256
        const key = await generateWorkspaceKey();

        return key;
    }

    /**
     * Create and distribute conversation key
     * Generates key, encrypts for all participants, returns encrypted blobs
     * 
     * @param {string[]} participantUserIds - Array of user IDs who need access
     * @param {string} workspaceId - Workspace ID for workspace key encryption
     * @returns {Promise<{conversationKey: CryptoKey, encryptedKeys: Array, workspaceEncryptedKey?: string, workspaceKeyIv?: string, workspaceKeyAuthTag?: string}>}
     */
    async createAndDistributeConversationKey(participantUserIds, workspaceId) {
        try {

            // 1. Generate random conversation key
            const conversationKey = await this.generateConversationKey();

            // 2. Export conversation key to raw bytes
            const conversationKeyBytes = await exportKey(conversationKey);

            // 3. Fetch public keys for all participants
            const publicKeys = await identityKeyService.batchGetUserPublicKeys(participantUserIds);

            // 4. Encrypt conversation key for each participant
            const encryptedKeys = [];

            for (const userId of participantUserIds) {
                const userKeyData = publicKeys.get(userId);

                if (!userKeyData) {
                    console.warn(`⚠️ No public key found for user ${userId}, skipping`);
                    continue;
                }

                const { publicKey, algorithm } = userKeyData;

                let encryptedKey, ephemeralPublicKey = null;

                if (algorithm === 'X25519') {
                    // Use X25519 ECIES-style wrapping
                    const wrapped = await wrapKeyWithX25519(conversationKeyBytes, publicKey);
                    encryptedKey = wrapped.encryptedKey;
                    ephemeralPublicKey = wrapped.ephemeralPublicKey;
                } else {
                    // Use RSA-OAEP wrapping
                    encryptedKey = await wrapKeyWithRSA(conversationKeyBytes, publicKey);
                }

                encryptedKeys.push({
                    userId,
                    encryptedKey,
                    ephemeralPublicKey,
                    algorithm
                });

            }


            return {
                conversationKey,
                encryptedKeys
            };
        } catch (error) {
            console.error('Failed to create and distribute conversation key:', error);
            throw error;
        }
    }

    // ==================== KEY STORAGE ====================

    /**
     * Create and store conversation key (convenience method)
     * Combines createAndDistributeConversationKey + storeConversationKeysOnServer
     * 
     * @param {string} conversationId - Channel/DM ID
     * @param {string} conversationType - 'channel' or 'dm'
     * @param {string} workspaceId - Workspace ID
     * @param {Array<{user: string} | string>} members - Array of member objects or IDs
     * @returns {Promise<{conversationKey: CryptoKey, encryptedKeys: Array}>}
     */
    async createAndStoreConversationKey(conversationId, conversationType, workspaceId, members) {
        try {

            // Extract user IDs from members array (handle both object and string formats)
            const participantUserIds = members.map(m => {
                if (typeof m === 'string') return m;
                if (m.user) return typeof m.user === 'string' ? m.user : m.user._id || m.user.toString();
                if (m._id) return m._id.toString();
                return m.toString();
            });


            // Create and distribute key
            const { conversationKey, encryptedKeys } = await this.createAndDistributeConversationKey(
                participantUserIds,
                workspaceId
            );

            // Store on server
            await this.storeConversationKeysOnServer(
                conversationId,
                conversationType,
                workspaceId,
                encryptedKeys,
                null, // workspaceEncryptedKey
                null, // workspaceKeyIv
                null  // workspaceKeyAuthTag
            );

            // Cache the key
            const cacheKey = `${conversationType}:${conversationId}`;
            this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256' });


            return { conversationKey, encryptedKeys };
        } catch (error) {
            console.error('Failed to create and store conversation key:', error);
            throw error;
        }
    }

    /**
     * Ensure conversation key exists for DMs ONLY
     * If key missing, generates it client-side, encrypts for participants, and stores on server
     * 
     * ⚠️ DM ONLY - CHANNELS UNTOUCHED
     * 
     * @param {string} conversationId - DM Session ID
     * @param {string} conversationType - Must be 'dm'
     * @param {string} workspaceId - Workspace ID
     * @param {Array<string>} participantIds - Array of participant user IDs
     * @returns {Promise<CryptoKey>} Conversation key
     */
    async ensureConversationKey(conversationId, conversationType, workspaceId, participantIds) {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // DM ONLY - DO NOT USE FOR CHANNELS
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        if (conversationType !== 'dm') {
            throw new Error('ensureConversationKey is DM-only. Use channel flow for channels.');
        }

        try {

            // 1. Check if key already exists (cached or on server)
            let conversationKey = await this.getConversationKey(conversationId, conversationType);

            if (conversationKey && conversationKey.key) {
                return conversationKey.key;
            }

            // Handle typed error response from getConversationKey
            if (conversationKey && conversationKey.status === 'MISSING_FOR_USER') {
            }

            // 2. Key missing - generate new one (FIRST MESSAGE scenario)

            // Generate and distribute key
            try {
                const result = await this.createAndStoreConversationKey(
                    conversationId,
                    conversationType,
                    workspaceId,
                    participantIds
                );

                return result.conversationKey;

            } catch (keyError) {
                // Handle 409 (key already exists - race condition)
                if (keyError.message && keyError.message.includes('already exist')) {
                    const fetchedKey = await this.fetchAndDecryptConversationKey(conversationId, conversationType);
                    return fetchedKey;
                } else {
                    throw keyError;
                }
            }

        } catch (error) {
            console.error(`❌ [DM ONLY] Failed to ensure conversation key for dm:${conversationId}:`, error);
            throw error;
        }
    }

    /**
     * Store conversation keys on server
     * Called after creating a new channel or DM
     * 
     * @param {string} conversationId - Channel/DM ID
     * @param {string} conversationType - 'channel' or 'dm'
     * @param {string} workspaceId - Workspace ID
     * @param {Array} encryptedKeys - Encrypted keys for participants
     * @param {string} workspaceEncryptedKey - Optional workspace-encrypted key
     * @param {string} workspaceKeyIv - Optional workspace key IV
     * @param {string} workspaceKeyAuthTag - Optional workspace key auth tag
     * @returns {Promise<void>}
     */
    async storeConversationKeysOnServer(conversationId, conversationType, workspaceId, encryptedKeys, workspaceEncryptedKey, workspaceKeyIv, workspaceKeyAuthTag) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/v2/conversations/${conversationId}/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    conversationType,
                    workspaceId,
                    encryptedKeys,
                    workspaceEncryptedKey,
                    workspaceKeyIv,
                    workspaceKeyAuthTag
                })
            });

            if (!response.ok) {
                throw new Error('Failed to store conversation keys on server');
            }

        } catch (error) {
            console.error('Failed to store conversation keys:', error);
            throw error;
        }
    }

    // ==================== KEY RETRIEVAL ====================

    /**
     * Fetch and decrypt conversation key from server
     * 
     * @param {string} conversationId - Channel/DM ID
     * @param {string} conversationType - 'channel' or 'dm'
     * @returns {Promise<CryptoKey|null>} Decrypted conversation key or null
     */
    async fetchAndDecryptConversationKey(conversationId, conversationType) {
        try {
            // Check cache first
            const cacheKey = `${conversationType}:${conversationId}`;
            if (this.conversationKeys.has(cacheKey)) {
                // PHASE 1 AUDIT: Log cache hit
                return this.conversationKeys.get(cacheKey).key;
            }

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // PHASE 1 AUDIT: Log key fetch attempt
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


            // Fetch encrypted key from server
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/v2/conversations/${conversationId}/keys?type=${conversationType}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                // ============================================================
                // FIX 4: CLIENT SAFETY NET
                // Handle authorization failures with membership reconciliation
                // ============================================================

                if (response.status === 403) {
                    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    // PHASE 1 AUDIT: Log 403 KEY_NOT_DISTRIBUTED response
                    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    console.error(`🚫 [AUDIT][PHASE1][CLIENT-FETCH] Server returned 403 KEY_NOT_DISTRIBUTED`);
                    console.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
                    console.error(`   ├─ Meaning: Conversation key EXISTS but user lacks access`);
                    console.error(`   ├─ INV-001 violation: User in channel.members but NOT in encryptedKeys[]`);
                    console.error(`   └─ Action: User BLOCKED from sending messages`);
                    console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

                    console.warn(`🚫 [FIX 4] 403 Forbidden for conversation key in ${conversationType}:${conversationId}`);

                    // Re-fetch channel membership to verify current state
                    try {
                        const token = localStorage.getItem('accessToken');
                        const channelResponse = await fetch(`/api/v2/channels/${conversationId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            credentials: 'include'
                        });

                        if (channelResponse.ok) {
                            const channelData = await channelResponse.json();
                            const currentUserId = localStorage.getItem('userId'); // Assuming userId stored

                            // Check if user is actually a member
                            const isMember = channelData.channel?.members?.some(m =>
                                (m.user?._id || m.user) === currentUserId || m === currentUserId
                            );

                            if (!isMember) {
                                console.error(`❌ [FIX 4] User is NOT a member of channel ${conversationId}`);
                                return {
                                    status: 'ACCESS_DENIED',
                                    reason: 'NOT_A_MEMBER',
                                    message: 'You are not a member of this channel',
                                    conversationId,
                                    conversationType
                                };
                            } else {
                                console.error(`⚠️ [FIX 4] User IS a member but key access denied (system error)`);
                                return {
                                    status: 'SYSTEM_ERROR',
                                    reason: 'KEY_ACCESS_ERROR',
                                    message: 'Unable to access encryption keys. Please refresh the page.',
                                    conversationId,
                                    conversationType
                                };
                            }
                        }
                    } catch (reconciliationError) {
                        console.error('[FIX 4] Membership reconciliation failed:', reconciliationError);
                    }

                    // Fallback: return generic access denied
                    return {
                        status: 'ACCESS_DENIED',
                        reason: 'FORBIDDEN',
                        message: 'Access to encryption keys denied',
                        conversationId,
                        conversationType
                    };
                }


                if (response.status === 404) {
                    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    // PHASE 1 AUDIT: Log 404 NOT_FOUND response
                    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    console.warn(`❌ [AUDIT][PHASE1][CLIENT-FETCH] Server returned 404 NOT_FOUND`);
                    console.warn(`   ├─ Conversation: ${conversationType}:${conversationId}`);
                    console.warn(`   ├─ Meaning: No conversation key exists OR user not distributed`);
                    console.warn(`   ├─ Possible reasons: (1) New channel (2) Late joiner (3) Legacy key`);
                    console.warn(`   └─ Action: Cannot decrypt messages`);
                    console.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

                    // 🔐 PHASE 4 FIX: 404 means key NOT YET DISTRIBUTED to this user
                    // This can mean:
                    // 1. Channel has no key yet (Phase 3 - first message)
                    // 2. Channel has key but not distributed to late joiner (Phase 4)
                    // 3. Legacy key without workspace wrapping (Phase 4)

                    console.warn(`⚠️ [PHASE 4] Conversation key missing for user in ${conversationType}:${conversationId}`);
                    console.warn(`   This may indicate: (1) new channel, (2) late joiner, or (3) legacy key`);

                    // Return typed state to prevent Phase 3 fallback
                    return {
                        status: 'MISSING_FOR_USER',
                        reason: 'KEY_NOT_DISTRIBUTED',
                        conversationId,
                        conversationType
                    };
                }

                throw new Error('Failed to fetch conversation key');
            }

            const data = await response.json();
            const { encryptedKey, ephemeralPublicKey, algorithm } = data;

            // Decrypt with own private key
            const privateKey = identityKeyService.getMyPrivateKey();

            let conversationKeyBytes;

            if (algorithm === 'X25519') {
                conversationKeyBytes = await unwrapKeyWithX25519(encryptedKey, ephemeralPublicKey, privateKey);
            } else {
                conversationKeyBytes = await unwrapKeyWithRSA(encryptedKey, privateKey);
            }

            // Import as CryptoKey
            const conversationKey = await importKey(conversationKeyBytes);

            // Cache
            this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256' });

            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
            // PHASE 1 AUDIT: Log successful decrypt and cache
            // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



            return conversationKey;
        } catch (error) {
            console.error(`Failed to fetch conversation key for ${conversationType}:${conversationId}:`, error);
            throw error;
        }
    }

    /**
     * Fetch all conversation keys for a workspace
     * 
     * @param {string} workspaceId - Workspace ID
     * @returns {Promise<void>}
     */
    async fetchWorkspaceConversationKeys(workspaceId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/v2/conversations/workspace/${workspaceId}/keys`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch workspace conversation keys');
            }

            const data = await response.json();
            const { conversationKeys } = data;

            // Decrypt and cache each key
            const privateKey = identityKeyService.getMyPrivateKey();

            for (const ck of conversationKeys) {
                const { conversationId, conversationType, encryptedKey, ephemeralPublicKey, algorithm } = ck;

                try {
                    let conversationKeyBytes;

                    if (algorithm === 'X25519') {
                        conversationKeyBytes = await unwrapKeyWithX25519(encryptedKey, ephemeralPublicKey, privateKey);
                    } else {
                        conversationKeyBytes = await unwrapKeyWithRSA(encryptedKey, privateKey);
                    }

                    const conversationKey = await importKey(conversationKeyBytes);

                    const cacheKey = `${conversationType}:${conversationId}`;
                    this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256' });

                } catch (error) {
                    console.error(`Failed to decrypt key for ${conversationType}:${conversationId}:`, error);
                    // Continue with other keys
                }
            }

        } catch (error) {
            console.error('Failed to fetch workspace conversation keys:', error);
            throw error;
        }
    }

    // ==================== GET CONVERSATION KEY ====================

    /**
     * Get conversation key (from cache or fetch)
     * 
     * @param {string} conversationId - Channel/DM ID
     * @param {string} conversationType - 'channel' or 'dm'
     * @returns {Promise<CryptoKey|null>} Conversation key or null
     */
    async getConversationKey(conversationId, conversationType) {
        const cacheKey = `${conversationType}:${conversationId}`;

        // Check cache
        if (this.conversationKeys.has(cacheKey)) {
            return this.conversationKeys.get(cacheKey).key;
        }

        // Fetch and decrypt
        return await this.fetchAndDecryptConversationKey(conversationId, conversationType);
    }

    // ==================== PARTICIPANT MANAGEMENT ====================

    /**
     * Add participant to conversation (encrypt key for them)
     * Client encrypts the conversation key, sends to server
     * 
     * @param {string} conversationId - Channel/DM ID
     * @param {string} conversationType - 'channel' or 'dm'
     * @param {string} newUserId - New participant's user ID
     * @returns {Promise<void>}
     */
    async addParticipant(conversationId, conversationType, newUserId) {
        try {
            // Get conversation key
            const conversationKey = await this.getConversationKey(conversationId, conversationType);

            if (!conversationKey) {
                throw new Error('Conversation key not found');
            }

            // Export conversation key
            const conversationKeyBytes = await exportKey(conversationKey);

            // Fetch new user's public key
            const { publicKey, algorithm } = await identityKeyService.getUserPublicKey(newUserId);

            // Encrypt conversation key for new user
            let encryptedKey, ephemeralPublicKey = null;

            if (algorithm === 'X25519') {
                const wrapped = await wrapKeyWithX25519(conversationKeyBytes, publicKey);
                encryptedKey = wrapped.encryptedKey;
                ephemeralPublicKey = wrapped.ephemeralPublicKey;
            } else {
                encryptedKey = await wrapKeyWithRSA(conversationKeyBytes, publicKey);
            }

            // Send to server
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/v2/conversations/${conversationId}/keys/add-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    conversationType,
                    userId: newUserId,
                    encryptedKey,
                    ephemeralPublicKey,
                    algorithm
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add participant');
            }

        } catch (error) {
            console.error('Failed to add participant:', error);
            throw error;
        }
    }

    // ==================== ACCESS STATE DETECTION ====================

    /**
     * Fetch conversation keys from server
     * Use cached key if available and fresh
     * 
     * @param {string} conversationId - Channel/DM ID
     * @param {string} conversationType - 'channel' or 'dm'
     * @returns {Promise<object|null>} Decrypted key data or null if not found
     */
    async fetchConversationKeys(conversationId, conversationType) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`/api/v2/conversations/${conversationId}/keys?type=${conversationType}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (response.status === 404) {
                // No keys exist yet (normal for Phase 3 UNINITIALIZED channels)
                return null;
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch conversation keys: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('[conversationKeyService] fetchConversationKeys error:', error);
            throw error;
        }
    }

    // ==================== CACHE MANAGEMENT ====================

    /**
     * Clear cached conversation keys
     */
    clearCache() {
        this.conversationKeys.clear();
    }

    /**
     * Remove specific conversation key from cache
     * 
     * @param {string} conversationId - Channel/DM ID
     * @param {string} conversationType - 'channel' or 'dm'
     */
    removeCachedKey(conversationId, conversationType) {
        const cacheKey = `${conversationType}:${conversationId}`;
        this.conversationKeys.delete(cacheKey);
    }
}

// Singleton instance
const conversationKeyService = new ConversationKeyService();

export default conversationKeyService;
export { conversationKeyService };
