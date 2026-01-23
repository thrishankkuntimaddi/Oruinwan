// server/src/modules/conversations/serverKEK.crypto.js
// Server-side Key Encryption Key (KEK) utilities
// Used to encrypt/decrypt workspace master keys

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

/**
 * Get server KEK from environment
 * @returns {Buffer} KEK as buffer
 */
function getServerKEK() {
    const kekHex = process.env.SERVER_KEK;

    if (!kekHex || kekHex.length !== 64) { // 32 bytes = 64 hex chars
        throw new Error('SERVER_KEK not configured or invalid (must be 32 bytes hex)');
    }

    return Buffer.from(kekHex, 'hex');
}

/**
 * Encrypt workspace key with server KEK
 * @param {Buffer} workspaceKeyBytes - Plaintext workspace key
 * @returns {Object} { encryptedKey, iv, authTag } all as base64
 */
function encryptWorkspaceKeyWithKEK(workspaceKeyBytes) {
    const kek = getServerKEK();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, kek, iv);

    const encrypted = Buffer.concat([
        cipher.update(workspaceKeyBytes),
        cipher.final()
    ]);

    const authTag = cipher.getAuthTag();

    return {
        encryptedKey: encrypted.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
    };
}

/**
 * Decrypt workspace key with server KEK
 * @param {String} encryptedKeyB64 - Encrypted workspace key (base64)
 * @param {String} ivB64 - IV (base64)
 * @param {String} authTagB64 - Auth tag (base64)
 * @returns {Buffer} Decrypted workspace key bytes
 */
function decryptWorkspaceKeyWithKEK(encryptedKeyB64, ivB64, authTagB64) {
    const kek = getServerKEK();
    const encryptedKey = Buffer.from(encryptedKeyB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
        decipher.update(encryptedKey),
        decipher.final()
    ]);

    return decrypted;
}

module.exports = {
    encryptWorkspaceKeyWithKEK,
    decryptWorkspaceKeyWithKEK,
    getServerKEK
};
