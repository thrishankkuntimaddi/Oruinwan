// client/src/utils/encryptionUtils.js
/**
 * End-to-End Encryption Utilities
 * 
 * Provides client-side encryption/decryption using:
 * - ECDH for key exchange
 * - AES-256-GCM for message encryption
 * - PBKDF2 for password-based key derivation
 * 
 * @module encryptionUtils
 */

/**
 * Generate a new ECDH keypair for the user
 * @returns {Promise<{publicKey: string, privateKey: string}>}
 */
export async function generateKeyPair() {
    try {
        // Generate ECDH keypair using WebCrypto API
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'ECDH',
                namedCurve: 'P-256' // secp256r1
            },
            true, // extractable
            ['deriveKey', 'deriveBits']
        );

        // Export public key
        const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);
        const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicKeyBuffer)));

        // Export private key
        const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const privateKey = btoa(String.fromCharCode(...new Uint8Array(privateKeyBuffer)));

        return { publicKey, privateKey };
    } catch (err) {
        console.error('Failed to generate keypair:', err);
        throw new Error('Key generation failed');
    }
}

/**
 * Encrypt private key with user password using AES-256-GCM
 * @param {string} privateKey - Base64-encoded private key
 * @param {string} password - User password
 * @returns {Promise<{ciphertext: string, iv: string, salt: string, authTag: string}>}
 */
export async function encryptPrivateKey(privateKey, password) {
    try {
        // Generate salt for PBKDF2
        const salt = window.crypto.getRandomValues(new Uint8Array(16));

        // Derive encryption key from password
        const passwordKey = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt']
        );

        // Generate IV for AES-GCM
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        // Encrypt private key
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv
            },
            derivedKey,
            new TextEncoder().encode(privateKey)
        );

        // Extract ciphertext and auth tag
        const encryptedArray = new Uint8Array(encrypted);
        const ciphertext = encryptedArray.slice(0, -16);
        const authTag = encryptedArray.slice(-16);

        return {
            ciphertext: btoa(String.fromCharCode(...ciphertext)),
            iv: btoa(String.fromCharCode(...iv)),
            salt: btoa(String.fromCharCode(...salt)),
            authTag: btoa(String.fromCharCode(...authTag))
        };
    } catch (err) {
        console.error('Failed to encrypt private key:', err);
        throw new Error('Private key encryption failed');
    }
}

/**
 * Decrypt private key with user password
 * @param {Object} encryptedData - {ciphertext, iv, salt, authTag}
 * @param {string} password - User password
 * @returns {Promise<string>} Base64-encoded private key
 */
export async function decryptPrivateKey(encryptedData, password) {
    try {
        const { ciphertext, iv, salt, authTag } = encryptedData;

        // Convert from base64
        const saltBuffer = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
        const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
        const ciphertextBuffer = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
        const authTagBuffer = Uint8Array.from(atob(authTag), c => c.charCodeAt(0));

        // Derive key from password
        const passwordKey = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        const derivedKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: 100000,
                hash: 'SHA-256'
            },
            passwordKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['decrypt']
        );

        // Combine ciphertext and auth tag
        const combined = new Uint8Array([...ciphertextBuffer, ...authTagBuffer]);

        // Decrypt private key
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: ivBuffer
            },
            derivedKey,
            combined
        );

        return new TextDecoder().decode(decrypted);
    } catch (err) {
        console.error('Failed to decrypt private key:', err);
        throw new Error('Private key decryption failed');
    }
}

/**
 * Derive shared secret using ECDH
 * @param {string} myPrivateKey - Base64-encoded private key
 * @param {string} theirPublicKey - Base64-encoded public key
 * @returns {Promise<CryptoKey>} Shared secret key
 */
