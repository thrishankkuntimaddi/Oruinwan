/**
 * Key Distribution Service - Client-Assisted E2EE
 * 
 * Handles re-encryption of conversation keys for new channel members.
 * This ensures true zero-knowledge encryption where the server never
 * sees plaintext conversation keys.
 */

import conversationKeyService from './conversationKeyService';
import identityKeyService from './identityKeyService';
import api from './api';

/**
 * Re-encrypt conversation key for a new user (CLIENT-SIDE ONLY)
 * 
 * @param {string} channelId - Channel ID
 * @param {string} newUserId - New user's ID
 * @param {string} newUserPublicKey - New user's public RSA key (base64)
 * @returns {Promise<void>}
 */
export async function distributeKeyToNewMember(channelId, newUserId, newUserPublicKey) {
    try {
        console.log(`🔐 [Key Distribution] Re-encrypting key for user ${newUserId}...`);

        // 1. Get conversation key from IndexedDB (already decrypted for us)
        const conversationKey = await conversationKeyService.getConversationKey(channelId, 'channel');

        if (!conversationKey) {
            console.warn(`⚠️ [Key Distribution] No conversation key found, cannot distribute`);
            return;
        }

        // 2. Import new user's public key
        const publicKey = await crypto.subtle.importKey(
            'spki',
            Uint8Array.from(atob(newUserPublicKey), c => c.charCodeAt(0)),
            {
                name: 'RSA-OAEP',
                hash: 'SHA-256'
            },
            true,
            ['encrypt']
        );

        // 3. Export conversation key as raw bytes
        const conversationKeyRaw = await crypto.subtle.exportKey('raw', conversationKey);

        // 4. Encrypt conversation key with new user's public key
        const encryptedKey = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            conversationKeyRaw
        );

        // 5. Upload encrypted key to server
        const encryptedKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(encryptedKey)));

        await api.post(`/api/v2/conversations/${channelId}/keys`, {
            encryptedKey: encryptedKeyBase64,
            encryptedFor: newUserId,
            type: 'channel'
        });

        console.log(`✅ [Key Distribution] Key successfully distributed to user ${newUserId}`);
    } catch (error) {
        console.error(`❌ [Key Distribution] Failed to distribute key:`, error);
        // Don't throw - other members might succeed
    }
}

/**
 * Determine if this client should handle key distribution
 * Uses deterministic selection to avoid duplicate work
 * 
 * @param {Array<string>} memberIds - All channel member IDs
 * @param {string} currentUserId - Current user's ID
 * @returns {boolean}
 */
export function shouldDistributeKey(memberIds, currentUserId) {
    if (!memberIds || memberIds.length === 0) return false;

    // Sort member IDs for deterministic selection
    const sortedMembers = [...memberIds].sort();

    // First member (alphabetically) handles distribution
    const selectedDistributor = sortedMembers[0];

    const shouldDistribute = selectedDistributor === currentUserId;

    if (shouldDistribute) {
        console.log(`✅ [Key Distribution] This client selected as distributor`);
    } else {
        console.log(`⏭️ [Key Distribution] Another member will handle distribution`);
    }

    return shouldDistribute;
}

export default {
    distributeKeyToNewMember,
    shouldDistributeKey
};
