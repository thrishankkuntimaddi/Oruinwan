const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; 
const _AUTH_TAG_LENGTH = 16;

function getServerKEK() {
    const kekHex = process.env.SERVER_KEK;

    if (!kekHex || kekHex.length !== 64) { 
        throw new Error('SERVER_KEK not configured or invalid (must be 32 bytes hex)');
    }

    return Buffer.from(kekHex, 'hex');
}

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
