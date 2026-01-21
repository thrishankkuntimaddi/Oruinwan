/**
 * Identity Key Service
 * 
 * Manages user identity keypairs for E2EE:
 * - Checks if identity key exists
 * - Generates on first login
 * - Stores in IndexedDB
 * - Uploads public key to server
 * - Fetches other users' public keys
 * - Caches in memory
 */

import {
    generateIdentityKeyPair,
    exportPublicKeyPEM,
    importPublicKeyPEM,
    exportPrivateKeyJWK,
    importPrivateKeyJWK,
    checkCryptoSupport
} from '../utils/cryptoIdentity';

// ==================== CONSTANTS ====================

const DB_NAME = 'ChttrixE2EE';
const DB_VERSION = 1;
const STORE_NAME = 'identityKeys';

// ==================== INDEXEDDB SETUP ====================

/**
 * Open IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
            }
        };
    });
}

/**
 * Store identity keypair in IndexedDB
 * @param {string} userId 
 * @param {Object} keyData - {privateKeyJWK, publicKeyPEM, algorithm, version}
 * @returns {Promise<void>}
 */
async function storeIdentityKeyPair(userId, keyData) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const data = {
            userId,
            ...keyData,
            createdAt: new Date().toISOString()
        };

        const request = store.put(data);

        request.onsuccess = () => {
            console.log(`✅ Identity keypair stored in IndexedDB for user ${userId}`);
            resolve();
        };
        request.onerror = () => reject(request.error);

        db.close();
    });
}

/**
 * Retrieve identity keypair from IndexedDB
 * @param {string} userId 
 * @returns {Promise<Object|null>} Stored key data or null
 */
async function getIdentityKeyPair(userId) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(userId);

        request.onsuccess = () => {
            resolve(request.result || null);
        };
        request.onerror = () => reject(request.error);

        db.close();
    });
}

/**
 * Delete identity keypair from IndexedDB
 * @param {string} userId 
 * @returns {Promise<void>}
 */
async function deleteIdentityKeyPair(userId) {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(userId);

        request.onsuccess = () => {
            console.log(`🗑️ Identity keypair deleted for user ${userId}`);
            resolve();
        };
        request.onerror = () => reject(request.error);

        db.close();
    });
}

// ==================== IDENTITY KEY SERVICE ====================

class IdentityKeyService {
    constructor() {
        this.publicKeysCache = new Map(); // userId -> {publicKey: CryptoKey, algorithm: string}
        this.myPrivateKey = null;
        this.myPublicKey = null;
        this.myAlgorithm = null;
        this.myUserId = null;
    }

    /**
     * Check if user has identity key
     * @param {string} userId 
     * @returns {Promise<boolean>}
     */
    async hasIdentityKey(userId) {
        try {
            const keyData = await getIdentityKeyPair(userId);
            return keyData !== null;
        } catch (error) {
            console.error('Error checking identity key:', error);
            return false;
        }
    }

    /**
     * Initialize identity keys on login
     * Generates new keypair if doesn't exist, otherwise loads from IndexedDB
     * 
     * @param {string} userId 
     * @returns {Promise<{existed: boolean, algorithm: string}>}
     */
    async initializeIdentityKeys(userId) {
        console.log(`🔐 Initializing identity keys for user ${userId}...`);

        const support = checkCryptoSupport();
        if (!support.indexedDB) {
            throw new Error('IndexedDB not available - cannot use E2EE');
        }

        // Check if key already exists
        const existingKeyData = await getIdentityKeyPair(userId);

        if (existingKeyData) {
            console.log(`✅ Found existing identity key (${existingKeyData.algorithm})`);

            // Import private key from JWK
            this.myPrivateKey = await importPrivateKeyJWK(
                existingKeyData.privateKeyJWK,
                existingKeyData.algorithm
            );

            // Import public key from PEM
            this.myPublicKey = await importPublicKeyPEM(
                existingKeyData.publicKeyPEM,
                existingKeyData.algorithm
            );

            this.myAlgorithm = existingKeyData.algorithm;
            this.myUserId = userId;

            // Cache own public key
            this.publicKeysCache.set(userId, {
                publicKey: this.myPublicKey,
                algorithm: this.myAlgorithm
            });

            return {
                existed: true,
                algorithm: this.myAlgorithm
            };
        }

        // Generate new keypair
        console.log('🔑 Generating new identity keypair...');
        const keyPair = await generateIdentityKeyPair();

        // Export for storage
        const privateKeyJWK = await exportPrivateKeyJWK(keyPair.privateKey);
        const publicKeyPEM = await exportPublicKeyPEM(keyPair.publicKey, keyPair.algorithm);

        // Store in IndexedDB
        await storeIdentityKeyPair(userId, {
            privateKeyJWK,
            publicKeyPEM,
            algorithm: keyPair.algorithm,
            version: keyPair.version
        });

        // Set in memory
        this.myPrivateKey = keyPair.privateKey;
        this.myPublicKey = keyPair.publicKey;
        this.myAlgorithm = keyPair.algorithm;
        this.myUserId = userId;

        // Cache own public key
        this.publicKeysCache.set(userId, {
            publicKey: this.myPublicKey,
            algorithm: this.myAlgorithm
        });

        console.log(`✅ Generated and stored new ${keyPair.algorithm} identity keypair`);

        return {
            existed: false,
            algorithm: keyPair.algorithm
        };
    }

