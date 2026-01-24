/**
 * Message Encryption Service
 * 
 * Handles encryption/decryption of messages using conversation/thread keys
 * Integrates with conversation key service and thread key derivation
 */

import { deriveThreadKey, generateIV } from '../utils/crypto';
import conversationKeyService from './conversationKeyService';

// ==================== MESSAGE ENCRYPTION ====================

/**
 * Encrypt message for sending
 * Uses conversation key for channel/DM messages
 * Uses derived thread key for thread replies
 * 
 * @param {string} plaintext - Message text to encrypt
 * @param {string} conversationId - Channel/DM ID
 * @param {string} conversationType - 'channel' or 'dm'
 * @param {string|null} parentMessageId - Parent message ID if this is a thread reply
 * @returns {Promise<{ciphertext: string, messageIv: string, isEncrypted: boolean}>}
 */
export async function encryptMessageForSending(plaintext, conversationId, conversationType, parentMessageId = null) {
    try {
        console.log(`🔐 Encrypting message for ${conversationType}:${conversationId}${parentMessageId ? ` (thread:${parentMessageId})` : ''}...`);

        // Get conversation key
        let encryptionKey = await conversationKeyService.getConversationKey(conversationId, conversationType);

        if (!encryptionKey) {
            throw new Error(`No conversation key found for ${conversationType}:${conversationId}`);
        }

        // If this is a thread reply, derive thread-specific key
        if (parentMessageId) {
            console.log(`🔑 Deriving thread key for parent message ${parentMessageId}...`);
            encryptionKey = await deriveThreadKey(encryptionKey, parentMessageId);
        }

        // Generate random IV
        const iv = generateIV();

        // Encrypt message
        const plaintextBytes = new TextEncoder().encode(plaintext);
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv,
                tagLength: 128
            },
            encryptionKey,
            plaintextBytes
        );

        // Convert to base64 for transmission
        const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
        const ivBase64 = btoa(String.fromCharCode(...new Uint8Array(iv)));

        console.log(`✅ Message encrypted successfully`);

        return {
            ciphertext: ciphertextBase64,
            messageIv: ivBase64,
            isEncrypted: true
        };
    } catch (error) {
        console.error('Message encryption failed:', error);
        throw error;
    }
}

// ==================== MESSAGE DECRYPTION ====================

/**
 * Decrypt received message
 * Uses conversation key for channel/DM messages
 * Uses derived thread key for thread replies
 * 
 * @param {string} ciphertextBase64 - Base64-encoded ciphertext
 * @param {string} ivBase64 - Base64-encoded IV
 * @param {string} conversationId - Channel/DM ID
 * @param {string} conversationType - 'channel' or 'dm'
 * @param {string|null} parentMessageId - Parent message ID if this is a thread reply
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptReceivedMessage(ciphertextBase64, ivBase64, conversationId, conversationType, parentMessageId = null) {
    try {
        // Get conversation key
        // ✅ PHASE 0: Let BROKEN_CHANNEL error propagate instead of returning fallback text
        let decryptionKey = await conversationKeyService.getConversationKey(conversationId, conversationType);

        if (!decryptionKey) {
            // This should trigger BROKEN_CHANNEL error in conversationKeyService
            throw new Error(`BROKEN_CHANNEL: No encryption key available for ${conversationType}:${conversationId}`);
        }

        // If this is a thread reply, derive thread-specific key
        if (parentMessageId) {
            decryptionKey = await deriveThreadKey(decryptionKey, parentMessageId);
        }

        // Decode from base64
        const ciphertext = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

        // Decrypt message
        const plaintextBytes = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
                tagLength: 128
            },
            decryptionKey,
            ciphertext
        );

        // Convert to string
        const plaintext = new TextDecoder().decode(plaintextBytes);

        return plaintext;
    } catch (error) {
        console.error('Message decryption failed:', error);
        // Don't expose error details to user
        return '🔒 Unable to decrypt message';
    }
}

// ==================== GRACEFUL DEGRADATION ====================

/**
 * Attempt to decrypt message with graceful fallback
 * Shows encrypted indicator if decryption fails
 * 
 * @param {Object} message - Message object with encrypted payload
 * @param {string} conversationId - Channel/DM ID
 * @param {string} conversationType - 'channel' or 'dm'
 * @returns {Promise<string>} Decrypted text or encrypted indicator
 */
