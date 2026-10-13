import { generateWorkspaceKey, exportKey, importKey } from '../utils/crypto';
import { wrapKeyWithRSA, wrapKeyWithX25519, unwrapKeyWithRSA, unwrapKeyWithX25519 } from '../utils/cryptoIdentity';
import identityKeyService from './identityKeyService';
import api from './api';
import logger from '../utils/logger';
import { isDemoMode } from '../appMode/env';
import { demoConversationKey } from '../appMode/demo/crypto';

// Current user id from the initialized identity (set on login/rehydration),
// falling back to the access token's `sub` claim.
function getCurrentUserId() {
    if (identityKeyService.myUserId) return String(identityKeyService.myUserId);
    try {
        const token = localStorage.getItem('accessToken');
        if (!token) return null;
        const part = token.split('.')[1];
        if (!part) return null;
        const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        const sub = JSON.parse(json)?.sub;
        return sub ? String(sub) : null;
    } catch {
        return null;
    }
}

class ConversationKeyService {
    constructor() {
        this.conversationKeys = new Map();
        // One network fetch per conversation while a message list decrypts in parallel.
        this.inFlight = new Map();

        
        this.setupLogoutListener();
    }

    
    setupLogoutListener() {
        window.addEventListener('auth:logout', () => {
            this.clearCache();
        });
    }

    

    
    async generateConversationKey() {

        
        const key = await generateWorkspaceKey();

        return key;
    }

    
    async createAndDistributeConversationKey(participantUserIds, workspaceId) {
        try {

            
            const conversationKey = await this.generateConversationKey();

            
            const conversationKeyBytes = await exportKey(conversationKey);

            
            const publicKeys = await identityKeyService.batchGetUserPublicKeys(participantUserIds);

            
            const encryptedKeys = [];

            for (const userId of participantUserIds) {
                const userKeyData = publicKeys.get(userId);

                if (!userKeyData) {
                    logger.warn(`⚠️ No public key found for user ${userId}, skipping`);
                    continue;
                }

                const { publicKey, algorithm } = userKeyData;

                let encryptedKey, ephemeralPublicKey = null;

                if (algorithm === 'X25519') {
                    
                    const wrapped = await wrapKeyWithX25519(conversationKeyBytes, publicKey);
                    encryptedKey = wrapped.encryptedKey;
                    ephemeralPublicKey = wrapped.ephemeralPublicKey;
                } else {
                    
                    encryptedKey = await wrapKeyWithRSA(conversationKeyBytes, publicKey);
                }

                encryptedKeys.push({
                    userId,
                    encryptedKey,
                    ephemeralPublicKey,
                    algorithm
                });

            }

            return {
                conversationKey,
                encryptedKeys
            };
        } catch (error) {
            logger.error('Failed to create and distribute conversation key:', error);
            throw error;
        }
    }

    

    
    async createAndStoreConversationKey(conversationId, conversationType, workspaceId, members) {
        try {

            
            const participantUserIds = members.map(m => {
                if (typeof m === 'string') return m;
                if (m.user) return typeof m.user === 'string' ? m.user : m.user._id || m.user.toString();
                if (m._id) return m._id.toString();
                return m.toString();
            });

            
            const { conversationKey, encryptedKeys } = await this.createAndDistributeConversationKey(
                participantUserIds,
                workspaceId
            );

            
            await this.storeConversationKeysOnServer(
                conversationId,
                conversationType,
                workspaceId,
                encryptedKeys,
                null, 
                null, 
                null  
            );

            
            const cacheKey = `${conversationType}:${conversationId}`;
            this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256' });

            return { conversationKey, encryptedKeys };
        } catch (error) {
            logger.error('Failed to create and store conversation key:', error);
            throw error;
        }
    }

    
    async ensureConversationKey(conversationId, conversationType, workspaceId, participantIds) {
        
        
        
        if (conversationType !== 'dm') {
            throw new Error('ensureConversationKey is DM-only. Use channel flow for channels.');
        }

        try {

            
            let conversationKey = await this.getConversationKey(conversationId, conversationType);

            if (conversationKey && conversationKey.key) {
                return conversationKey.key;
            }

            
            if (conversationKey && conversationKey.status === 'MISSING_FOR_USER') {
            }

            

            
            try {
                const result = await this.createAndStoreConversationKey(
                    conversationId,
                    conversationType,
                    workspaceId,
                    participantIds
                );

                return result.conversationKey;

            } catch (keyError) {
                
                if (keyError.message && keyError.message.includes('already exist')) {
                    const fetchedKey = await this.fetchAndDecryptConversationKey(conversationId, conversationType);
                    return fetchedKey;
                } else {
                    throw keyError;
                }
            }

        } catch (error) {
            logger.error(`❌ [DM ONLY] Failed to ensure conversation key for dm:${conversationId}:`, error);
            throw error;
        }
    }

    
    async storeConversationKeysOnServer(conversationId, conversationType, workspaceId, encryptedKeys, workspaceEncryptedKey, workspaceKeyIv, workspaceKeyAuthTag) {
        try {
            await api.post(`/api/v2/conversations/${conversationId}/keys`, {
                conversationType,
                workspaceId,
                encryptedKeys,
                workspaceEncryptedKey,
                workspaceKeyIv,
                workspaceKeyAuthTag
            });
        } catch (err) {
            logger.error('Failed to store conversation keys:', err);
            if (err?.response?.status === 409) throw new Error('Conversation keys already exist');
            throw new Error('Failed to store conversation keys on server');
        }
    }

    

    
    async fetchAndDecryptConversationKey(conversationId, conversationType) {
        const cacheKey = `${conversationType}:${conversationId}`;
        if (this.conversationKeys.has(cacheKey)) {
            return this.conversationKeys.get(cacheKey).key;
        }

        let data;
        try {
            // api (axios) attaches the current token and refreshes it on 401,
            // so an expired access token no longer looks like a key failure.
            ({ data } = await api.get(`/api/v2/conversations/${conversationId}/keys`, {
                params: { type: conversationType },
            }));
        } catch (err) {
            const status = err?.response?.status;
            const code = err?.response?.data?.error;

            if (status === 404) {
                logger.warn(`[E2EE] No key for ${cacheKey} (${code || 'NOT_FOUND'})`);
                return { status: 'MISSING_FOR_USER', reason: code || 'KEY_NOT_INITIALIZED', conversationId, conversationType };
            }

            if (status === 403) {
                if (conversationType === 'dm') {
                    return {
                        status: 'ACCESS_DENIED',
                        reason: code || 'FORBIDDEN',
                        message: code === 'NOT_A_PARTICIPANT'
                            ? 'You are not a participant in this conversation'
                            : 'Your key for this conversation is not ready yet. Please try again in a moment.',
                        conversationId,
                        conversationType,
                    };
                }
                return this.explainChannelKeyDenied(conversationId, conversationType);
            }

            logger.error(`[E2EE] Failed to fetch conversation key for ${cacheKey}:`, err);
            throw new Error('Failed to fetch conversation key');
        }

        const { encryptedKey, ephemeralPublicKey, algorithm } = data;
        // Throws "Identity keys not initialized" until the identity is unlocked;
        // nothing is cached, so the next call retries once it is ready.
        const privateKey = identityKeyService.getMyPrivateKey();

        const conversationKeyBytes = algorithm === 'X25519'
            ? await unwrapKeyWithX25519(encryptedKey, ephemeralPublicKey, privateKey)
            : await unwrapKeyWithRSA(encryptedKey, privateKey);

        const conversationKey = await importKey(conversationKeyBytes);
        this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256' });
        return conversationKey;
    }