    /**
     * Get own public key for uploading to server
     * @returns {Promise<{publicKey: string, algorithm: string, version: number}>}
     */
    async getMyPublicKey() {
        if (!this.myPublicKey || !this.myAlgorithm) {
            throw new Error('Identity keys not initialized. Call initializeIdentityKeys first.');
        }

        const keyData = await getIdentityKeyPair(this.myUserId);

        return {
            publicKey: keyData.publicKeyPEM,
            algorithm: keyData.algorithm,
            version: keyData.version
        };
    }

    /**
     * Get own private key (for unwrapping conversation keys)
     * @returns {CryptoKey}
     */
    getMyPrivateKey() {
        if (!this.myPrivateKey) {
            throw new Error('Identity keys not initialized. Call initializeIdentityKeys first.');
        }
        return this.myPrivateKey;
    }

    /**
     * Fetch and cache another user's public key from server
     * @param {string} userId 
     * @returns {Promise<{publicKey: CryptoKey, algorithm: string}>}
     */
    async getUserPublicKey(userId) {
        // Check cache first
        if (this.publicKeysCache.has(userId)) {
            return this.publicKeysCache.get(userId);
        }

        try {
            // Fetch from server
            const response = await fetch(`/api/v2/identity/users/${userId}/public-key`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch public key for user ${userId}`);
            }

            const data = await response.json();
            const { publicKey: publicKeyPEM, algorithm } = data;

            // Import public key
            const publicKey = await importPublicKeyPEM(publicKeyPEM, algorithm);

            // Cache
            this.publicKeysCache.set(userId, { publicKey, algorithm });

            console.log(`✅ Fetched and cached public key for user ${userId} (${algorithm})`);

            return { publicKey, algorithm };
        } catch (error) {
            console.error(`Failed to fetch public key for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Batch fetch multiple users' public keys
     * @param {string[]} userIds 
     * @returns {Promise<Map<string, {publicKey: CryptoKey, algorithm: string}>>}
     */
    async batchGetUserPublicKeys(userIds) {
        // Filter out already cached keys
        const uncachedUserIds = userIds.filter(id => !this.publicKeysCache.has(id));

        if (uncachedUserIds.length === 0) {
            // All keys are cached
            const result = new Map();
            userIds.forEach(id => {
                if (this.publicKeysCache.has(id)) {
                    result.set(id, this.publicKeysCache.get(id));
                }
            });
            return result;
        }

        try {
            // Fetch from server
            const response = await fetch('/api/v2/identity/public-keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ userIds: uncachedUserIds })
            });

            if (!response.ok) {
                throw new Error('Failed to batch fetch public keys');
            }

            const data = await response.json();
            const { publicKeys } = data;

            // Import and cache each key
            for (const { userId, publicKey: publicKeyPEM, algorithm } of publicKeys) {
                const publicKey = await importPublicKeyPEM(publicKeyPEM, algorithm);
                this.publicKeysCache.set(userId, { publicKey, algorithm });
            }

            console.log(`✅ Batch fetched ${publicKeys.length} public keys`);

            // Return all requested keys
            const result = new Map();
            userIds.forEach(id => {
                if (this.publicKeysCache.has(id)) {
                    result.set(id, this.publicKeysCache.get(id));
                }
            });

            return result;
        } catch (error) {
            console.error('Batch fetch public keys failed:', error);
            throw error;
        }
    }

    /**
     * Upload public key to server
     * Should be called after generating new keypair
     * 
     * @returns {Promise<void>}
     */
    async uploadPublicKeyToServer() {
        const { publicKey, algorithm, version } = await this.getMyPublicKey();

        try {
            const response = await fetch('/api/v2/identity/public-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    publicKey,
                    algorithm,
                    version
                })
            });

            if (!response.ok) {
                throw new Error('Failed to upload public key to server');
            }

            console.log('✅ Public key uploaded to server');
        } catch (error) {
            console.error('Failed to upload public key:', error);
            throw error;
        }
    }

    /**
     * Clear all cached keys and in-memory keys
     */
    clearCache() {
        this.publicKeysCache.clear();
        this.myPrivateKey = null;
        this.myPublicKey = null;
        this.myAlgorithm = null;
        this.myUserId = null;
        console.log('🗑️ Identity key cache cleared');
    }

    /**
     * Delete identity keys (logout)
     * @param {string} userId 
     */
    async deleteKeys(userId) {
        await deleteIdentityKeyPair(userId);
        this.clearCache();
    }
}

// Singleton instance
const identityKeyService = new IdentityKeyService();

export default identityKeyService;
export { identityKeyService };