export async function decryptMessageGracefully(message, conversationId, conversationType) {
    try {
        const { payload, parentId } = message;

        if (!payload || !payload.ciphertext || !payload.messageIv) {
            return '⚠️ Invalid message format';
        }

        return await decryptReceivedMessage(
            payload.ciphertext,
            payload.messageIv,
            conversationId,
            conversationType,
            parentId
        );
    } catch (error) {
        console.error('Graceful decryption failed:', error);
        return '🔒 Encrypted message';
    }
}

// ==================== BATCH DECRYPTION ====================

/**
 * Decrypt multiple messages efficiently
 * Pre-fetches conversation key to avoid repeated lookups
 * 
 * @param {Array} messages - Array of encrypted message objects
 * @param {string} conversationId - Channel/DM ID
 * @param {string} conversationType - 'channel' or 'dm'
 * @returns {Promise<Array>} Array of messages with decrypted content
 */
export async function batchDecryptMessages(messages, conversationId, conversationType) {
    try {
        console.log(`🔐 [Batch Decrypt] Starting for ${messages.length} messages in ${conversationType}:${conversationId}`);

        // Pre-fetch conversation key once
        // ✅ PHASE 0: Throw error instead of returning fallback text
        const conversationKey = await conversationKeyService.getConversationKey(conversationId, conversationType);

        if (!conversationKey) {
            throw new Error(`BROKEN_CHANNEL: No encryption key available for ${conversationType}:${conversationId}`);
        }

        console.log(`✅ [Batch Decrypt] Got conversation key, decrypting ${messages.length} messages...`);

        // Decrypt each message
        const decrypted = await Promise.all(
            messages.map(async (message) => {
                try {
                    // Handle nested payload structure from Message model
                    // Server stores encryption data in payload.payload.{ciphertext, messageIv}
                    const encryptionPayload = message.payload?.payload || message.payload || message;
                    const { ciphertext, messageIv } = encryptionPayload;
                    const { parentId } = message;

                    if (!ciphertext || !messageIv) {
                        console.warn(`⚠️ [Batch Decrypt] Invalid message format for ${message.id}:`, {
                            hasPayload: !!message.payload,
                            hasNestedPayload: !!message.payload?.payload,
                            hasCiphertext: !!ciphertext,
                            hasIv: !!messageIv,
                            payloadKeys: Object.keys(message.payload || {}),
                            nestedKeys: Object.keys(message.payload?.payload || {})
                        });
                        return {
                            ...message,
                            decryptedContent: '⚠️ Invalid message format'
                        };
                    }

                    // Use conversation key or derived thread key
                    let decryptionKey = conversationKey;
                    if (parentId) {
                        decryptionKey = await deriveThreadKey(conversationKey, parentId);
                    }

                    // Decode
                    const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
                    const iv = Uint8Array.from(atob(messageIv), c => c.charCodeAt(0));

                    // Decrypt
                    const plaintextBytes = await crypto.subtle.decrypt(
                        {
                            name: 'AES-GCM',
                            iv: iv,
                            tagLength: 128
                        },
                        decryptionKey,
                        ciphertextBytes
                    );

                    const plaintext = new TextDecoder().decode(plaintextBytes);

                    console.log(`✅ [Batch Decrypt] Decrypted message ${message.id}: "${plaintext.substring(0, 30)}..."`);

                    return {
                        ...message,
                        decryptedContent: plaintext
                    };
                } catch (error) {
                    console.error(`❌ [Batch Decrypt] Failed to decrypt message ${message.id}:`, error);
                    return {
                        ...message,
                        decryptedContent: '🔒 Unable to decrypt message'
                    };
                }
            })
        );

        console.log(`✅ [Batch Decrypt] Completed ${decrypted.length} messages`);
        return decrypted;
    } catch (error) {
        console.error('❌ [Batch Decrypt] Batch decryption failed:', error);
        // ✅ PHASE 0: Throw error instead of returning fallback messages
        // This allows UI to detect broken channel state
        throw error;
    }
}

// ==================== EXPORTS ====================

const messageEncryptionService = {
    encryptMessageForSending,
    decryptReceivedMessage,
    decryptMessageGracefully,
    batchDecryptMessages
};

export default messageEncryptionService;
