import {
    generateIdentityKeyPair,
    exportPublicKeyPEM,
    importPublicKeyPEM,
    exportPrivateKeyJWK,
    importPrivateKeyJWK,
    checkCryptoSupport
} from '../utils/cryptoIdentity';

const DB_NAME = 'ChttrixE2EE';
const DB_VERSION = 1;
const STORE_NAME = 'identityKeys';

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

class IdentityKeyService {
    constructor() {
        this.publicKeysCache = new Map(); 
        this.myPrivateKey = null;
        this.myPublicKey = null;
        this.myAlgorithm = null;
        this.myUserId = null;

        
        this.setupLogoutListener();
    }

    
    setupLogoutListener() {
        window.addEventListener('auth:logout', () => {
            this.clearCache();
        });
    }

    
    async hasIdentityKey(userId) {
        try {
            const keyData = await getIdentityKeyPair(userId);
            return keyData !== null;
        } catch (error) {
            console.error('Error checking identity key:', error);
            return false;
        }
    }

    
    async initializeIdentityKeys(userId, password = null) {
        const support = checkCryptoSupport();
        if (!support.indexedDB) {
            throw new Error('IndexedDB not available - cannot use E2EE');
        }

        console.log('🔐 [PHASE 1] Initializing identity keys for user:', userId);

        try {
            
            const cryptoState = await this._fetchCryptoStateFromServer();

            if (cryptoState) {
                
                console.log('✅ [PHASE 1] Found existing crypto state on server');

                
                const cachedIdentity = await getIdentityKeyPair(userId);
                if (cachedIdentity && cachedIdentity.privateKeyJWK) {
                    console.log('✅ [PHASE 1] Using cached decrypted identity key (no password needed)');

                    
                    const { identityPublicKey, algorithm } = cryptoState;
                    this.myPrivateKey = await importPrivateKeyJWK(cachedIdentity.privateKeyJWK, algorithm);
                    this.myPublicKey = await importPublicKeyPEM(identityPublicKey, algorithm);
                    this.myAlgorithm = algorithm;
                    this.myUserId = userId;

                    
                    this.publicKeysCache.set(userId, {
                        publicKey: this.myPublicKey,
                        algorithm: this.myAlgorithm
                    });

                    console.log('✅ [PHASE 1] Identity keys loaded from cache (session rehydration)');
                    return { status: 'READY', existed: true, algorithm };
                }

                
                console.log('🔐 [PHASE 1] No cached identity found, need to decrypt...');

                const { identityPublicKey, encryptedIdentityPrivateKey, identityPrivateKeyIv, umekProtectionType, umekEnvelope, umekSalt, algorithm } = cryptoState;

                
                let umek;
                if (umekProtectionType === 'PASSWORD') {
                    
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

                
                console.log('🔓 [PHASE 1] Decrypting identity private key...');
                const { decryptIdentityPrivateKey } = await import('../utils/crypto.js');
                const privateKeyJWK = await decryptIdentityPrivateKey(
                    encryptedIdentityPrivateKey,
                    identityPrivateKeyIv,
                    umek
                );

                
                this.myPrivateKey = await importPrivateKeyJWK(JSON.parse(privateKeyJWK), algorithm);
                this.myPublicKey = await importPublicKeyPEM(identityPublicKey, algorithm);
                this.myAlgorithm = algorithm;
                this.myUserId = userId;

                
                this.publicKeysCache.set(userId, {
                    publicKey: this.myPublicKey,
                    algorithm: this.myAlgorithm
                });

                
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

                
                
                try {
                    console.log('📤 [PHASE 1] Verifying public key distribution...');
                    await this._uploadPublicKeyToIdentityService(identityPublicKey, algorithm, cryptoState.version || 1);
                    console.log('✅ [PHASE 1] Public key ensured in identity service');
                } catch (err) {
                    
                    console.warn('⚠️ [PHASE 1] Public key upload warning (non-critical):', err.message);
                }

                console.log('✅ [PHASE 1] Identity keys recovered and cached successfully');
                return { status: 'READY', existed: true, algorithm };

            } else {
                
                console.log('🆕 [PHASE 1] No crypto state found, generating new identity keys...');

                
                const keyPair = await generateIdentityKeyPair();
                const privateKeyJWK = await exportPrivateKeyJWK(keyPair.privateKey);
                const publicKeyPEM = await exportPublicKeyPEM(keyPair.publicKey, keyPair.algorithm);

                
                const { generateUMEK, deriveUMEKFromPassword, generateSalt, encryptIdentityPrivateKey, arrayBufferToBase64, exportKey } = await import('../utils/crypto.js');

                let umek;
                let umekProtectionType;
                let umekEnvelope;
                let umekEnvelopeIv = null;
                let umekSalt = null;

                if (password) {
                    
                    console.log('🔑 [PHASE 1] Deriving UMEK from password...');
                    const salt = generateSalt();
                    umek = await deriveUMEKFromPassword(password, salt);
                    umekProtectionType = 'PASSWORD';
                    umekSalt = arrayBufferToBase64(salt);

                    
                    
                    const umekBytes = await exportKey(umek);
                    umekEnvelope = arrayBufferToBase64(umekBytes);
                } else {
                    
                    console.log('🔑 [PHASE 1] Generating random UMEK...');
                    umek = await generateUMEK();
                    umekProtectionType = 'SERVER_KEK';

                    
                    const umekBytes = await exportKey(umek);
                    const umekBase64 = arrayBufferToBase64(umekBytes);

                    
                    umekEnvelope = umekBase64; 
                }

                
                console.log('🔒 [PHASE 1] Encrypting identity private key with UMEK...');
                const { encryptedPrivateKey, iv } = await encryptIdentityPrivateKey(
                    JSON.stringify(privateKeyJWK),
                    umek
                );

                
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

                
                this.myPrivateKey = keyPair.privateKey;
                this.myPublicKey = keyPair.publicKey;
                this.myAlgorithm = keyPair.algorithm;
                this.myUserId = userId;

                
                this.publicKeysCache.set(userId, {
                    publicKey: this.myPublicKey,
                    algorithm: this.myAlgorithm
                });

                
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

    
    async _fetchCryptoStateFromServer() {
        const { getDeviceId } = await import('../utils/deviceId.js');
        const deviceId = getDeviceId();

        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/crypto/identity`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
                'X-Device-ID': deviceId  
            },
            credentials: 'include'
        });

        
        if (response.status === 404) {
            console.info('🆕 [PHASE 1] No crypto state on server (first login)');
            return null; 
        }

        
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

        
        if (!response.ok) {
            throw new Error(`Crypto state fetch failed: ${response.status}`);
        }

        return await response.json();
    }

    
    async _uploadCryptoStateToServer(cryptoState) {
        try {
            const { getDeviceId } = await import('../utils/deviceId.js');
            const deviceId = getDeviceId();

            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/crypto/identity/init`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json',
                    'X-Device-ID': deviceId  
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

    
    async _unwrapUMEKFromServer(umekEnvelope) {
        try {
            
            const clientECDH = crypto.subtle.generateKey(
                {
                    name: 'ECDH',
                    namedCurve: 'P-256'
                },
                true,
                ['deriveKey', 'deriveBits']
            );

            const clientKeyPair = await clientECDH;

            
            const clientPublicKeyRaw = await crypto.subtle.exportKey('raw', clientKeyPair.publicKey);
            const clientPublicKeyBase64 = btoa(String.fromCharCode(...new Uint8Array(clientPublicKeyRaw)));

            
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

            
            const sharedSecretBits = await crypto.subtle.deriveBits(
                {
                    name: 'ECDH',
                    public: serverPublicKey
                },
                clientKeyPair.privateKey,
                256
            );

            
            const sharedSecret = new Uint8Array(sharedSecretBits);
            const salt = new TextEncoder().encode('umek-wrap-v1');

            
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

            
            const rewrappedBuffer = Uint8Array.from(atob(rewrappedUmek), c => c.charCodeAt(0));
            const iv = rewrappedBuffer.slice(0, 12);
            const authTag = rewrappedBuffer.slice(12, 28);
            const ciphertext = rewrappedBuffer.slice(28);

            
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

    
    async rotateUMEK(oldPassword, newPassword) {
        console.log('🔄 [PHASE 2] Starting UMEK rotation (password change)');

        try {
            
            const cryptoState = await this._fetchCryptoStateFromServer();

            if (!cryptoState) {
                throw new Error('No crypto state found. Identity keys not initialized.');
            }

            if (cryptoState.umekProtectionType !== 'PASSWORD') {
                throw new Error('Can only rotate password-protected UMEK. Use migrateToPasswordProtection for OAuth users.');
            }

            
            console.log('🔑 Deriving OLD UMEK from old password...');
            const { deriveUMEKFromPassword, base64ToArrayBuffer } = await import('../utils/crypto.js');
            const oldSalt = base64ToArrayBuffer(cryptoState.umekSalt);
            const oldUMEK = await deriveUMEKFromPassword(oldPassword, new Uint8Array(oldSalt));

            
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

            
            console.log('🔑 Deriving NEW UMEK from new password...');
            const { generateSalt } = await import('../utils/crypto.js');
            const newSalt = generateSalt();
            const newUMEK = await deriveUMEKFromPassword(newPassword, newSalt);

            
            console.log('🔒 Re-encrypting identity private key with NEW UMEK...');
            const { encryptIdentityPrivateKey, arrayBufferToBase64 } = await import('../utils/crypto.js');
            const { encryptedPrivateKey, iv } = await encryptIdentityPrivateKey(
                identityPrivateKeyJWK,
                newUMEK
            );

            
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

    
    async migrateToPasswordProtection(newPassword) {
        console.log('🔄 [PHASE 2] Starting OAuth → PASSWORD migration');

        try {
            
            const cryptoState = await this._fetchCryptoStateFromServer();

            if (!cryptoState) {
                throw new Error('No crypto state found. Identity keys not initialized.');
            }

            if (cryptoState.umekProtectionType !== 'SERVER_KEK') {
                throw new Error('User already has password-protected UMEK. Use rotateUMEK to change password.');
            }

            
            console.log('🔑 Recovering UMEK from server KEK...');
            const currentUMEK = await this._unwrapUMEKFromServer(cryptoState.umekEnvelope);

            
            console.log('🔓 Decrypting identity private key...');
            const { decryptIdentityPrivateKey } = await import('../utils/crypto.js');
            const identityPrivateKeyJWK = await decryptIdentityPrivateKey(
                cryptoState.encryptedIdentityPrivateKey,
                cryptoState.identityPrivateKeyIv,
                currentUMEK
            );

            
            console.log('🔑 Deriving NEW UMEK from password...');
            const { deriveUMEKFromPassword, generateSalt } = await import('../utils/crypto.js');
            const newSalt = generateSalt();
            const newUMEK = await deriveUMEKFromPassword(newPassword, newSalt);

            
            console.log('🔒 Re-encrypting identity private key with password-derived UMEK...');
            const { encryptIdentityPrivateKey, arrayBufferToBase64 } = await import('../utils/crypto.js');
            const { encryptedPrivateKey, iv } = await encryptIdentityPrivateKey(
                identityPrivateKeyJWK,
                newUMEK
            );

            
            console.log('📤 Uploading migrated UMEK to server...');
            await this._rotateUMEKOnServer({
                encryptedIdentityPrivateKey: encryptedPrivateKey,
                identityPrivateKeyIv: iv,
                umekSalt: arrayBufferToBase64(newSalt),
                umekProtectionType: 'PASSWORD',  
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

    
    async _rotateUMEKOnServer(payload) {
        try {
            const { getDeviceId } = await import('../utils/deviceId.js');
            const deviceId = getDeviceId();

            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/crypto/identity/rotate-umek`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                    'Content-Type': 'application/json',
                    'X-Device-ID': deviceId  
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

    
    getMyPrivateKey() {
        if (!this.myPrivateKey) {
            throw new Error('Identity keys not initialized. Call initializeIdentityKeys first.');
        }
        return this.myPrivateKey;
    }

    
    async getUserPublicKey(userId) {
        
        if (this.publicKeysCache.has(userId)) {
            return this.publicKeysCache.get(userId);
        }

        try {
            
            const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v2/identity/users/${userId}/public-key`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch public key for user ${userId}`);
            }

            const data = await response.json();
            const { publicKey: publicKeyPEM, algorithm } = data;

            
            const publicKey = await importPublicKeyPEM(publicKeyPEM, algorithm);

            
            this.publicKeysCache.set(userId, { publicKey, algorithm });

            return { publicKey, algorithm };
        } catch (error) {
            console.error(`Failed to fetch public key for user ${userId}:`, error);
            throw error;
        }
    }

    
    async batchGetUserPublicKeys(userIds) {
        
        const uncachedUserIds = userIds.filter(id => !this.publicKeysCache.has(id));

        if (uncachedUserIds.length === 0) {
            
            const result = new Map();
            userIds.forEach(id => {
                if (this.publicKeysCache.has(id)) {
                    result.set(id, this.publicKeysCache.get(id));
                }
            });
            return result;
        }

        try {
            
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

            
            for (const { userId, publicKey: publicKeyPEM, algorithm } of publicKeys) {
                const publicKey = await importPublicKeyPEM(publicKeyPEM, algorithm);
                this.publicKeysCache.set(userId, { publicKey, algorithm });
            }

            
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

    
    clearCache() {
        this.publicKeysCache.clear();
        this.myPrivateKey = null;
        this.myPublicKey = null;
        this.myAlgorithm = null;
        this.myUserId = null;
    }

    
    async deleteKeys(userId) {
        await deleteIdentityKeyPair(userId);
        this.clearCache();
    }
}

const identityKeyService = new IdentityKeyService();

export default identityKeyService;
export { identityKeyService };
