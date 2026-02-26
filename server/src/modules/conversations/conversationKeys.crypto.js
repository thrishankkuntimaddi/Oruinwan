/**
 * Conversation Keys Cryptography Module
 * 
 * Server-side cryptographic operations for conversation key re-encryption
 * CRITICAL: Server never sees plaintext conversation keys or workspace keys
 * All operations happen in-memory and keys are immediately discarded
 */

const crypto = require('crypto');
const UserIdentityKey = require('../../../models/UserIdentityKey');

// ==================== WORKSPACE KEY DECRYPTION ====================

/**
 * Unwrap (decrypt) conversation key using workspace master key
 * 
 * @param {string} encryptedKey - Base64-encoded encrypted conversation key
 * @param {string} iv - Base64-encoded IV
 * @param {string} authTag - Base64-encoded authentication tag
 * @param {Buffer} workspaceKey - Raw workspace master key bytes
 * @returns {Buffer} Decrypted conversation key bytes
 */
function unwrapConversationKeyWithWorkspaceKey(encryptedKey, iv, authTag, workspaceKey) {
    try {
        // Decode from base64
        const ciphertext = Buffer.from(encryptedKey, 'base64');
        const ivBuffer = Buffer.from(iv, 'base64');
        const authTagBuffer = Buffer.from(authTag, 'base64');

        // Create decipher
        const decipher = crypto.createDecipheriv('aes-256-gcm', workspaceKey, ivBuffer);
        decipher.setAuthTag(authTagBuffer);

        // Decrypt
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        console.log('✅ Unwrapped conversation key with workspace key');
        return decrypted;
    } catch (error) {
        console.error('Failed to unwrap conversation key:', error);
        throw new Error('Conversation key decryption failed');
    }
}

// ==================== USER KEY ENCRYPTION ====================

/**
 * Wrap (encrypt) conversation key for a specific user
 * Supports both RSA-2048 and X25519 algorithms
 * 
 * @param {Buffer} conversationKeyBytes - Raw conversation key bytes
 * @param {string} userPublicKey - User's public key (PEM or base64)
 * @param {string} algorithm - 'RSA-2048' or 'X25519'
 * @returns {Promise<{encryptedKey: string, ephemeralPublicKey?: string}>}
 */
async function wrapConversationKeyForUser(conversationKeyBytes, userPublicKey, algorithm) {
    try {
        if (algorithm === 'RSA-2048') {
            return await wrapWithRSA(conversationKeyBytes, userPublicKey);
        } else if (algorithm === 'X25519') {
            return await wrapWithX25519(conversationKeyBytes, userPublicKey);
        } else {
            throw new Error(`Unsupported algorithm: ${algorithm}`);
        }
    } catch (error) {
        console.error('Failed to wrap conversation key for user:', error);
        throw error;
    }
}

/**
 * Wrap key using RSA-OAEP
 * 
 * @param {Buffer} keyBytes - Key to encrypt
 * @param {string} publicKeyPem - RSA public key in PEM format
 * @returns {Promise<{encryptedKey: string}>}
 */
async function wrapWithRSA(keyBytes, publicKeyPem) {
    try {
        const publicKey = crypto.createPublicKey(publicKeyPem);

        const encrypted = crypto.publicEncrypt(
            {
                key: publicKey,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            keyBytes
        );

        return {
            encryptedKey: encrypted.toString('base64')
        };
    } catch (error) {
        console.error('RSA encryption failed:', error);
        throw error;
    }
}

/**
 * Wrap key using X25519 ECIES
 * 
 * @param {Buffer} keyBytes - Key to encrypt
 * @param {string} publicKeyBase64 - X25519 public key in base64
 * @returns {Promise<{encryptedKey: string, ephemeralPublicKey: string}>}
 */
async function wrapWithX25519(keyBytes, publicKeyBase64) {
    try {
        // Generate ephemeral X25519 key pair
        const { publicKey: ephemeralPublic, privateKey: ephemeralPrivate } =
            crypto.generateKeyPairSync('x25519');

        // Derive shared secret using ECDH
        const recipientPublicKey = crypto.createPublicKey({
            key: Buffer.from(publicKeyBase64, 'base64'),
            format: 'der',
            type: 'spki'
        });

        const sharedSecret = crypto.diffieHellman({
            privateKey: ephemeralPrivate,
            publicKey: recipientPublicKey
        });

        // Derive encryption key from shared secret using HKDF
        const encryptionKey = crypto.hkdfSync(
            'sha256',
            sharedSecret,
            Buffer.alloc(0), // salt
            Buffer.from('conversation-key-wrap'), // info
            32 // keylen (256 bits)
        );

        // Encrypt with AES-256-GCM
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

        let encrypted = cipher.update(keyBytes);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Combine IV + ciphertext + authTag
        const combined = Buffer.concat([iv, encrypted, authTag]);

        // Export ephemeral public key
        const ephemeralPublicExport = ephemeralPublic.export({ type: 'spki', format: 'der' });

        return {
            encryptedKey: combined.toString('base64'),
            ephemeralPublicKey: ephemeralPublicExport.toString('base64')
        };
    } catch (error) {
        console.error('X25519 encryption failed:', error);
        throw error;
    }
}

// ==================== USER PUBLIC KEY FETCHING ====================

/**
 * Fetch user's public identity key from database
 * 
 * @param {string} userId - User ID
 * @returns {Promise<{publicKey: string, algorithm: string}>}
 */
async function getUserPublicKey(userId) {
    try {
        const identityKey = await UserIdentityKey.findOne({ userId, isActive: true });

        if (!identityKey) {
            throw new Error(`No identity key found for user ${userId}`);
        }

        return {
            publicKey: identityKey.publicKey,
            algorithm: identityKey.algorithm
        };
    } catch (error) {
        console.error('Failed to fetch user public key:', error);
        throw error;
    }
}

// ==================== EXPORTS ====================

module.exports = {
    unwrapConversationKeyWithWorkspaceKey,
    wrapConversationKeyForUser,
    getUserPublicKey
};