export async function deriveSharedSecret(myPrivateKey, theirPublicKey) {
    try {
        // Import private key
        const privateKeyBuffer = Uint8Array.from(atob(myPrivateKey), c => c.charCodeAt(0));
        const privateKey = await window.crypto.subtle.importKey(
            'pkcs8',
            privateKeyBuffer,
            {
                name: 'ECDH',
                namedCurve: 'P-256'
            },
            false,
            ['deriveKey', 'deriveBits']
        );

        // Import public key
        const publicKeyBuffer = Uint8Array.from(atob(theirPublicKey), c => c.charCodeAt(0));
        const publicKey = await window.crypto.subtle.importKey(
            'spki',
            publicKeyBuffer,
            {
                name: 'ECDH',
                namedCurve: 'P-256'
            },
            false,
            []
        );

        // Derive shared secret
        const sharedSecret = await window.crypto.subtle.deriveKey(
            {
                name: 'ECDH',
                public: publicKey
            },
            privateKey,
            {
                name: 'AES-GCM',
                length: 256
            },
            false,
            ['encrypt', 'decrypt']
        );

        return sharedSecret;
    } catch (err) {
        console.error('Failed to derive shared secret:', err);
        throw new Error('Shared secret derivation failed');
    }
}

/**
 * Encrypt message with AES-256-GCM
 * @param {string} plaintext - Message to encrypt
 * @param {CryptoKey} sharedSecret - Shared secret key
 * @returns {Promise<{ciphertext: string, iv: string}>}
 */
export async function encryptMessage(plaintext, sharedSecret) {
    try {
        // Generate IV
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        // Encrypt message
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv
            },
            sharedSecret,
            new TextEncoder().encode(plaintext)
        );

        return {
            ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
            iv: btoa(String.fromCharCode(...iv))
        };
    } catch (err) {
        console.error('Failed to encrypt message:', err);
        throw new Error('Message encryption failed');
    }
}

/**
 * Decrypt message with AES-256-GCM
 * @param {string} ciphertext - Base64-encoded ciphertext
 * @param {string} messageIv - Base64-encoded IV
 * @param {CryptoKey} sharedSecret - Shared secret key
 * @returns {Promise<string>} Decrypted plaintext
 */
export async function decryptMessage(ciphertext, messageIv, sharedSecret) {
    try {
        // Convert from base64
        const ciphertextBuffer = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
        const ivBuffer = Uint8Array.from(atob(messageIv), c => c.charCodeAt(0));

        // Decrypt message
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: ivBuffer
            },
            sharedSecret,
            ciphertextBuffer
        );

        return new TextDecoder().decode(decrypted);
    } catch (err) {
        console.error('Failed to decrypt message:', err);
        return '[Encrypted message - decryption failed]';
    }
}

/**
 * Store keys in IndexedDB for secure client-side storage
 * @param {string} userId - User ID
 * @param {string} privateKey - Base64-encoded private key
 * @returns {Promise<void>}
 */
export async function storeKeys(userId, privateKey) {
    const dbName = 'ChttrixEncryption';
    const storeName = 'keys';

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));

        request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            const data = {
                userId,
                privateKey,
                timestamp: Date.now()
            };

            store.put(data);

            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
            transaction.onerror = () => reject(new Error('Transaction failed'));
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'userId' });
            }
        };
    });
}

/**
 * Retrieve keys from IndexedDB
 * @param {string} userId - User ID
 * @returns {Promise<{userId: string, privateKey: string, timestamp: number}|null>}
 */
export async function getStoredKeys(userId) {
    const dbName = 'ChttrixEncryption';
    const storeName = 'keys';

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'userId' });
            }
        };

        request.onsuccess = () => {
            const db = request.result;

            // Check if object store exists
            if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                resolve(null);
                return;
            }

            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const getRequest = store.get(userId);

            getRequest.onsuccess = () => {
                db.close();
                resolve(getRequest.result || null);
            };
            getRequest.onerror = () => {
                db.close();
                reject(new Error('Failed to retrieve keys'));
            };
        };
    });
}

/**
 * Clear stored keys from IndexedDB (on logout)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function clearKeys(userId) {
    const dbName = 'ChttrixEncryption';
    const storeName = 'keys';

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(new Error('Failed to open IndexedDB'));

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'userId' });
            }
        };

        request.onsuccess = () => {
            const db = request.result;

            // Check if object store exists
            if (!db.objectStoreNames.contains(storeName)) {
                db.close();
                resolve(); // Nothing to clear
                return;
            }

            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            store.delete(userId);

            transaction.oncomplete = () => {
                db.close();
                resolve();
            };
            transaction.onerror = () => {
                db.close();
                reject(new Error('Failed to clear keys'));
            };
        };
    });
}
