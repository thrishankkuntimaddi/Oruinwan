/**
 * Identity Key Cryptography Utilities
 * 
 * Handles user identity keypairs for E2EE:
 * - X25519 key agreement (preferred)
 * - RSA-2048 (fallback for wider compatibility)
 * - Key wrapping for conversation keys
 * 
 * Keys are generated client-side only and private keys never leave the device.
 */

// ==================== CONSTANTS ====================

const IDENTITY_KEY_CONFIG = {
    // X25519 (preferred)
    x25519: {
        algorithm: 'X25519',
        namedCurve: 'X25519'
    },

    // RSA (fallback)
    rsa: {
        algorithm: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
        hash: 'SHA-256'
    },

    // For key wrapping
    aesGcm: {
        algorithm: 'AES-GCM',
        length: 256
    }
};

const KEY_VERSION = 1;

// ==================== BROWSER SUPPORT CHECK ====================

/**
 * Check if browser supports required crypto features
 * @returns {Object} Support status for each algorithm
 */
export function checkCryptoSupport() {
    const support = {
        x25519: false,
        rsa: false,
        indexedDB: false
    };

    if (typeof crypto === 'undefined' || !crypto.subtle) {
        return support;
    }

    // All modern browsers support RSA
    support.rsa = true;

    // X25519 is newer, check availability
    try {
        support.x25519 = crypto.subtle.generateKey !== undefined;
    } catch (e) {
        support.x25519 = false;
    }

    // Check IndexedDB
    support.indexedDB = typeof indexedDB !== 'undefined';

    return support;
}

// ==================== KEY GENERATION ====================

/**
 * Generate X25519 keypair (preferred method)
 * @returns {Promise<{publicKey: CryptoKey, privateKey: CryptoKey}>}
 */
export async function generateX25519KeyPair() {
    try {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'ECDH',
                namedCurve: 'X25519'
            },
            true, // extractable
            ['deriveKey']
        );

        return keyPair;
    } catch (error) {
        console.error('X25519 key generation failed:', error);
        throw new Error('Failed to generate X25519 keypair');
    }
}

/**
 * Generate RSA-2048 keypair (fallback method)
 * @returns {Promise<{publicKey: CryptoKey, privateKey: CryptoKey}>}
 */
export async function generateRSAKeyPair() {
    try {
        const keyPair = await crypto.subtle.generateKey(
            {
                name: IDENTITY_KEY_CONFIG.rsa.algorithm,
                modulusLength: IDENTITY_KEY_CONFIG.rsa.modulusLength,
                publicExponent: IDENTITY_KEY_CONFIG.rsa.publicExponent,
                hash: IDENTITY_KEY_CONFIG.rsa.hash
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );

        return keyPair;
    } catch (error) {
        console.error('RSA key generation failed:', error);
        throw new Error('Failed to generate RSA keypair');
    }
}

/**
 * Generate identity keypair (auto-selects best available algorithm)
 * @returns {Promise<{publicKey: CryptoKey, privateKey: CryptoKey, algorithm: string, version: number}>}
 */
export async function generateIdentityKeyPair() {
    const support = checkCryptoSupport();

    if (!support.indexedDB) {
        throw new Error('IndexedDB not available - cannot store keys securely');
    }

    let keyPair;
    let algorithm;

    // Try X25519 first (preferred)
    if (support.x25519) {
        try {
            keyPair = await generateX25519KeyPair();
            algorithm = 'X25519';
        } catch (error) {
            console.warn('X25519 generation failed, falling back to RSA:', error);
        }
    }

    // Fall back to RSA if X25519 not available or failed
    if (!keyPair && support.rsa) {
        keyPair = await generateRSAKeyPair();
        algorithm = 'RSA-2048';
    }

    if (!keyPair) {
        throw new Error('No supported identity key algorithm available');
    }

    return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        algorithm,
        version: KEY_VERSION
    };
}

// ==================== KEY EXPORT/IMPORT ====================

/**
 * Export public key to PEM format for server storage
 * @param {CryptoKey} publicKey 
 * @param {string} algorithm - 'X25519' or 'RSA-2048'
 * @returns {Promise<string>} PEM-encoded public key
 */
