// client/src/modules/chat/encryption/chatEncryption.js
/**
 * Chat Encryption Helper
 * 
 * Provides E2EE encryption/decryption for chat messages
 * This is a wrapper around the core crypto utilities
 * 
 * @module chat/encryption
 */

import {
    encryptMessage,
    decryptMessage,
    generateWorkspaceKey,
    deriveKeyFromPassword,
    generateSalt,
    exportKey,
    importKey,
    arrayBufferToBase64,
    base64ToArrayBuffer,
    validateCryptoSetup
} from '../../../utils/crypto';

/**
 * Chat Encryption Manager
 * Handles message encryption/decryption with workspace keys
 */
class ChatEncryptionManager {
    constructor() {
        this.workspaceKeys = new Map(); // workspaceId -> CryptoKey
        this.isReady = false;
        this.init();
    }

    /**
     * Initialize encryption support
     */
    async init() {
        try {
            validateCryptoSetup();
            this.isReady = true;
        } catch (error) {
            console.error('❌ Chat encryption not available:', error);
            this.isReady = false;
        }
    }

    /**
     * Check if encryption is available
     */
    canEncrypt() {
        return this.isReady;
    }

    /**
     * Set workspace key for encryption
     * 
     * @param {String} workspaceId - Workspace ID
     * @param {CryptoKey} key - AES-GCM workspace key
     */
    setWorkspaceKey(workspaceId, key) {
        this.workspaceKeys.set(workspaceId, key);
    }

    /**
     * Get workspace key
     * 
     * @param {String} workspaceId - Workspace ID
     * @returns {CryptoKey|null} Workspace key or null
     */
    getWorkspaceKey(workspaceId) {
        return this.workspaceKeys.get(workspaceId) || null;
    }

    /**
     * Encrypt a message for sending
     * 
     * @param {String} plaintext - Message text to encrypt
     * @param {String} workspaceId - Workspace ID
     * @returns {Promise<{ciphertext: string, messageIv: string}>}
     */
    async encryptMessageForSending(plaintext, workspaceId) {
        if (!this.canEncrypt()) {
            throw new Error('Encryption not available');
        }

        const workspaceKey = this.getWorkspaceKey(workspaceId);
        if (!workspaceKey) {
            throw new Error(`No workspace key found for: ${workspaceId}`);
        }

        try {
            const { ciphertext, iv } = await encryptMessage(plaintext, workspaceKey);

            return {
                ciphertext,
                messageIv: iv
            };
        } catch (error) {
            console.error('Message encryption failed:', error);
            throw error;
        }
    }

    /**
     * Decrypt a received message
     * 
     * @param {String} ciphertext - Base64 encrypted message
     * @param {String} messageIv - Base64 IV
     * @param {String} workspaceId - Workspace ID
     * @returns {Promise<String>} Decrypted plaintext
     */
    async decryptReceivedMessage(ciphertext, messageIv, workspaceId) {
        if (!this.canEncrypt()) {
            throw new Error('Decryption not available');
        }

        const workspaceKey = this.getWorkspaceKey(workspaceId);
        if (!workspaceKey) {
            throw new Error(`No workspace key found for: ${workspaceId}`);
        }

        try {
            const plaintext = await decryptMessage(ciphertext, messageIv, workspaceKey);
            return plaintext;
        } catch (error) {
            console.error('Message decryption failed:', error);
            throw error;
        }
    }

    /**
     * Clear workspace key (e.g., on logout or workspace switch)
     * 
     * @param {String} workspaceId - Workspace ID
     */
    clearWorkspaceKey(workspaceId) {
        this.workspaceKeys.delete(workspaceId);
    }

    /**
     * Clear all keys
     */
    clearAllKeys() {
        this.workspaceKeys.clear();
    }
}

// Singleton instance
const chatEncryption = new ChatEncryptionManager();

export default chatEncryption;

// Named exports for convenience
export {
    chatEncryption,
    generateWorkspaceKey,
    deriveKeyFromPassword,
    generateSalt,
    exportKey,
    importKey,
    arrayBufferToBase64,
    base64ToArrayBuffer
};
