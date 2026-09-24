import { generateWorkspaceKey, exportKey, importKey } from '../utils/crypto';
import { wrapKeyWithRSA, wrapKeyWithX25519, unwrapKeyWithRSA, unwrapKeyWithX25519 } from '../utils/cryptoIdentity';
import identityKeyService from './identityKeyService';
import logger from '../utils/logger';

const API_BASE = import.meta.env.VITE_BACKEND_URL || '';

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
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/v2/conversations/${conversationId}/keys`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    conversationType,
                    workspaceId,
                    encryptedKeys,
                    workspaceEncryptedKey,
                    workspaceKeyIv,
                    workspaceKeyAuthTag
                })
            });

            if (!response.ok) {
                throw new Error('Failed to store conversation keys on server');
            }

        } catch (error) {
            logger.error('Failed to store conversation keys:', error);
            throw error;
        }
    }

    

    
    async fetchAndDecryptConversationKey(conversationId, conversationType) {
        try {
            
            const cacheKey = `${conversationType}:${conversationId}`;
            if (this.conversationKeys.has(cacheKey)) {
                
                return this.conversationKeys.get(cacheKey).key;
            }

            
            
            

            
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/v2/conversations/${conversationId}/keys?type=${conversationType}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                
                
                
                

                if (response.status === 403) {
                    
                    
                    
                    logger.error(`🚫 [AUDIT][PHASE1][CLIENT-FETCH] Server returned 403 KEY_NOT_DISTRIBUTED`);
                    logger.error(`   ├─ Conversation: ${conversationType}:${conversationId}`);
                    logger.error(`   ├─ Meaning: Conversation key EXISTS but user lacks access`);
                    logger.error(`   ├─ INV-001 violation: User in channel.members but NOT in encryptedKeys[]`);
                    logger.error(`   └─ Action: User BLOCKED from sending messages`);
                    logger.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

                    logger.warn(`🚫 [FIX 4] 403 Forbidden for conversation key in ${conversationType}:${conversationId}`);

                    
                    try {
                        const token = localStorage.getItem('accessToken');
                        const channelResponse = await fetch(`${API_BASE}/api/v2/channels/${conversationId}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            credentials: 'include'
                        });

                        if (channelResponse.ok) {
                            const channelData = await channelResponse.json();
                            const currentUserId = getCurrentUserId();

                            if (!currentUserId) {
                                return {
                                    status: 'ACCESS_DENIED',
                                    reason: 'FORBIDDEN',
                                    message: 'Access to encryption keys denied',
                                    conversationId,
                                    conversationType
                                };
                            }

                            const isMember = channelData.channel?.members?.some(m =>
                                String(m?.user?._id || m?.user || m?._id || m) === currentUserId
                            );

                            if (!isMember) {
                                logger.error(`❌ [FIX 4] User is NOT a member of channel ${conversationId}`);
                                return {
                                    status: 'ACCESS_DENIED',
                                    reason: 'NOT_A_MEMBER',
                                    message: 'You are not a member of this channel',
                                    conversationId,
                                    conversationType
                                };
                            } else {
                                logger.error(`⚠️ [FIX 4] User IS a member but key access denied (system error)`);
                                return {
                                    status: 'SYSTEM_ERROR',
                                    reason: 'KEY_ACCESS_ERROR',
                                    message: 'Unable to access encryption keys. Please refresh the page.',
                                    conversationId,
                                    conversationType
                                };
                            }
                        }
                    } catch (reconciliationError) {
                        logger.error('[FIX 4] Membership reconciliation failed:', reconciliationError);
                    }

                    
                    return {
                        status: 'ACCESS_DENIED',
                        reason: 'FORBIDDEN',
                        message: 'Access to encryption keys denied',
                        conversationId,
                        conversationType
                    };
                }

                if (response.status === 404) {
                    
                    
                    
                    logger.warn(`❌ [AUDIT][PHASE1][CLIENT-FETCH] Server returned 404 NOT_FOUND`);
                    logger.warn(`   ├─ Conversation: ${conversationType}:${conversationId}`);
                    logger.warn(`   ├─ Meaning: No conversation key exists OR user not distributed`);
                    logger.warn(`   ├─ Possible reasons: (1) New channel (2) Late joiner (3) Legacy key`);
                    logger.warn(`   └─ Action: Cannot decrypt messages`);
                    logger.warn(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

                    
                    
                    
                    
                    

                    logger.warn(`⚠️ [PHASE 4] Conversation key missing for user in ${conversationType}:${conversationId}`);
                    logger.warn(`   This may indicate: (1) new channel, (2) late joiner, or (3) legacy key`);

                    
                    return {
                        status: 'MISSING_FOR_USER',
                        reason: 'KEY_NOT_DISTRIBUTED',
                        conversationId,
                        conversationType
                    };
                }

                throw new Error('Failed to fetch conversation key');
            }

            const data = await response.json();
            const { encryptedKey, ephemeralPublicKey, algorithm } = data;

            
            const privateKey = identityKeyService.getMyPrivateKey();

            let conversationKeyBytes;

            if (algorithm === 'X25519') {
                conversationKeyBytes = await unwrapKeyWithX25519(encryptedKey, ephemeralPublicKey, privateKey);
            } else {
                conversationKeyBytes = await unwrapKeyWithRSA(encryptedKey, privateKey);
            }

            
            const conversationKey = await importKey(conversationKeyBytes);

            
            this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256' });

            
            
            

            return conversationKey;
        } catch (error) {
            logger.error(`Failed to fetch conversation key for ${conversationType}:${conversationId}:`, error);
            throw error;
        }
    }

    
    async fetchWorkspaceConversationKeys(workspaceId) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/v2/conversations/workspace/${workspaceId}/keys`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error('Failed to fetch workspace conversation keys');
            }

            const data = await response.json();
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
        const cacheKey = `${conversationType}:${conversationId}`;

        
        if (this.conversationKeys.has(cacheKey)) {
            return this.conversationKeys.get(cacheKey).key;
        }

        
        return await this.fetchAndDecryptConversationKey(conversationId, conversationType);
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

            
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/v2/conversations/${conversationId}/keys/add-user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
                body: JSON.stringify({
                    conversationType,
                    userId: newUserId,
                    encryptedKey,
                    ephemeralPublicKey,
                    algorithm
                })
            });

            if (!response.ok) {
                throw new Error('Failed to add participant');
            }

        } catch (error) {
            logger.error('Failed to add participant:', error);
            throw error;
        }
    }

    

    
    async fetchConversationKeys(conversationId, conversationType) {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(`${API_BASE}/api/v2/conversations/${conversationId}/keys?type=${conversationType}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });

            if (response.status === 404) {
                
                return null;
            }

            if (!response.ok) {
                throw new Error(`Failed to fetch conversation keys: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            logger.error('[conversationKeyService] fetchConversationKeys error:', error);
            throw error;
        }
    }

    

    
    clearCache() {
        this.conversationKeys.clear();
    }

    
    removeCachedKey(conversationId, conversationType) {
        const cacheKey = `${conversationType}:${conversationId}`;
        this.conversationKeys.delete(cacheKey);
    }
}

const conversationKeyService = new ConversationKeyService();

export default conversationKeyService;
export { conversationKeyService };