    // A channel key 403 means either "not a member" or a distribution gap.
    async explainChannelKeyDenied(conversationId, conversationType) {
        try {
            const { data } = await api.get(`/api/v2/channels/${conversationId}`);
            const currentUserId = getCurrentUserId();
            const isMember = !!currentUserId && data?.channel?.members?.some(m =>
                String(m?.user?._id || m?.user || m?._id || m) === currentUserId
            );
            if (currentUserId && !isMember) {
                return { status: 'ACCESS_DENIED', reason: 'NOT_A_MEMBER', message: 'You are not a member of this channel', conversationId, conversationType };
            }
            if (isMember) {
                return { status: 'SYSTEM_ERROR', reason: 'KEY_ACCESS_ERROR', message: 'Unable to access encryption keys. Please refresh the page.', conversationId, conversationType };
            }
        } catch (reconciliationError) {
            logger.error('[E2EE] Channel membership check failed:', reconciliationError);
        }
        return { status: 'ACCESS_DENIED', reason: 'FORBIDDEN', message: 'Access to encryption keys denied', conversationId, conversationType };
    }


    
    async fetchWorkspaceConversationKeys(workspaceId) {
        try {
            const { data } = await api.get(`/api/v2/conversations/workspace/${workspaceId}/keys`);
            const { conversationKeys } = data;

            
            const privateKey = identityKeyService.getMyPrivateKey();

            for (const ck of conversationKeys) {
                const { conversationId, conversationType, encryptedKey, ephemeralPublicKey, algorithm } = ck;

                try {
                    let conversationKeyBytes;

                    if (algorithm === 'X25519') {
                        conversationKeyBytes = await unwrapKeyWithX25519(encryptedKey, ephemeralPublicKey, privateKey);
                    } else {
                        conversationKeyBytes = await unwrapKeyWithRSA(encryptedKey, privateKey);
                    }

                    const conversationKey = await importKey(conversationKeyBytes);

                    const cacheKey = `${conversationType}:${conversationId}`;
                    this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256' });

                } catch (error) {
                    logger.error(`Failed to decrypt key for ${conversationType}:${conversationId}:`, error);
                    
                }
            }

        } catch (error) {
            logger.error('Failed to fetch workspace conversation keys:', error);
            throw error;
        }
    }

    

    
    async getConversationKey(conversationId, conversationType) {
        // The demo (desktop and tablet apps) has one key for every conversation, made on the device.
        if (isDemoMode()) return demoConversationKey();

        const cacheKey = `${conversationType}:${conversationId}`;

        
        if (this.conversationKeys.has(cacheKey)) {
            return this.conversationKeys.get(cacheKey).key;
        }

        if (!this.inFlight.has(cacheKey)) {
            const pending = this.fetchAndDecryptConversationKey(conversationId, conversationType)
                .finally(() => this.inFlight.delete(cacheKey));
            this.inFlight.set(cacheKey, pending);
        }
        return this.inFlight.get(cacheKey);
    }

    

    
    async addParticipant(conversationId, conversationType, newUserId) {
        try {
            
            const conversationKey = await this.getConversationKey(conversationId, conversationType);

            if (!conversationKey) {
                throw new Error('Conversation key not found');
            }

            
            const conversationKeyBytes = await exportKey(conversationKey);

            
            const { publicKey, algorithm } = await identityKeyService.getUserPublicKey(newUserId);

            
            let encryptedKey, ephemeralPublicKey = null;

            if (algorithm === 'X25519') {
                const wrapped = await wrapKeyWithX25519(conversationKeyBytes, publicKey);
                encryptedKey = wrapped.encryptedKey;
                ephemeralPublicKey = wrapped.ephemeralPublicKey;
            } else {
                encryptedKey = await wrapKeyWithRSA(conversationKeyBytes, publicKey);
            }

            
            await api.post(`/api/v2/conversations/${conversationId}/keys/add-user`, {
                conversationType,
                userId: newUserId,
                encryptedKey,
                ephemeralPublicKey,
                algorithm
            });

        } catch (error) {
            logger.error('Failed to add participant:', error);
            throw error;
        }
    }

    

    
    async fetchConversationKeys(conversationId, conversationType) {
        try {
            const { data } = await api.get(`/api/v2/conversations/${conversationId}/keys`, { params: { type: conversationType } });
            return data;
        } catch (err) {
            if (err?.response?.status === 404) return null;
            logger.error('[conversationKeyService] fetchConversationKeys error:', err);
            throw new Error(`Failed to fetch conversation keys: ${err?.response?.status || err.message}`);
        }
    }

    

    
    clearCache() {
        this.conversationKeys.clear();
        this.inFlight.clear();
    }

    
    removeCachedKey(conversationId, conversationType) {
        const cacheKey = `${conversationType}:${conversationId}`;
        this.conversationKeys.delete(cacheKey);
    }
}

const conversationKeyService = new ConversationKeyService();

export default conversationKeyService;
export { conversationKeyService };
