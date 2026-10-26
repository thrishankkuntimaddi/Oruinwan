import { deriveThreadKey, generateIV } from '../utils/crypto';
import conversationKeyService from './conversationKeyService';
import logger from '../utils/logger';
import { rememberKeyVersion as rememberVersion } from './keyVersions';

export { keyVersionOf } from './keyVersions';

/*
 * Conversation keys have versions: a group that adds someone "from now on", or removes someone,
 * gets a new key (server: conversations/keyEpochs.js). Messages are encrypted with the current
 * key and record its version (services/keyVersions.js adds it to requests); older messages open
 * with the earlier keys I hold.
 */
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function openWith(keys, ciphertextBase64, ivBase64, parentMessageId) {
    const ciphertext = b64(ciphertextBase64);
    const iv = b64(ivBase64);
    let lastErr = new Error('No key opens this message');
    for (const k of keys) {
        try {
            const key = parentMessageId ? await deriveThreadKey(k, parentMessageId) : k;
            const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ciphertext);
            return new TextDecoder().decode(plain);
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr;
}

/**
 * Plaintext of `{ ciphertext, iv }` with any key of the conversation I hold (the one named by
 * `keyVersion` first). When none opens it, the keys are fetched once more in case the
 * conversation got a new key since (at most once a minute). Throws when it can't be opened.
 */
export async function decryptWithConversationKeys(ciphertextBase64, ivBase64, conversationId, conversationType, { parentMessageId = null, keyVersion = null } = {}) {
    const keys = await conversationKeyService.getDecryptionKeys(conversationId, conversationType, keyVersion);
    if (!keys.length) throw Object.assign(new Error(`No encryption key available for ${conversationType}:${conversationId}`), { code: 'KEY_UNAVAILABLE' });
    try {
        return await openWith(keys, ciphertextBase64, ivBase64, parentMessageId);
    } catch (err) {
        if (!(await conversationKeyService.refreshIfStale(conversationId, conversationType))) throw err;
        const fresh = await conversationKeyService.getDecryptionKeys(conversationId, conversationType, keyVersion);
        return openWith(fresh, ciphertextBase64, ivBase64, parentMessageId);
    }
}

export async function encryptMessageForSending(plaintext, conversationId, conversationType, parentMessageId = null) {
    try {
        
        let encryptionKey = await conversationKeyService.getConversationKey(conversationId, conversationType);

        // getConversationKey returns a status object (not a key) when access is
        // missing; never let that reach the network as an empty ciphertext.
        if (!(encryptionKey instanceof CryptoKey)) {
            const reason = encryptionKey?.message
                || `No conversation key found for ${conversationType}:${conversationId}`;
            const err = new Error(reason);
            err.code = encryptionKey?.status || 'KEY_NOT_AVAILABLE';
            throw err;
        }

        if (parentMessageId) {
            encryptionKey = await deriveThreadKey(encryptionKey, parentMessageId);
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
        const keyVersion = conversationKeyService.getCurrentVersion(conversationId, conversationType);
        rememberVersion(ciphertextBase64, keyVersion);

        return {
            ciphertext: ciphertextBase64,
            messageIv: ivBase64,
            isEncrypted: true,
            keyVersion
        };
    } catch (error) {
        logger.error('Message encryption failed:', error);
        throw error;
    }
}

export async function decryptReceivedMessage(ciphertextBase64, ivBase64, conversationId, conversationType, parentMessageId = null, keyVersion = null) {
    try {
        return await decryptWithConversationKeys(ciphertextBase64, ivBase64, conversationId, conversationType, { parentMessageId, keyVersion });
    } catch (error) {
        logger.error('Message decryption failed:', error);
        return '🔒 Unable to decrypt message';
    }
}

/**
 * Decrypt one `{ ciphertext, messageIv }` with the conversation key.
 * Unlike decryptReceivedMessage this never returns a placeholder string:
 * it resolves to the plaintext, or `null` when decryption is impossible.
 */
export async function decryptTextOrNull(ciphertextBase64, ivBase64, conversationId, conversationType, parentMessageId = null, keyVersion = null) {
    if (!ciphertextBase64 || !ivBase64 || !conversationId) return null;
    try {
        return await decryptWithConversationKeys(ciphertextBase64, ivBase64, conversationId, conversationType, { parentMessageId, keyVersion });
    } catch (error) {
        logger.warn('decryptTextOrNull failed:', error?.message);
        return null;
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
            parentId,
            payload.keyVersion ?? null
        );
    } catch (error) {
        logger.error('Graceful decryption failed:', error);
        return '🔒 Encrypted message';
    }
}

export const ENCRYPTED_KEY_UNAVAILABLE_PLACEHOLDER = '[Encrypted message — key unavailable]';

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

        
        let conversationKey = null;
        try {
            conversationKey = await conversationKeyService.getConversationKey(conversationId, conversationType);
        } catch (keyErr) {
            logger.warn('⚠️ [Batch Decrypt] Conversation key fetch failed:', keyErr?.message);
        }

        if (!(conversationKey instanceof CryptoKey)) {
            // Keep every message: non-encrypted ones (system/poll/file/...) render
            // normally, encrypted ones get a placeholder instead of being dropped.
            logger.warn('⚠️ [Batch Decrypt] No conversation key available - using placeholders for encrypted messages');
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
                        
                        
                        logger.warn(`⚠️ [Batch Decrypt] No ciphertext for message ${message.id} (type=${message.type}) — passing through`);
                        return {
                            ...message,
                            decryptedContent: message.payload?.text || message.text || null,
                            isDecryptable: false
                        };
                    }

                    if (!conversationKey) {
                        return {
                            ...message,
                            decryptedContent: ENCRYPTED_KEY_UNAVAILABLE_PLACEHOLDER,
                            isDecryptable: false,
                            keyUnavailable: true
                        };
                    }

                    // Any key of the conversation I hold: the one the message names first, then
                    // the current one, then earlier ones (a group that changed its key).
                    const plaintext = await decryptWithConversationKeys(ciphertext, messageIv, conversationId, conversationType, {
                        parentMessageId: parentId && message.isThreadEncrypted === true ? parentId : null,
                        keyVersion: encryptionPayload.keyVersion ?? null,
                    });

                    return {
                        ...message,
                        decryptedContent: plaintext,
                        isDecryptable: true
                    };
                } catch (error) {
                    logger.error(`❌ [Batch Decrypt] Failed to decrypt message ${message.id}:`, error);
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
        logger.error('❌ [Batch Decrypt] Batch decryption failed:', error);
        
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
    decryptTextOrNull,
    batchDecryptMessages
};

export default messageEncryptionService;