export async function exportPublicKeyPEM(publicKey, algorithm) {
    try {
        const format = algorithm === 'X25519' ? 'raw' : 'spki';
        const exported = await crypto.subtle.exportKey(format, publicKey);
        const exportedBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));

        // Standardize headers:
        // X25519 = X25519 PUBLIC KEY (non-standard but common for raw)
        // RSA = PUBLIC KEY (SPKI standard) -- NOT "RSA PUBLIC KEY" which is PKCS#1
        const keyType = algorithm === 'X25519' ? 'X25519 PUBLIC KEY' : 'PUBLIC KEY';
        const pem = `-----BEGIN ${keyType}-----\n${exportedBase64}\n-----END ${keyType}-----`;

        return pem;
    } catch (error) {
        console.error('Public key export failed:', error);
        throw new Error('Failed to export public key');
    }
}

/**
 * Import public key from PEM format
 * @param {string} pemKey - PEM-encoded public key
 * @param {string} algorithm - 'X25519' or 'RSA-2048'
 * @returns {Promise<CryptoKey>}
 */
export async function importPublicKeyPEM(pemKey, algorithm) {
    try {
        // Remove PEM headers and decode base64
        const pemContents = pemKey
            .replace(/-----BEGIN [A-Z0-9 ]+-----/, '')
            .replace(/-----END [A-Z0-9 ]+-----/, '')
            .replace(/\s/g, '');

        const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

        let keyConfig;
        let format;

        if (algorithm === 'X25519') {
            format = 'raw';
            keyConfig = {
                name: 'ECDH',
                namedCurve: 'X25519'
            };
        } else {
            format = 'spki';
            keyConfig = {
                name: 'RSA-OAEP',
                hash: 'SHA-256'
            };
        }

        const publicKey = await crypto.subtle.importKey(
            format,
            binaryDer.buffer,
            keyConfig,
            true,
            algorithm === 'X25519' ? [] : ['encrypt']
        );

        return publicKey;
    } catch (error) {
        console.error('Public key import failed:', error);
        throw new Error('Failed to import public key');
    }
}

/**
 * Export private key to JWK for IndexedDB storage
 * @param {CryptoKey} privateKey 
 * @returns {Promise<Object>} JWK object
 */
export async function exportPrivateKeyJWK(privateKey) {
    try {
        const jwk = await crypto.subtle.exportKey('jwk', privateKey);
        return jwk;
    } catch (error) {
        console.error('Private key export failed:', error);
        throw new Error('Failed to export private key');
    }
}

/**
 * Import private key from JWK
 * @param {Object} jwk - JWK object
 * @param {string} algorithm - 'X25519' or 'RSA-2048'
 * @returns {Promise<CryptoKey>}
 */
export async function importPrivateKeyJWK(jwk, algorithm) {
    try {
        let keyConfig;
        let usages;

        if (algorithm === 'X25519') {
            keyConfig = {
                name: 'ECDH',
                namedCurve: 'X25519'
            };
            usages = ['deriveKey'];
        } else {
            keyConfig = {
                name: 'RSA-OAEP',
                hash: 'SHA-256'
            };
            usages = ['decrypt'];
        }

        const privateKey = await crypto.subtle.importKey(
            'jwk',
            jwk,
            keyConfig,
            true,
            usages
        );

        return privateKey;
    } catch (error) {
        console.error('Private key import failed:', error);
        throw new Error('Failed to import private key');
    }
}

// ==================== KEY WRAPPING (Encrypt Conversation Keys) ====================

/**
 * Wrap (encrypt) a conversation key using RSA public key
 * @param {ArrayBuffer} conversationKeyBytes - Raw conversation key bytes
 * @param {CryptoKey} recipientPublicKey - Recipient's RSA public key
 * @returns {Promise<string>} Base64-encoded encrypted key
 */
export async function wrapKeyWithRSA(conversationKeyBytes, recipientPublicKey) {
    try {
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'RSA-OAEP'
            },
            recipientPublicKey,
            conversationKeyBytes
        );

        return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    } catch (error) {
        console.error('RSA key wrapping failed:', error);
        throw new Error('Failed to wrap key with RSA');
    }
}

/**
 * Unwrap (decrypt) a conversation key using RSA private key
 * @param {string} encryptedKeyBase64 - Base64-encoded encrypted key
 * @param {CryptoKey} privateKey - Own RSA private key
 * @returns {Promise<ArrayBuffer>} Decrypted conversation key bytes
 */
