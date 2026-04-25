import api from './api';
import conversationKeyService from './conversationKeyService';

export async function handleKeyNeededEvent(payload, currentUserId) {
    const { channelId, newUserId, conversationType } = payload;

    try {
        
        if (newUserId === currentUserId) {
            return;
        }

        
        const conversationKey = await conversationKeyService.getConversationKey(channelId, conversationType);

        if (!conversationKey) {
            return;
        }

        
        const newUserPublicKeyData = await api.get(`/api/users/${newUserId}/public-key`);

        if (!newUserPublicKeyData?.data?.publicKey) {
            console.error(`🔐 [Key Distribution] Failed - no public key for user ${newUserId}`);
            return;
        }

        const { publicKey, algorithm } = newUserPublicKeyData.data;

        
        const conversationKeyBytes = await crypto.subtle.exportKey('raw', conversationKey);

        
        const encrypted = await encryptKeyForUser(
            conversationKeyBytes,
            publicKey,
            algorithm
        );

        
        await api.post(`/api/v2/conversations/${channelId}/keys/add-user`, {
            userId: newUserId,
            encryptedKey: encrypted.encryptedKey,
            ephemeralPublicKey: encrypted.ephemeralPublicKey,
            algorithm: encrypted.algorithm,
            conversationType
        });
    } catch (error) {
        console.error(`❌ [Key Distribution] Failed:`, error);
        
    }
}

async function encryptKeyForUser(keyBytes, publicKeyPem, algorithm) {
    if (algorithm === 'RSA-OAEP') {
        
        const pemHeader = "-----BEGIN PUBLIC KEY-----";
        const pemFooter = "-----END PUBLIC KEY-----";
        const pemContents = publicKeyPem
            .replace(pemHeader, "")
            .replace(pemFooter, "")
            .replace(/\s/g, "");

        const binaryDer = Buffer.from(pemContents, 'base64');

        const publicKey = await crypto.subtle.importKey(
            'spki',
            binaryDer,
            { name: 'RSA-OAEP', hash: 'SHA-256' },
            true,
            ['encrypt']
        );

        
        const encrypted = await crypto.subtle.encrypt(
            { name: 'RSA-OAEP' },
            publicKey,
            keyBytes
        );

        return {
            encryptedKey: Buffer.from(encrypted).toString('base64'),
            ephemeralPublicKey: undefined, 
            algorithm: 'RSA-OAEP'
        };
    } else {
        
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }
}
