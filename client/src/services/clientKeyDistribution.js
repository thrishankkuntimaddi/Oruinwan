// client/src/services/clientKeyDistribution.js
// Client-mediated E2EE key distribution
// Existing members automatically distribute keys to new joiners

import api from './api';
import conversationKeyService from './conversationKeyService';

/**
 * Handle key distribution request from server
 * Called when a new user joins an encrypted channel
 * 
 * @param {Object} payload - { channelId, newUserId, conversationType, workspaceId }
 * @param {String} currentUserId - Current user's ID
 */
export async function handleKeyNeededEvent(payload, currentUserId) {
    const { channelId, newUserId, conversationType } = payload;

    try {
        // Don't distribute to ourselves
        if (newUserId === currentUserId) {
            return;
        }

        // Check if we have the conversation key
        const conversationKey = await conversationKeyService.getConversationKey(channelId, conversationType);

        if (!conversationKey) {
            return;
        }

        // Fetch new user's public key
        const newUserPublicKeyData = await api.get(`/api/users/${newUserId}/public-key`);

        if (!newUserPublicKeyData?.data?.publicKey) {
            console.error(`🔐 [Key Distribution] Failed - no public key for user ${newUserId}`);
            return;
        }

        const { publicKey, algorithm } = newUserPublicKeyData.data;

        // Export conversation key to raw bytes
        const conversationKeyBytes = await crypto.subtle.exportKey('raw', conversationKey);

        // Encrypt for new user
        const encrypted = await encryptKeyForUser(
            conversationKeyBytes,
            publicKey,
            algorithm
        );

        // Send to server
        await api.post(`/api/v2/conversations/${channelId}/keys/add-user`, {
            userId: newUserId,
            encryptedKey: encrypted.encryptedKey,
            ephemeralPublicKey: encrypted.ephemeralPublicKey,
            algorithm: encrypted.algorithm,
            conversationType
        });
    } catch (error) {
        console.error(`❌ [Key Distribution] Failed:`, error);
        // Non-blocking - other members might succeed
    }
}

/**
 * Encrypt conversation key for a specific user
 * 
 * @param {ArrayBuffer} keyBytes - Raw conversation key bytes
 * @param {String} publicKeyPem - User's public key (PEM format)
 * @param {String} algorithm - Key algorithm (RSA-OAEP or X25519)
 * @returns {Object} { encryptedKey, ephemeralPublicKey, algorithm }
 */
async function encryptKeyForUser(keyBytes, publicKeyPem, algorithm) {
    if (algorithm === 'RSA-OAEP') {
        // Import RSA public key from PEM
        const pemHeader = "-----BEGIN PUBLIC KEY-----";
        const pemFooter = "-----END PUBLIC KEY-----";
        const pemContents = publicKeyPem
            .replace(pemHeader, "")
            .replace(pemFooter, "")
            .replace(/\s/g, "");

        const binaryDer = Buffer.from(pemContents, 'base64');

        const publicKey = await crypto.subtle.importKey(
            'spki',
            binaryDer,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['encrypt']
        );

        // Encrypt with RSA-OAEP
        const encrypted = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            keyBytes
        );

        return {
            encryptedKey: Buffer.from(encrypted).toString('base64'),
            ephemeralPublicKey: undefined, // RSA doesn't use ephemeral keys
            algorithm: 'RSA-OAEP'
        };
    } else {
        // TODO: X25519 support (for future)
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
}
