const logger = require('../../../utils/logger');
const crypto = require('crypto');

function unwrapWithServerKEK(encryptedKey, iv, authTag) {
    const serverKEK = Buffer.from(process.env.SERVER_KEK, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', serverKEK, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    let decrypted = decipher.update(Buffer.from(encryptedKey, 'base64'));
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
}

function encryptWithWorkspaceKey(conversationKeyBytes, _workspaceId) {
    
    
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

function wrapForUser(conversationKeyBytes, userPublicKeyPem) {
    try {
        
        
        
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
            algorithm: 'RSA-2048'  
        };
    } catch (error) {
        logger.error('Failed to wrap key for user:', error);
        throw new Error('Key wrapping failed');
    }
}

/**
 * Encrypt plaintext for a conversation the way the web client does
 * (AES-256-GCM, 12-byte IV, auth tag appended to the ciphertext, base64), using
 * the conversation key the server holds wrapped under SERVER_KEK. Used for
 * messages the assistant sends on a user's behalf, so they stay E2EE on the
 * wire and readable by every member.
 */
async function encryptForConversation(conversationId, conversationType, plaintext) {
    const { conversationKeyDocs } = require('../../identity/queries/auth');
    const doc = await conversationKeyDocs.findByConversation(conversationId, conversationType);
    if (!doc || !doc.workspaceEncryptedKey) {
        throw new Error('Conversation key unavailable for server-side encryption');
    }
    const key = unwrapWithServerKEK(doc.workspaceEncryptedKey, doc.workspaceKeyIv, doc.workspaceKeyAuthTag);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(Buffer.from(String(plaintext), 'utf8')), cipher.final(), cipher.getAuthTag()]);
    return { ciphertext: encrypted.toString('base64'), messageIv: iv.toString('base64') };
}

/** Wrap a secret (e.g. a workspace's AI API key) under SERVER_KEK for storage. */
function sealSecret(plaintext) {
    const { ciphertext, iv, authTag } = encryptWithWorkspaceKey(Buffer.from(String(plaintext), 'utf8'));
    return `enc:v1:${ciphertext}:${iv}:${authTag}`;
}

function openSecret(sealed) {
    if (typeof sealed !== 'string' || !sealed.startsWith('enc:v1:')) return sealed;
    const [, , ciphertext, iv, authTag] = sealed.split(':');
    return unwrapWithServerKEK(ciphertext, iv, authTag).toString('utf8');
}

module.exports = {
    unwrapWithServerKEK,
    encryptWithWorkspaceKey,
    wrapForUser,
    encryptForConversation,
    sealSecret,
    openSecret,
};