export async function unwrapKeyWithRSA(encryptedKeyBase64, privateKey) {
    try {
        const encryptedKey = Uint8Array.from(atob(encryptedKeyBase64), c => c.charCodeAt(0));

        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'RSA-OAEP'
            },
            privateKey,
            encryptedKey
        );

        return decrypted;
    } catch (error) {
        console.error('RSA key unwrapping failed:', error);
        throw new Error('Failed to unwrap key with RSA');
    }
}

/**
 * Wrap (encrypt) a conversation key using X25519 key agreement (ECIES-style)
 * @param {ArrayBuffer} conversationKeyBytes - Raw conversation key bytes
 * @param {CryptoKey} recipientPublicKey - Recipient's X25519 public key
 * @returns {Promise<{encryptedKey: string, ephemeralPublicKey: string}>}
 */
export async function wrapKeyWithX25519(conversationKeyBytes, recipientPublicKey) {
    try {
        // Generate ephemeral keypair for this operation
        const ephemeralKeyPair = await generateX25519KeyPair();

        // Derive shared secret
        const sharedSecret = await crypto.subtle.deriveKey(
            {
                name: 'ECDH',
                public: recipientPublicKey
            },
            ephemeralKeyPair.privateKey,
            {
                name: 'AES-GCM',
                length: 256
            },
            false,
            ['encrypt']
        );

        // Encrypt conversation key with shared secret
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            sharedSecret,
            conversationKeyBytes
        );

        // Export ephemeral public key
        const ephemeralPublicKeyRaw = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);

        // Combine IV + ciphertext
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);

        return {
            encryptedKey: btoa(String.fromCharCode(...combined)),
            ephemeralPublicKey: btoa(String.fromCharCode(...new Uint8Array(ephemeralPublicKeyRaw)))
        };
    } catch (error) {
        console.error('X25519 key wrapping failed:', error);
        throw new Error('Failed to wrap key with X25519');
    }
}

/**
 * Unwrap (decrypt) a conversation key using X25519 key agreement
 * @param {string} encryptedKeyBase64 - Base64-encoded encrypted key
 * @param {string} ephemeralPublicKeyBase64 - Base64-encoded ephemeral public key
 * @param {CryptoKey} privateKey - Own X25519 private key
 * @returns {Promise<ArrayBuffer>} Decrypted conversation key bytes
 */
export async function unwrapKeyWithX25519(encryptedKeyBase64, ephemeralPublicKeyBase64, privateKey) {
    try {
        // Import ephemeral public key
        const ephemeralPublicKeyRaw = Uint8Array.from(atob(ephemeralPublicKeyBase64), c => c.charCodeAt(0));
        const ephemeralPublicKey = await crypto.subtle.importKey(
            'raw',
            ephemeralPublicKeyRaw.buffer,
            {
                name: 'ECDH',
                namedCurve: 'X25519'
            },
            false,
            []
        );

        // Derive shared secret
        const sharedSecret = await crypto.subtle.deriveKey(
            {
                name: 'ECDH',
                public: ephemeralPublicKey
            },
            privateKey,
            {
                name: 'AES-GCM',
                length: 256
            },
            false,
            ['decrypt']
        );

        // Decode encrypted data
        const combined = Uint8Array.from(atob(encryptedKeyBase64), c => c.charCodeAt(0));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);

        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            sharedSecret,
            ciphertext
        );

        return decrypted;
    } catch (error) {
        console.error('X25519 key unwrapping failed:', error);
        throw new Error('Failed to unwrap key with X25519');
    }
}

// ==================== EXPORTS ====================

const cryptoIdentity = {
    // Support checking
    checkCryptoSupport,

    // Key generation
    generateIdentityKeyPair,
    generateX25519KeyPair,
    generateRSAKeyPair,

    // Export/Import
    exportPublicKeyPEM,
    importPublicKeyPEM,
    exportPrivateKeyJWK,
    importPrivateKeyJWK,

    // Key wrapping
    wrapKeyWithRSA,
    unwrapKeyWithRSA,
    wrapKeyWithX25519,
    unwrapKeyWithX25519,

    // Constants
    KEY_VERSION,
    IDENTITY_KEY_CONFIG
};

export default cryptoIdentity;
