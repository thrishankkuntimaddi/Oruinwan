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

        // ✅ FIX 2: Setup logout listener to clear cache
        this.setupLogoutListener();
    }

    /**
     * Setup logout event listener (FIX 2)
     * Clears all cached keys when user logs out
     */
    setupLogoutListener() {
        window.addEventListener('auth:logout', () => {
            this.clearCache();
        });
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
     * 
     * NEW PHASE 1 BEHAVIOR:
     * 1. Check server for encrypted identity keys
     * 2. If exists → recover UMEK → decrypt identity keys
     * 3. If NOT exists → first-time setup → generate keys + UMEK → send to server
     * 
     * @param {string} userId 
     * @param {string|null} password - User password (for password users) or null (for OAuth skip users)
     * @returns {Promise<{existed: boolean, algorithm: string}>}
     */
    async initializeIdentityKeys(userId, password = null) {
        const support = checkCryptoSupport();
        if (!support.indexedDB) {
            throw new Error('IndexedDB not available - cannot use E2EE');
        }

        console.log('🔐 [PHASE 1] Initializing identity keys for user:', userId);

        try {
            // STEP 1: Fetch crypto state from server
            const cryptoState = await this._fetchCryptoStateFromServer();

            if (cryptoState) {
                // RECOVERY PATH: Check cache FIRST, then decrypt if needed
                console.log('✅ [PHASE 1] Found existing crypto state on server');

                // 🔥 CRITICAL FIX: Check for cached decrypted identity FIRST
                const cachedIdentity = await getIdentityKeyPair(userId);
                if (cachedIdentity && cachedIdentity.privateKeyJWK) {
                    console.log('✅ [PHASE 1] Using cached decrypted identity key (no password needed)');

                    // Import cached keys into memory
                    const { identityPublicKey, algorithm } = cryptoState;
                    this.myPrivateKey = await importPrivateKeyJWK(cachedIdentity.privateKeyJWK, algorithm);
                    this.myPublicKey = await importPublicKeyPEM(identityPublicKey, algorithm);
                    this.myAlgorithm = algorithm;
                    this.myUserId = userId;

                    // Cache own public key
                    this.publicKeysCache.set(userId, {
                        publicKey: this.myPublicKey,
                        algorithm: this.myAlgorithm
                    });

                    console.log('✅ [PHASE 1] Identity keys loaded from cache (session rehydration)');
                    return { status: 'READY', existed: true, algorithm };
                }

                // Cache miss - need to decrypt
                console.log('🔐 [PHASE 1] No cached identity found, need to decrypt...');

                const { identityPublicKey, encryptedIdentityPrivateKey, identityPrivateKeyIv, umekProtectionType, umekEnvelope, umekSalt, algorithm } = cryptoState;

                // STEP 2: Recover UMEK (ONLY if cache is missing)
                let umek;
                if (umekProtectionType === 'PASSWORD') {
                    // 🚫 ONLY prompt for password if cache is missing
                    if (!password) {
                        console.warn('🔐 [PHASE 1] Password-protected identity cache missing - password required');
                        return {
                            status: 'PASSWORD_REQUIRED',
                            reason: 'CACHE_MISSING_PASSWORD_NEEDED'
                        };
                    }
                    console.log('🔑 [PHASE 1] Deriving UMEK from password...');
                    const { deriveUMEKFromPassword, base64ToArrayBuffer } = await import('../utils/crypto.js');
                    const salt = base64ToArrayBuffer(umekSalt);
                    umek = await deriveUMEKFromPassword(password, new Uint8Array(salt));
                } else if (umekProtectionType === 'SERVER_KEK') {
                    console.log('🔑 [PHASE 1] Unwrapping UMEK from server KEK...');
                    umek = await this._unwrapUMEKFromServer(umekEnvelope);
                } else {
                    throw new Error('Unknown UMEK protection type: ' + umekProtectionType);
                }

                // STEP 3: Decrypt identity private key
                console.log('🔓 [PHASE 1] Decrypting identity private key...');
                const { decryptIdentityPrivateKey } = await import('../utils/crypto.js');
                const privateKeyJWK = await decryptIdentityPrivateKey(
                    encryptedIdentityPrivateKey,
                    identityPrivateKeyIv,
                    umek
                );

                // STEP 4: Import keys into memory
                this.myPrivateKey = await importPrivateKeyJWK(JSON.parse(privateKeyJWK), algorithm);
                this.myPublicKey = await importPublicKeyPEM(identityPublicKey, algorithm);
                this.myAlgorithm = algorithm;
                this.myUserId = userId;

                // Cache own public key
                this.publicKeysCache.set(userId, {
                    publicKey: this.myPublicKey,
                    algorithm: this.myAlgorithm
                });

                // 💾 CRITICAL: Cache decrypted identity for future sessions
                try {
                    await storeIdentityKeyPair(userId, {
                        privateKeyJWK: JSON.parse(privateKeyJWK),
                        publicKeyPEM: identityPublicKey,
                        algorithm,
                        version: cryptoState.version || 1
                    });
                    console.log('💾 [PHASE 1] Cached decrypted identity in IndexedDB (password won\'t be needed on refresh)');
                } catch (err) {
                    console.warn('⚠️ [PHASE 1] IndexedDB cache failed (non-critical):', err);
                }

                // 🔥 CRITICAL: Ensure public key is uploaded to identity service
                // This handles the case where identity was recovered but public key wasn't uploaded yet
                try {
                    console.log('📤 [PHASE 1] Verifying public key distribution...');
                    await this._uploadPublicKeyToIdentityService(identityPublicKey, algorithm, cryptoState.version || 1);
                    console.log('✅ [PHASE 1] Public key ensured in identity service');
                } catch (err) {
                    // Don't fail if upload fails - key might already exist
                    console.warn('⚠️ [PHASE 1] Public key upload warning (non-critical):', err.message);
                }

                console.log('✅ [PHASE 1] Identity keys recovered and cached successfully');
                return { status: 'READY', existed: true, algorithm };

            } else {
                // FIRST-TIME SETUP: Generate new keys and UMEK
                console.log('🆕 [PHASE 1] No crypto state found, generating new identity keys...');

                // STEP 1: Generate identity keypair
                const keyPair = await generateIdentityKeyPair();
                const privateKeyJWK = await exportPrivateKeyJWK(keyPair.privateKey);
                const publicKeyPEM = await exportPublicKeyPEM(keyPair.publicKey, keyPair.algorithm);

                // STEP 2: Generate or derive UMEK
                const { generateUMEK, deriveUMEKFromPassword, generateSalt, encryptIdentityPrivateKey, arrayBufferToBase64, exportKey } = await import('../utils/crypto.js');

                let umek;
                let umekProtectionType;
                let umekEnvelope;
                let umekEnvelopeIv = null;
                let umekSalt = null;

                if (password) {
                    // Password user: derive UMEK from password
                    console.log('🔑 [PHASE 1] Deriving UMEK from password...');
                    const salt = generateSalt();
                    umek = await deriveUMEKFromPassword(password, salt);
                    umekProtectionType = 'PASSWORD';
                    umekSalt = arrayBufferToBase64(salt);

                    // Encrypt UMEK envelope (UMEK wrapped with password-derived key)
                    // For PASSWORD mode, umekEnvelope is just the UMEK itself (will be re-derived on login)
                    const umekBytes = await exportKey(umek);
                    umekEnvelope = arrayBufferToBase64(umekBytes);
                } else {
                    // OAuth skip-password user: generate random UMEK, wrap with server KEK
                    console.log('🔑 [PHASE 1] Generating random UMEK...');
                    umek = await generateUMEK();
                    umekProtectionType = 'SERVER_KEK';

                    // Export UMEK and send to server for wrapping
                    const umekBytes = await exportKey(umek);
                    const umekBase64 = arrayBufferToBase64(umekBytes);

                    // Server will wrap it with server KEK
                    umekEnvelope = umekBase64; // Will be wrapped by server
                }

                // STEP 3: Encrypt identity private key with UMEK
                console.log('🔒 [PHASE 1] Encrypting identity private key with UMEK...');
                const { encryptedPrivateKey, iv } = await encryptIdentityPrivateKey(
                    JSON.stringify(privateKeyJWK),
                    umek
                );

                // STEP 4: Send to server
                console.log('📤 [PHASE 1] Uploading encrypted identity state to server...');
                await this._uploadCryptoStateToServer({
                    identityPublicKey: publicKeyPEM,
                    encryptedIdentityPrivateKey: encryptedPrivateKey,
                    identityPrivateKeyIv: iv,
                    umekEnvelope,
                    umekEnvelopeIv,
                    umekSalt,
                    umekProtectionType,
                    algorithm: keyPair.algorithm,
                    version: keyPair.version
                });

                // STEP 5: Load into memory
                this.myPrivateKey = keyPair.privateKey;
                this.myPublicKey = keyPair.publicKey;
                this.myAlgorithm = keyPair.algorithm;
                this.myUserId = userId;

                // Cache own public key
                this.publicKeysCache.set(userId, {
                    publicKey: this.myPublicKey,
                    algorithm: this.myAlgorithm
                });

                // OPTIONAL: Cache in IndexedDB
                try {
                    await storeIdentityKeyPair(userId, {
                        privateKeyJWK,
                        publicKeyPEM,
                        algorithm: keyPair.algorithm,
                        version: keyPair.version
                    });
                    console.log('💾 [PHASE 1] Cached keys in IndexedDB');
                } catch (err) {
                    console.warn('⚠️ [PHASE 1] IndexedDB cache failed (non-critical):', err);
                }

                // 🔥 CRITICAL: Upload public key to identity service
                // MUST happen BEFORE workspace/channel/DM creation to prevent KEY_NOT_DISTRIBUTED
                try {
                    console.log('📤 [PHASE 1] Uploading public key to identity service...');
                    await this._uploadPublicKeyToIdentityService(publicKeyPEM, keyPair.algorithm, keyPair.version);
                    console.log('✅ [PHASE 1] Public key uploaded to identity service');
                } catch (err) {
                    console.error('❌ [PHASE 1] CRITICAL: Failed to upload public key to identity service:', err);
                    throw new Error('Public key distribution failed - cannot proceed with E2EE');
                }

                console.log('✅ [PHASE 1] New identity keys created and uploaded');
                return { status: 'READY', existed: false, algorithm: keyPair.algorithm };
            }

        } catch (error) {
            console.error('❌ [PHASE 1] Identity key initialization failed:', error);
            throw error;
        }
    }

    /**
     * Fetch crypto state from server
     * @private
     * @returns {Promise<object|null>}
     */
    async _fetchCryptoStateFromServer() {
        const { getDeviceId } = await import('../utils/deviceId.js');
        const deviceId = getDeviceId();

        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/crypto/identity`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
                'X-Device-ID': deviceId  // PHASE 3: Device tracking
            },
            credentials: 'include'
        });

        // ✅ FIRST-TIME USER — THIS IS NOT AN ERROR
        if (response.status === 404) {
            console.info('🆕 [PHASE 1] No crypto state on server (first login)');
            return null; // ⛔ DO NOT THROW
        }

        // 🚫 DEVICE REVOKED
        if (response.status === 403) {
            const data = await response.json().catch(() => ({}));
            if (data.code === 'DEVICE_REVOKED') {
                console.error('❌ [PHASE 3] Device revoked - clearing session');
                const { clearDeviceId } = await import('../utils/deviceId.js');
                clearDeviceId();
                window.location.href = '/login?reason=device_revoked';
                return null;
            }
        }

        // ❌ REAL SERVER ERROR
        if (!response.ok) {
            throw new Error(`Crypto state fetch failed: ${response.status}`);
        }

        return await response.json();
    }


    /**
     * Upload crypto state to server
     * @private
     */
    async _uploadCryptoStateToServer(cryptoState) {
        try {
            const { getDeviceId } = await import('../utils/deviceId.js');
            const deviceId = getDeviceId();

            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/crypto/identity/init`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json',
                    'X-Device-ID': deviceId  // PHASE 3: Device tracking
                },
                credentials: 'include',
                body: JSON.stringify(cryptoState)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to upload crypto state: ${errorData.message || response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error uploading crypto state:', error);
            throw error;
        }
    }

    /**
     * Upload public key to identity service
     * @private
     * @param {string} publicKeyPEM - Public key in PEM format
     * @param {string} algorithm - Algorithm (X25519 or RSA-2048)
     * @param {number} version - Key version
     */
    async _uploadPublicKeyToIdentityService(publicKeyPEM, algorithm, version) {
        try {
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/identity/public-key`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    publicKey: publicKeyPEM,
                    algorithm,
                    version
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to upload public key: ${errorData.message || response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error uploading public key to identity service:', error);
            throw error;
        }
    }

    /**
     * Unwrap UMEK from server (for OAuth skip-password users)
     * Uses ephemeral session key (ESK) wrapping for secure transport
     * 
     * SECURITY: Server NEVER sends plaintext UMEK over network
     * @private
     */
    async _unwrapUMEKFromServer(umekEnvelope) {
        try {
            // STEP 1: Generate client ephemeral ECDH keypair
            const clientECDH = crypto.subtle.generateKey(
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'
                },
                true,
                ['deriveKey', 'deriveBits']
            );

            const clientKeyPair = await clientECDH;

            // Export client ephemeral public key
            const clientPublicKeyRaw = await crypto.subtle.exportKey('raw', clientKeyPair.publicKey);
            const clientPublicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(clientPublicKeyRaw)));

            // STEP 2: Request UMEK from server with client ephemeral public key
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/crypto/identity/unwrap-umek`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    umekEnvelope,
                    clientEphemeralPublicKey: clientPublicKeyBase64
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to unwrap UMEK: ${response.status}`);
            }

            const { serverEphemeralPublicKey, rewrappedUmek } = await response.json();

            // STEP 3: Import server ephemeral public key
            const serverPublicKeyBuffer = Uint8Array.from(atob(serverEphemeralPublicKey), c => c.charCodeAt(0));
            const serverPublicKey = await crypto.subtle.importKey(
                'raw',
                serverPublicKeyBuffer,
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'
                },
                false,
                []
            );

            // STEP 4: Derive shared secret
            const sharedSecretBits = await crypto.subtle.deriveBits(
                {
                    name: 'ECDH',
                    public: serverPublicKey
                },
                clientKeyPair.privateKey,
                256
            );

            // STEP 5: Derive wrapping key from shared secret (same HKDF as server)
            const sharedSecret = new Uint8Array(sharedSecretBits);
            const salt = new TextEncoder().encode('umek-wrap-v1');

            // Use Web Crypto PBKDF2 to match server
            const keyMaterial = await crypto.subtle.importKey(
                'raw',
                sharedSecret,
                'PBKDF2',
                false,
                ['deriveKey']
            );

            const wrappingKey = await crypto.subtle.deriveKey(
                {
                    name: 'PBKDF2',
                    salt: salt,
                    iterations: 10000,
                    hash: 'SHA-256'
                },
                keyMaterial,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                false,
                ['decrypt']
            );

            // STEP 6: Unwrap UMEK locally
            const rewrappedBuffer = Uint8Array.from(atob(rewrappedUmek), c => c.charCodeAt(0));
            const iv = rewrappedBuffer.slice(0, 12);
            const authTag = rewrappedBuffer.slice(12, 28);
            const ciphertext = rewrappedBuffer.slice(28);

            // Reconstruct ciphertext with auth tag
            const combined = new Uint8Array(ciphertext.length + authTag.length);
            combined.set(ciphertext);
            combined.set(authTag, ciphertext.length);

            const umekBytes = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv,
                    tagLength: 128
                },
                wrappingKey,
                combined
            );

            // STEP 7: Import UMEK as CryptoKey
            const umek = await crypto.subtle.importKey(
                'raw',
                umekBytes,
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true,
                ['encrypt', 'decrypt']
            );

            console.log('✅ [ESK] UMEK unwrapped using ephemeral session key (never plaintext over network)');
            return umek;

        } catch (error) {
            console.error('Error unwrapping UMEK:', error);
            throw error;
        }
    }


    /**
     * Rotate UMEK protection (password change)
     * PHASE 2: Change password without regenerating identity keys
     * 
     * @param {string} oldPassword - Current password
     * @param {string} newPassword - New password
     * @returns {Promise<void>}
     */
    async rotateUMEK(oldPassword, newPassword) {
        console.log('🔄 [PHASE 2] Starting UMEK rotation (password change)');

        try {
            // STEP 1: Fetch current crypto state
            const cryptoState = await this._fetchCryptoStateFromServer();

            if (!cryptoState) {
                throw new Error('No crypto state found. Identity keys not initialized.');
            }

            if (cryptoState.umekProtectionType !== 'PASSWORD') {
                throw new Error('Can only rotate password-protected UMEK. Use migrateToPasswordProtection for OAuth users.');
            }

            // STEP 2: Derive OLD UMEK from old password
            console.log('🔑 Deriving OLD UMEK from old password...');
            const { deriveUMEKFromPassword, base64ToArrayBuffer } = await import('../utils/crypto.js');
            const oldSalt = base64ToArrayBuffer(cryptoState.umekSalt);
            const oldUMEK = await deriveUMEKFromPassword(oldPassword, new Uint8Array(oldSalt));

            // STEP 3: Decrypt identity private key (validates old password)
            console.log('🔓 Decrypting identity private key...');
            const { decryptIdentityPrivateKey } = await import('../utils/crypto.js');
            let identityPrivateKeyJWK;
            try {
                identityPrivateKeyJWK = await decryptIdentityPrivateKey(
                    cryptoState.encryptedIdentityPrivateKey,
                    cryptoState.identityPrivateKeyIv,
                    oldUMEK
                );
            } catch (err) {
                console.error('❌ Failed to decrypt with old password:', err);
                throw new Error('Incorrect old password');
            }

            console.log('✅ Old password validated');

            // STEP 4: Derive NEW UMEK from new password
            console.log('🔑 Deriving NEW UMEK from new password...');
            const { generateSalt } = await import('../utils/crypto.js');
            const newSalt = generateSalt();
            const newUMEK = await deriveUMEKFromPassword(newPassword, newSalt);

            // STEP 5: Re-encrypt identity private key with NEW UMEK
            console.log('🔒 Re-encrypting identity private key with NEW UMEK...');
            const { encryptIdentityPrivateKey, arrayBufferToBase64 } = await import('../utils/crypto.js');
            const { encryptedPrivateKey, iv } = await encryptIdentityPrivateKey(
                identityPrivateKeyJWK,
                newUMEK
            );

            // STEP 6: Upload to server
            console.log('📤 Uploading rotated UMEK to server...');
            await this._rotateUMEKOnServer({
                encryptedIdentityPrivateKey: encryptedPrivateKey,
                identityPrivateKeyIv: iv,
                umekSalt: arrayBufferToBase64(newSalt),
                umekProtectionType: 'PASSWORD',
                currentVersion: cryptoState.version
            });

            console.log('✅ [PHASE 2] Password changed successfully');
            console.log('   - Identity keys: UNCHANGED ✅');
            console.log('   - UMEK protection: Rotated to new password ✅');

        } catch (error) {
            console.error('❌ [PHASE 2] UMEK rotation failed:', error);
            throw error;
        }
    }

    /**
     * Migrate OAuth user to password protection
     * PHASE 2: OAuth skip-password users set password
     * 
     * @param {string} newPassword - Password to set
     * @returns {Promise<void>}
     */
    async migrateToPasswordProtection(newPassword) {
        console.log('🔄 [PHASE 2] Starting OAuth → PASSWORD migration');

        try {
            // STEP 1: Fetch current crypto state
            const cryptoState = await this._fetchCryptoStateFromServer();

            if (!cryptoState) {
                throw new Error('No crypto state found. Identity keys not initialized.');
            }

            if (cryptoState.umekProtectionType !== 'SERVER_KEK') {
                throw new Error('User already has password-protected UMEK. Use rotateUMEK to change password.');
            }

            // STEP 2: Recover CURRENT UMEK via server KEK (Phase 1 mechanism)
            console.log('🔑 Recovering UMEK from server KEK...');
            const currentUMEK = await this._unwrapUMEKFromServer(cryptoState.umekEnvelope);

            // STEP 3: Decrypt identity private key
            console.log('🔓 Decrypting identity private key...');
            const { decryptIdentityPrivateKey } = await import('../utils/crypto.js');
            const identityPrivateKeyJWK = await decryptIdentityPrivateKey(
                cryptoState.encryptedIdentityPrivateKey,
                cryptoState.identityPrivateKeyIv,
                currentUMEK
            );

            // STEP 4: Derive NEW UMEK from password
            console.log('🔑 Deriving NEW UMEK from password...');
            const { deriveUMEKFromPassword, generateSalt } = await import('../utils/crypto.js');
            const newSalt = generateSalt();
            const newUMEK = await deriveUMEKFromPassword(newPassword, newSalt);

            // STEP 5: Re-encrypt identity private key
            console.log('🔒 Re-encrypting identity private key with password-derived UMEK...');
            const { encryptIdentityPrivateKey, arrayBufferToBase64 } = await import('../utils/crypto.js');
            const { encryptedPrivateKey, iv } = await encryptIdentityPrivateKey(
                identityPrivateKeyJWK,
                newUMEK
            );

            // STEP 6: Upload to server (migrates protection type)
            console.log('📤 Uploading migrated UMEK to server...');
            await this._rotateUMEKOnServer({
                encryptedIdentityPrivateKey: encryptedPrivateKey,
                identityPrivateKeyIv: iv,
                umekSalt: arrayBufferToBase64(newSalt),
                umekProtectionType: 'PASSWORD',  // ← Migration
                currentVersion: cryptoState.version
            });

            console.log('✅ [PHASE 2] Migrated to password protection');
            console.log('   - Identity keys: UNCHANGED ✅');
            console.log('   - UMEK protection: SERVER_KEK → PASSWORD ✅');
            console.log('   - OAuth login: Still works ✅');
            console.log('   - Email+password login: Now works ✅');

        } catch (error) {
            console.error('❌ [PHASE 2] Migration failed:', error);
            throw error;
        }
    }

    /**
     * Upload rotated UMEK to server
     * @private
     */
    async _rotateUMEKOnServer(payload) {
        try {
            const { getDeviceId } = await import('../utils/deviceId.js');
            const deviceId = getDeviceId();

            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/crypto/identity/rotate-umek`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json',
                    'X-Device-ID': deviceId  // PHASE 3: Device tracking
                },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (response.status === 409) {
                const data = await response.json();
                throw new Error(`Version conflict: ${data.message}. Please try again.`);
            }

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to rotate UMEK');
            }

            return await response.json();
        } catch (error) {
            console.error('Error rotating UMEK on server:', error);
            throw error;
        }
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
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/identity/users/${userId}/public-key`, {
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
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/identity/public-keys`, {
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
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/identity/public-key`, {
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
