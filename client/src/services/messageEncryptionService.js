import { deriveThreadKey, generateIV } from '../utils/crypto';
import conversationKeyService from './conversationKeyService';

export async function encryptMessageForSending(plaintext, conversationId, conversationType, parentMessageId = null) {
    try {
        
        let encryptionKey = await conversationKeyService.getConversationKey(conversationId, conversationType);

        if (!encryptionKey) {
            throw new Error(`No conversation key found for ${conversationType}:${conversationId}`);
        }

        
        if (parentMessageId) {
            encryptionKey = await deriveThreadKey(encryptionKey, parentMessageId);
        }

        
        
        if (!(encryptionKey instanceof CryptoKey)) {
            console.warn('⚠️ [Encryption Guard] Key not ready, blocking send');
            return { status: 'ENCRYPTION_NOT_READY' };
        }

        
        const iv = generateIV();

        
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

        
        const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
        const ivBase64 = btoa(String.fromCharCode(...new Uint8Array(iv)));

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

export async function decryptReceivedMessage(ciphertextBase64, ivBase64, conversationId, conversationType, parentMessageId = null) {
    try {
        
        
        let decryptionKey = await conversationKeyService.getConversationKey(conversationId, conversationType);

        if (!decryptionKey) {
            
            throw new Error(`BROKEN_CHANNEL: No encryption key available for ${conversationType}:${conversationId}`);
        }

        
        if (parentMessageId) {
            decryptionKey = await deriveThreadKey(decryptionKey, parentMessageId);
        }

        
        const ciphertext = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

        
        const plaintextBytes = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv,
                tagLength: 128
            },
            decryptionKey,
            ciphertext
        );

        
        const plaintext = new TextDecoder().decode(plaintextBytes);

        return plaintext;
    } catch (error) {
        console.error('Message decryption failed:', error);
        
        return '🔒 Unable to decrypt message';
    }
}

export async function decryptMessageGracefully(message, conversationId, conversationType) {
    try {
        
        if (message.type === 'system') {
            return message.systemData?.text || message.text || '';
        }

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

export async function batchDecryptMessages(messages, conversationId, conversationType, userJoinedAt = null) {
    try {
        
        if (!messages || messages.length === 0) {
            return [];
        }

        
        let messagesToDecrypt = messages;
        if (userJoinedAt) {
            const joinTimestamp = new Date(userJoinedAt).getTime();
            messagesToDecrypt = messages.filter(msg => {
                const msgTimestamp = new Date(msg.createdAt).getTime();
                return msgTimestamp >= joinTimestamp;
            });

            if (messagesToDecrypt.length === 0) {
                return [];
            }
        }

        
        const conversationKey = await conversationKeyService.getConversationKey(conversationId, conversationType);

        if (!conversationKey) {
            
            console.warn('⚠️ [Batch Decrypt] No conversation key found - returning empty array');
            return [];
        }

        
        const decrypted = await Promise.all(
            messagesToDecrypt.map(async (message) => {
                try {
                    
                    if (message.type === 'system') {
                        return { ...message, decryptedContent: null, isSystem: true };
                    }

                    
                    
                    const NON_ENCRYPTED_TYPES = ['poll', 'image', 'video', 'file', 'voice', 'contact', 'meeting'];
                    if (NON_ENCRYPTED_TYPES.includes(message.type)) {
                        return { ...message, isDecryptable: false };
                    }

                    
                    
                    const encryptionPayload = message.payload?.payload || message.payload || message;
                    const { ciphertext, messageIv } = encryptionPayload;
                    const { parentId } = message;

                    if (!ciphertext || !messageIv) {
                        
                        
                        console.warn(`⚠️ [Batch Decrypt] No ciphertext for message ${message.id} (type=${message.type}) — passing through`);
                        return {
                            ...message,
                            decryptedContent: message.payload?.text || message.text || null,
                            isDecryptable: false
                        };
                    }

                    
                    let decryptionKey = conversationKey;
                    
                    
                    if (parentId && message.isThreadEncrypted === true) {
                        decryptionKey = await deriveThreadKey(conversationKey, parentId);
                    }

                    
                    const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
                    const iv = Uint8Array.from(atob(messageIv), c => c.charCodeAt(0));

                    
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

                    return {
                        ...message,
                        decryptedContent: plaintext,
                        isDecryptable: true
                    };
                } catch (error) {
                    console.error(`❌ [Batch Decrypt] Failed to decrypt message ${message.id}:`, error);
                    return {
                        ...message,
                        decryptedContent: '🔒 Unable to decrypt message',
                        isDecryptable: false
                    };
                }
            })
        );

        return decrypted;
    } catch (error) {
        console.error('❌ [Batch Decrypt] Batch decryption failed:', error);
        
        return messages.map(message => ({
            ...message,
            decryptedContent: '⚠️ Decryption failed',
            isDecryptable: false
        }));
    }
}

const messageEncryptionService = {
    encryptMessageForSending,
    decryptReceivedMessage,
    decryptMessageGracefully,
    batchDecryptMessages
};

export default messageEncryptionService;
