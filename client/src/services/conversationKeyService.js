/**
 * Conversation Key Service - Client-side
 * 
 * Manages conversation-level encryption keys for channels and DMs
 * CRITICAL: Keys are generated CLIENT-SIDE ONLY, never on server
 */

import { generateWorkspaceKey, exportKey, importKey, encryptAESGCM, arrayBufferToBase64 } from '../utils/crypto';
import { wrapKeyWithRSA, wrapKeyWithX25519, unwrapKeyWithRSA, unwrapKeyWithX25519 } from '../utils/cryptoIdentity';
import identityKeyService from './identityKeyService';

// ==================== CONVERSATION KEY SERVICE ====================

class ConversationKeyService {
    constructor() {
        this.conversationKeys = new Map(); // conversationId → {key: CryptoKey, algorithm: string}
    }

    // ==================== KEY GENERATION ====================

    /**
     * Generate a new random AES-256 conversation key
     * CRITICAL: This is RANDOM, NEVER password-derived
     * 
     * @returns {Promise<CryptoKey>} Random AES-256-GCM key
     */
    async generateConversationKey() {
        console.log('🔑 Generating random conversation key (AES-256)...');

        // Use the same function as workspace keys - it generates random AES-256
        const key = await generateWorkspaceKey();

        console.log('✅ Generated random conversation key');
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
            console.log(`🔐 Creating conversation key for ${participantUserIds.length} participants...`);

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

                console.log(`✅ Encrypted conversation key for user ${userId} (${algorithm})`);
            }

            console.log(`✅ Conversation key encrypted for ${encryptedKeys.length} participants`);

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
            const response = await fetch(`/api/v2/conversations/${conversationId}/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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

            console.log(`✅ Stored conversation keys on server for ${conversationType}:${conversationId}`);
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
                console.log(`✅ Using cached conversation key for ${cacheKey}`);
                return this.conversationKeys.get(cacheKey).key;
            }

            // Fetch encrypted key from server
            const response = await fetch(`/api/v2/conversations/${conversationId}/keys?type=${conversationType}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`⚠️ No conversation key found for ${cacheKey}`);
                    return null;
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

            console.log(`✅ Fetched and decrypted conversation key for ${cacheKey}`);

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
            const response = await fetch(`/api/v2/conversations/workspace/${workspaceId}/keys`, {
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

                    console.log(`✅ Decrypted and cached key for ${cacheKey}`);
                } catch (error) {
                    console.error(`Failed to decrypt key for ${conversationType}:${conversationId}:`, error);
                    // Continue with other keys
                }
            }

            console.log(`✅ Fetched ${conversationKeys.length} conversation keys for workspace ${workspaceId}`);
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
            const response = await fetch(`/api/v2/conversations/${conversationId}/keys/add-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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

            console.log(`✅ Added participant ${newUserId} to ${conversationType}:${conversationId}`);
        } catch (error) {
            console.error('Failed to add participant:', error);
            throw error;
        }
    }

    // ==================== CACHE MANAGEMENT ====================

    /**
     * Clear cached conversation keys
     */
    clearCache() {
        this.conversationKeys.clear();
        console.log('🗑️ Conversation key cache cleared');
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
        console.log(`🗑️ Removed cached key for ${cacheKey}`);
    }
}

// Singleton instance
const conversationKeyService = new ConversationKeyService();

export default conversationKeyService;
export { conversationKeyService };
