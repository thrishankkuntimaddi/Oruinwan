/**
 * Conversation Keys Service - Server-side E2EE Bootstrap
 * 
 * CRITICAL: Server-side crypto utilities for workspace key bootstrapping ONLY
 * These functions are used ONLY for default channel initialization during workspace creation
 */

const crypto = require('crypto');

/**
 * Unwrap workspace-encrypted key using SERVER_KEK
 * @param {String} encryptedKey - Base64 encoded ciphertext
 * @param {String} iv - Base64 encoded IV
 * @param {String} authTag - Base64 encoded auth tag
 * @returns {Buffer} Decrypted conversation key
 */
function unwrapWithServerKEK(encryptedKey, iv, authTag) {
    const serverKEK = Buffer.from(process.env.SERVER_KEK, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', serverKEK, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    let decrypted = decipher.update(Buffer.from(encryptedKey, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
}

/**
 * Wrap conversation key with workspace master key using SERVER_KEK
 * @param {Buffer} conversationKeyBytes - Raw conversation key bytes
 * @param {String} workspaceEncryptedKey - Workspace key encrypted for creator
 * @param {String} workspaceKeyIv - IV for workspace key
 * @param {String} workspaceKeyAuthTag - Auth tag for workspace key  
 * @returns {Object} { ciphertext, iv, authTag } all base64
 */
function encryptWithWorkspaceKey(conversationKeyBytes, workspaceId) {
    // For default channels, we use SERVER_KEK directly as the workspace key wrapper
    // This is acceptable ONLY for server-side bootstrap of default channels
    const serverKEK = Buffer.from(process.env.SERVER_KEK, 'hex');

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', serverKEK, iv);

    let encrypted = cipher.update(conversationKeyBytes);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
        ciphertext: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
    };
}

/**
 * Wrap conversation key for user's public key (RSA-OAEP)
 * @param {Buffer} conversationKeyBytes - Raw conversation key
 * @param {String} userPublicKeyPem - User's RSA public key in PEM format
 * @returns {Object} { encryptedKey, algorithm }
 */
function wrapForUser(conversationKeyBytes, userPublicKeyPem) {
    try {
        // FIX: The client exports keys in SPKI format but incorrectly labels them "RSA PUBLIC KEY"
        // Node's crypto expects "PUBLIC KEY" header for SPKI data
        // We normalize the header here to avoid "asn1 encoding routines::wrong tag" errors
        let sanePem = userPublicKeyPem;
        if (userPublicKeyPem.includes('BEGIN RSA PUBLIC KEY')) {
            sanePem = userPublicKeyPem
                .replace('BEGIN RSA PUBLIC KEY', 'BEGIN PUBLIC KEY')
                .replace('END RSA PUBLIC KEY', 'END PUBLIC KEY');
        }

        const encryptedKey = crypto.publicEncrypt(
            {
                key: sanePem,
                padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                oaepHash: 'sha256'
            },
            conversationKeyBytes
        );

        return {
            encryptedKey: encryptedKey.toString('base64'),
            algorithm: 'RSA-2048'  // Must match ConversationKey schema enum
        };
    } catch (error) {
        console.error('Failed to wrap key for user:', error);
        throw new Error('Key wrapping failed');
    }
}

module.exports = {
    unwrapWithServerKEK,
    encryptWithWorkspaceKey,
    wrapForUser
};
