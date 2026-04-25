const crypto = require('crypto');
const UserIdentityKey = require('../../../models/UserIdentityKey');

function unwrapConversationKeyWithWorkspaceKey(encryptedKey, iv, authTag, workspaceKey) {
    try {
        
        const ciphertext = Buffer.from(encryptedKey, 'base64');
        const ivBuffer = Buffer.from(iv, 'base64');
        const authTagBuffer = Buffer.from(authTag, 'base64');

        
        const decipher = crypto.createDecipheriv('aes-256-gcm', workspaceKey, ivBuffer);
        decipher.setAuthTag(authTagBuffer);

        
        let decrypted = decipher.update(ciphertext);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        console.log('✅ Unwrapped conversation key with workspace key');
        return decrypted;
    } catch (error) {
        console.error('Failed to unwrap conversation key:', error);
        throw new Error('Conversation key decryption failed');
    }
}

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

async function wrapWithX25519(keyBytes, publicKeyBase64) {
    try {
        
        const { publicKey: ephemeralPublic, privateKey: ephemeralPrivate } =
            crypto.generateKeyPairSync('x25519');

        
        const recipientPublicKey = crypto.createPublicKey({
            key: Buffer.from(publicKeyBase64, 'base64'),
            format: 'der',
            type: 'spki'
        });

        const sharedSecret = crypto.diffieHellman({
            privateKey: ephemeralPrivate,
            publicKey: recipientPublicKey
        });

        
        const encryptionKey = crypto.hkdfSync(
            'sha256',
            sharedSecret,
            Buffer.alloc(0), 
            Buffer.from('conversation-key-wrap'), 
            32 
        );

        
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);

        let encrypted = cipher.update(keyBytes);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        const authTag = cipher.getAuthTag();

        
        const combined = Buffer.concat([iv, encrypted, authTag]);

        
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

module.exports = {
    unwrapConversationKeyWithWorkspaceKey,
    wrapConversationKeyForUser,
    getUserPublicKey
};
