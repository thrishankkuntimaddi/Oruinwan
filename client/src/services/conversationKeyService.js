import { generateWorkspaceKey, exportKey, importKey } from '../utils/crypto';
import { wrapKeyWithRSA, wrapKeyWithX25519, unwrapKeyWithRSA, unwrapKeyWithX25519, importPublicKeyPEM } from '../utils/cryptoIdentity';
import identityKeyService from './identityKeyService';
import api from './api';
import { onKeyRotated } from './keyVersions';
import logger from '../utils/logger';

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
        // A conversation got a new key (409 KEY_ROTATED, or the live event): fetch it next time.
        onKeyRotated((conversationId, conversationType) => {
            if (conversationType) this.forget(conversationId, conversationType);
            else { this.forget(conversationId, 'dm'); this.forget(conversationId, 'channel'); }
        });
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
            this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256', version: 1, previous: new Map() });

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

            
            // The server makes DM keys (with a server copy, so people who set up encryption
            // later still get one) and hands out missing copies on this same request, so a second
            // fetch picks up a key made meanwhile. Never make a browser-only key here: people
            // without a copy could never be given it.
            this.conversationKeys.delete(`${conversationType}:${conversationId}`);
            conversationKey = await this.getConversationKey(conversationId, conversationType);
            if (conversationKey instanceof CryptoKey) return conversationKey;
            const err = new Error(conversationKey?.message || 'Your key for this conversation is not ready yet. Please try again in a moment.');
            err.code = conversationKey?.status || 'KEY_NOT_AVAILABLE';
            throw err;

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

        // Throws "Identity keys not initialized" until the identity is unlocked;
        // nothing is cached, so the next call retries once it is ready.
        const privateKey = identityKeyService.getMyPrivateKey();

        let conversationKeyBytes;
        try {
            conversationKeyBytes = await this._unwrap(data, privateKey);
        } catch (unwrapErr) {
            // My copy was wrapped for an identity key I no longer have (set up again on another
            // device, or an old copy): ask the server to wrap its copy for my current key, once.
            logger.warn(`[E2EE] Key for ${cacheKey} did not open; asking for a fresh copy`, unwrapErr?.message);
            try {
                await api.post(`/api/v2/conversations/${conversationId}/keys/rewrap`, { type: conversationType });
                ({ data } = await api.get(`/api/v2/conversations/${conversationId}/keys`, { params: { type: conversationType } }));
                conversationKeyBytes = await this._unwrap(data, privateKey);
            } catch (retryErr) {
                logger.error(`[E2EE] Fresh copy for ${cacheKey} failed:`, retryErr?.message);
                throw unwrapErr;
            }
        }

        const conversationKey = await importKey(conversationKeyBytes);
        const previous = await this._openPrevious(data.previous, privateKey, cacheKey);
        this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256', version: data.version || 1, previous });

        // An older key without a server copy can't be given to people who join later. Send it
        // once (in the background) so the server can hand it to every member.
        if (data.serverCopy === false) this._escrow(conversationId, conversationType, conversationKeyBytes);
        return conversationKey;
    }

    /**
     * A DM the server has no key for (a server older than this app, or making it failed there).
     * Make the key here for every participant, then give the server its protected copy (escrow)
     * so anyone without a copy, now or later, can still be given one. If someone else made the
     * key in the meantime, use theirs. Returns the CryptoKey, or null when it can't be made.
     */
    async createDMKey(conversationId, workspaceId) {
        const cacheKey = `dm:${conversationId}`;
        try {
            const { ids: participants, workspaceId: dmWorkspaceId } = await this._dmParticipants(conversationId, workspaceId);
            const ws = dmWorkspaceId || workspaceId;
            if (!participants.length || !ws) return null;
            await this._loadPublicKeys(participants);
            const { conversationKey } = await this.createAndStoreConversationKey(conversationId, 'dm', ws, participants);
            this._escrow(conversationId, 'dm', await exportKey(conversationKey));
            return conversationKey;
        } catch (err) {
            logger.warn(`[E2EE] Could not make the key for ${cacheKey} here:`, err?.message);
            this.conversationKeys.delete(cacheKey);
            const theirs = await this.getConversationKey(conversationId, 'dm').catch(() => null);
            return theirs instanceof CryptoKey ? theirs : null;
        }
    }

    // Participant ids (and workspace) of a DM: from its details (newer servers), else from my DM list.
    async _dmParticipants(conversationId, workspaceId) {
        try {
            const { data } = await api.get(`/api/v2/dm/${conversationId}`);
            const ids = (data?.dm?.participants || []).map((p) => String(p?._id || p)).filter(Boolean);
            if (ids.length) return { ids, workspaceId: data.dm.workspaceId || workspaceId };
        } catch { /* older server: no details endpoint */ }
        if (!workspaceId) return { ids: [], workspaceId };
        const { data } = await api.get(`/api/v2/messages/workspace/${workspaceId}/dms`);
        const session = (data?.sessions || []).find((s) => String(s.id) === String(conversationId));
        if (!session) return { ids: [], workspaceId };
        const me = getCurrentUserId();
        const others = session.isGroup
            ? (session.members || []).map((m) => String(m?._id || m))
            : [String(session.otherUserId?._id || session.otherUserId || '')];
        return { ids: [...new Set([me, ...others].filter(Boolean))], workspaceId };
    }

    // Public keys through the signed-in API client (it attaches and refreshes the token).
    async _loadPublicKeys(userIds) {
        const missing = userIds.filter((id) => !identityKeyService.publicKeysCache.has(id));
        if (!missing.length) return;
        const { data } = await api.post('/api/v2/identity/public-keys', { userIds: missing });
        for (const { userId, publicKey, algorithm } of data?.publicKeys || []) {
            try {
                identityKeyService.publicKeysCache.set(String(userId), { publicKey: await importPublicKeyPEM(publicKey, algorithm), algorithm });
            } catch (err) {
                logger.warn(`[E2EE] Public key of ${userId} did not import:`, err?.message);
            }
        }
    }

    /**
     * Earlier keys of a conversation (the server sends the ones I may use: `previous`), opened:
     * Map(version → CryptoKey). A copy that doesn't open is skipped; messages it encrypted show
     * as unreadable rather than blocking the conversation.
     */
    async _openPrevious(list, privateKey, cacheKey) {
        const out = new Map();
        for (const e of Array.isArray(list) ? list : []) {
            try {
                out.set(Number(e.version), await importKey(await this._unwrap(e, privateKey)));
            } catch (err) {
                logger.warn(`[E2EE] Earlier key ${e?.version} of ${cacheKey} did not open:`, err?.message);
            }
        }
        return out;
    }

    /** The current key's version (1 until a conversation's key changes). */
    getCurrentVersion(conversationId, conversationType) {
        return this.conversationKeys.get(`${conversationType}:${conversationId}`)?.version || 1;
    }

    /**
     * Keys that may open a message of this conversation, the likeliest first: the version the
     * message names (when known), then the current key, then earlier ones (newest first).
     */
    async getDecryptionKeys(conversationId, conversationType, keyVersion = null) {
        const current = await this.getConversationKey(conversationId, conversationType);
        if (!(current instanceof CryptoKey)) return [];
        const entry = this.conversationKeys.get(`${conversationType}:${conversationId}`) || {};
        const earlier = [...(entry.previous || new Map()).entries()].sort((a, b) => b[0] - a[0]).map(([, k]) => k);
        const keys = [current, ...earlier];
        const named = keyVersion != null && Number(keyVersion) !== (entry.version || 1) ? entry.previous?.get(Number(keyVersion)) : null;
        return named ? [named, ...keys.filter((k) => k !== named)] : keys;
    }

    /** Drops my cached key, so the next use fetches the current one (after the key changed). */
    forget(conversationId, conversationType) {
        this.conversationKeys.delete(`${conversationType}:${conversationId}`);
    }

    /**
     * After a message didn't open with any key I have: fetch the keys again in case the
     * conversation got a new one since. At most once a minute per conversation. True when
     * something changed.
     */
    async refreshIfStale(conversationId, conversationType) {
        const cacheKey = `${conversationType}:${conversationId}`;
        this.lastRefresh = this.lastRefresh || new Map();
        const at = this.lastRefresh.get(cacheKey) || 0;
        if (Date.now() - at < 60_000) return false;
        this.lastRefresh.set(cacheKey, Date.now());
        const before = this.conversationKeys.get(cacheKey);
        this.conversationKeys.delete(cacheKey);
        const key = await this.getConversationKey(conversationId, conversationType).catch(() => null);
        const after = this.conversationKeys.get(cacheKey);
        if (!(key instanceof CryptoKey)) {
            if (before) this.conversationKeys.set(cacheKey, before);
            return false;
        }
        return !before || (after?.version || 1) !== (before.version || 1) || (after?.previous?.size || 0) !== (before.previous?.size || 0);
    }

    async _unwrap({ encryptedKey, ephemeralPublicKey, algorithm }, privateKey) {
        return algorithm === 'X25519'
            ? unwrapKeyWithX25519(encryptedKey, ephemeralPublicKey, privateKey)
            : unwrapKeyWithRSA(encryptedKey, privateKey);
    }

    /**
     * Older keys made in a browser have no server copy, so members without a copy of their own
     * can never be given one. Open each such key I hold once; opening sends the server its copy
     * (see fetchAndDecryptConversationKey), and the server hands it to the members missing it.
     */
    async healServerCopies() {
        let list = [];
        try {
            const { data } = await api.get('/api/v2/conversations/escrow-needed');
            list = Array.isArray(data?.conversations) ? data.conversations : [];
        } catch {
            return 0; // older server
        }
        let healed = 0;
        for (const { conversationId, conversationType } of list) {
            if (!['dm', 'channel'].includes(conversationType)) continue;
            try {
                this.conversationKeys.delete(`${conversationType}:${conversationId}`);
                const key = await this.getConversationKey(conversationId, conversationType);
                if (key instanceof CryptoKey) healed += 1;
            } catch (err) {
                logger.warn(`[E2EE] Could not open ${conversationType}:${conversationId} to add its server copy:`, err?.message);
            }
        }
        return healed;
    }

    _escrow(conversationId, conversationType, keyBytes) {
        try {
            const bytes = new Uint8Array(keyBytes);
            let bin = '';
            for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
            api.post(`/api/v2/conversations/${conversationId}/keys/escrow`, { type: conversationType, key: btoa(bin) })
                .catch((err) => logger.warn('[E2EE] Could not add the server copy (will retry next time):', err?.message));
        } catch (err) {
            logger.warn('[E2EE] Escrow skipped:', err?.message);
        }
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
                    const previous = await this._openPrevious(ck.previous, privateKey, cacheKey);
                    this.conversationKeys.set(cacheKey, { key: conversationKey, algorithm: 'AES-256', version: ck.version || 1, previous });

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
