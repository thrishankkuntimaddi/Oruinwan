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
        console.error('Failed to wrap key for user:', error);
        throw new Error('Key wrapping failed');
    }
}

module.exports = {
    unwrapWithServerKEK,
    encryptWithWorkspaceKey,
    wrapForUser
};
