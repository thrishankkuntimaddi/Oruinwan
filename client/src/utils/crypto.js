/**
 * E2EE Crypto Utilities
 * 
 * Core cryptographic functions for end-to-end encryption
 * Uses Web Crypto API (browser-native)
 * 
 * Algorithms:
 * - AES-256-GCM for message encryption
 * - PBKDF2-SHA256 for key derivation
 */

// ==================== CONSTANTS ====================

const CRYPTO_CONFIG = {
    // AES-GCM parameters
    algorithm: 'AES-GCM',
    keyLength: 256, // bits
    ivLength: 12, // bytes (96 bits)
    tagLength: 128, // bits

    // PBKDF2 parameters
    pbkdf2: {
        algorithm: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 100000,
        saltLength: 16, // bytes (128 bits)
        keyLength: 32 // bytes (256 bits)
    }
};

// ==================== KEY GENERATION ====================

/**
 * Generate a random 256-bit AES-GCM key
 * Used for workspace keys
 * 
 * @returns {Promise<CryptoKey>} 256-bit AES-GCM key
 */
export async function generateWorkspaceKey() {
    try {
        const key = await crypto.subtle.generateKey(
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true, // extractable (for storage)
            ['encrypt', 'decrypt']
        );

        return key;
    } catch (error) {
        console.error('Failed to generate workspace key:', error);
        throw new Error('Key generation failed');
    }
}

/**
 * Generate random initialization vector (IV/nonce)
 * Must be unique for each encryption operation
 * 
 * @returns {Uint8Array} 12-byte random IV
 */
export function generateIV() {
    return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.ivLength));
}

/**
 * Generate random salt for PBKDF2
 * 
 * @returns {Uint8Array} 16-byte random salt
 */
export function generateSalt() {
    return crypto.getRandomValues(new Uint8Array(CRYPTO_CONFIG.pbkdf2.saltLength));
}

// ==================== KEY DERIVATION ====================

/**
 * Derive a key from password using PBKDF2
 * Used to create Key Encryption Key (KEK) from user password
 * 
 * @param {string} password - User's password
 * @param {Uint8Array} salt - Random salt (must be stored)
 * @param {number} iterations - PBKDF2 iterations (default: 100000)
 * @returns {Promise<CryptoKey>} Derived 256-bit AES-GCM key
 */
export async function deriveKeyFromPassword(password, salt, iterations = CRYPTO_CONFIG.pbkdf2.iterations) {
    try {
        // Convert password to bytes
        const passwordBytes = new TextEncoder().encode(password);

        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBytes,
            CRYPTO_CONFIG.pbkdf2.algorithm,
            false,
            ['deriveKey']
        );

        // Derive AES-GCM key using PBKDF2
        const derivedKey = await crypto.subtle.deriveKey(
            {
                name: CRYPTO_CONFIG.pbkdf2.algorithm,
                salt: salt,
                iterations: iterations,
                hash: CRYPTO_CONFIG.pbkdf2.hash
            },
            keyMaterial,
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true, // extractable
            ['encrypt', 'decrypt']
        );

        return derivedKey;
    } catch (error) {
        console.error('Failed to derive key from password:', error);
        throw new Error('Key derivation failed');
    }
}

// ==================== UMEK (User Master Encryption Key) ====================

/**
 * Generate UMEK (User Master Encryption Key)
 * 256-bit random symmetric key used to encrypt identity private key
 * 
 * @returns {Promise<CryptoKey>} 256-bit AES-GCM UMEK
 */
export async function generateUMEK() {
    try {
        const umek = await crypto.subtle.generateKey(
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true, // extractable (needed for wrapping with server KEK)
            ['encrypt', 'decrypt']
        );
        return umek;
    } catch (error) {
        console.error('Failed to generate UMEK:', error);
        throw new Error('UMEK generation failed');
    }
}

/**
 * Derive UMEK from password (for password users)
 * Same as deriveKeyFromPassword but semantically named for UMEK
 * 
 * @param {string} password - User's password
 * @param {Uint8Array} salt - Random salt
 * @returns {Promise<CryptoKey>} Derived UMEK
 */
export async function deriveUMEKFromPassword(password, salt) {
    return deriveKeyFromPassword(password, salt);
}

/**
 * Encrypt identity private key with UMEK
 * 
 * @param {string} privateKeyJWK - Identity private key in JWK format (JSON string)
 * @param {CryptoKey} umek - UMEK
 * @returns {Promise<{encryptedPrivateKey: string, iv: string}>} Base64-encoded encrypted key + IV
 */
export async function encryptIdentityPrivateKey(privateKeyJWK, umek) {
    try {
        const iv = generateIV();
        const privateKeyBytes = new TextEncoder().encode(privateKeyJWK);

        const ciphertext = await crypto.subtle.encrypt(
            {
                name: CRYPTO_CONFIG.algorithm,
                iv: iv,
                tagLength: CRYPTO_CONFIG.tagLength
            },
            umek,
            privateKeyBytes
        );

        return {
            encryptedPrivateKey: arrayBufferToBase64(ciphertext),
            iv: arrayBufferToBase64(iv)
        };
    } catch (error) {
        console.error('Failed to encrypt identity private key:', error);
        throw new Error('Identity private key encryption failed');
    }
}

/**
 * Decrypt identity private key with UMEK
 * 
 * @param {string} encryptedPrivateKeyBase64 - Base64-encoded encrypted private key
 * @param {string} ivBase64 - Base64-encoded IV
 * @param {CryptoKey} umek - UMEK
 * @returns {Promise<string>} Decrypted private key JWK (JSON string)
 */
export async function decryptIdentityPrivateKey(encryptedPrivateKeyBase64, ivBase64, umek) {
    try {
        const encryptedPrivateKey = base64ToArrayBuffer(encryptedPrivateKeyBase64);
        const iv = base64ToArrayBuffer(ivBase64);

        const decryptedBytes = await crypto.subtle.decrypt(
            {
                name: CRYPTO_CONFIG.algorithm,
                iv: iv,
                tagLength: CRYPTO_CONFIG.tagLength
            },
            umek,
            encryptedPrivateKey
        );

        return new TextDecoder().decode(decryptedBytes);
    } catch (error) {
        console.error('Failed to decrypt identity private key:', error);
        throw new Error('Identity private key decryption failed');
    }
}


// ==================== THREAD KEY DERIVATION (HKDF) ====================

/**
 * Derive thread key from conversation key + parent message ID
 * Uses HKDF (HMAC-based Key Derivation Function) for key isolation
 * 
 * This provides message isolation (not forward secrecy):
 * - Each thread has its own derived key
 * - Compromise of one thread key doesn't affect others
 * - No need to store thread keys (computed on-demand)
 * 
 * @param {CryptoKey} conversationKey - Parent conversation (channel/DM) key
 * @param {string} parentMessageId - Parent message ID as context
 * @returns {Promise<CryptoKey>} Derived thread key
 */
export async function deriveThreadKey(conversationKey, parentMessageId) {
    try {

        // Convert parent message ID to bytes (this is our "info" parameter in HKDF)
        const info = new TextEncoder().encode(`thread:${parentMessageId}`);

        // Export conversation key to raw bytes
        const conversationKeyBytes = await crypto.subtle.exportKey('raw', conversationKey);

        // Import as raw key material for HKDF
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            conversationKeyBytes,
            'HKDF',
            false,
            ['deriveKey']
        );

        // Derive thread key using HKDF
        const threadKey = await crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                hash: 'SHA-256',
                salt: new Uint8Array(32), // Fixed zero salt (conversation key is already random)
                info: info
            },
            keyMaterial,
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true, // extractable (for encryption)
            ['encrypt', 'decrypt']
        );

        return threadKey;
    } catch (error) {
        console.error('Thread key derivation failed:', error);
        throw new Error('Thread key derivation failed');
    }
}

// ==================== ENCRYPTION ====================

/**
 * Encrypt data using AES-256-GCM
 * 
 * @param {string|ArrayBuffer} plaintext - Data to encrypt
 * @param {CryptoKey} key - AES-GCM encryption key
 * @param {Uint8Array} iv - Initialization vector (optional, auto-generated)
 * @returns {Promise<{ciphertext: ArrayBuffer, iv: Uint8Array}>}
 */
export async function encryptAESGCM(plaintext, key, iv = null) {
    try {
        // Generate IV if not provided
        const ivBytes = iv || generateIV();

        // Convert string to bytes if needed
        const plaintextBytes = typeof plaintext === 'string'
            ? new TextEncoder().encode(plaintext)
            : plaintext;

        // Encrypt using AES-GCM
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: CRYPTO_CONFIG.algorithm,
                iv: ivBytes,
                tagLength: CRYPTO_CONFIG.tagLength
            },
            key,
            plaintextBytes
        );

        return {
            ciphertext,
            iv: ivBytes
        };
    } catch (error) {
        console.error('Encryption failed:', error);
        throw new Error('Encryption failed');
    }
}

/**
 * Encrypt a text message for sending
 * Convenience wrapper around encryptAESGCM
 * 
 * @param {string} message - Plaintext message
 * @param {CryptoKey} workspaceKey - Workspace encryption key
 * @returns {Promise<{ciphertext: string, iv: string}>} Base64-encoded values
 */
export async function encryptMessage(message, workspaceKey) {
    try {
        const { ciphertext, iv } = await encryptAESGCM(message, workspaceKey);

        return {
            ciphertext: arrayBufferToBase64(ciphertext),
            iv: arrayBufferToBase64(iv)
        };
    } catch (error) {
        console.error('Message encryption failed:', error);
        throw error;
    }
}

// ==================== DECRYPTION ====================

/**
 * Decrypt data using AES-256-GCM
 * 
 * @param {ArrayBuffer} ciphertext - Encrypted data
 * @param {CryptoKey} key - AES-GCM decryption key
 * @param {Uint8Array} iv - Initialization vector used for encryption
 * @returns {Promise<ArrayBuffer>} Decrypted data
 */
export async function decryptAESGCM(ciphertext, key, iv) {
    try {
        const plaintext = await crypto.subtle.decrypt(
            {
                name: CRYPTO_CONFIG.algorithm,
                iv: iv,
                tagLength: CRYPTO_CONFIG.tagLength
            },
            key,
            ciphertext
        );

        return plaintext;
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Decryption failed - invalid key or corrupted data');
    }
}

/**
 * Decrypt a text message
 * Convenience wrapper around decryptAESGCM
 * 
 * @param {string} ciphertextBase64 - Base64-encoded ciphertext
 * @param {string} ivBase64 - Base64-encoded IV
 * @param {CryptoKey} workspaceKey - Workspace decryption key
 * @returns {Promise<string>} Decrypted plaintext message
 */
export async function decryptMessage(ciphertextBase64, ivBase64, workspaceKey) {
    try {
        // Decode from Base64
        const ciphertext = base64ToArrayBuffer(ciphertextBase64);
        const iv = base64ToArrayBuffer(ivBase64);

        // Decrypt
        const plaintextBytes = await decryptAESGCM(ciphertext, workspaceKey, iv);

        // Convert bytes to string
        const plaintext = new TextDecoder().decode(plaintextBytes);

        return plaintext;
    } catch (error) {
        console.error('Message decryption failed:', error);
        throw error;
    }
}

// ==================== KEY EXPORT/IMPORT ====================

/**
 * Export CryptoKey to raw bytes
 * 
 * @param {CryptoKey} key - Key to export
 * @returns {Promise<ArrayBuffer>} Raw key bytes
 */
export async function exportKey(key) {
    try {
        const exported = await crypto.subtle.exportKey('raw', key);
        return exported;
    } catch (error) {
        console.error('Key export failed:', error);
        throw new Error('Key export failed');
    }
}

/**
 * Import raw bytes as CryptoKey
 * 
 * @param {ArrayBuffer} keyBytes - Raw key bytes
 * @returns {Promise<CryptoKey>} Imported AES-GCM key
 */
export async function importKey(keyBytes) {
    try {
        const key = await crypto.subtle.importKey(
            'raw',
            keyBytes,
            {
                name: CRYPTO_CONFIG.algorithm,
                length: CRYPTO_CONFIG.keyLength
            },
            true,
            ['encrypt', 'decrypt']
        );

        return key;
    } catch (error) {
        console.error('Key import failed:', error);
        throw new Error('Key import failed');
    }
}

/**
 * Encrypt a workspace key with a KEK (Key Encryption Key)
 * Used to store workspace keys encrypted with user's password-derived key
 * 
 * @param {CryptoKey} workspaceKey - Workspace key to encrypt
 * @param {CryptoKey} kek - Key Encryption Key (from password)
 * @returns {Promise<{encryptedKey: string, iv: string}>} Base64-encoded
 */
export async function encryptWorkspaceKey(workspaceKey, kek) {
    try {
        // Export workspace key to raw bytes
        const workspaceKeyBytes = await exportKey(workspaceKey);

        // Encrypt with KEK
        const { ciphertext, iv } = await encryptAESGCM(workspaceKeyBytes, kek);

        return {
            encryptedKey: arrayBufferToBase64(ciphertext),
            iv: arrayBufferToBase64(iv)
        };
    } catch (error) {
        console.error('Workspace key encryption failed:', error);
        throw error;
    }
}

/**
 * Decrypt a workspace key using KEK
 * 
 * @param {string} encryptedKeyBase64 - Base64-encoded encrypted workspace key
 * @param {string} ivBase64 - Base64-encoded IV
 * @param {CryptoKey} kek - Key Encryption Key (from password)
 * @returns {Promise<CryptoKey>} Decrypted workspace key
 */
export async function decryptWorkspaceKey(encryptedKeyBase64, ivBase64, kek) {
    try {
        // Decode from Base64
        const encryptedKey = base64ToArrayBuffer(encryptedKeyBase64);
        const iv = base64ToArrayBuffer(ivBase64);

        // Decrypt to get raw key bytes
        const workspaceKeyBytes = await decryptAESGCM(encryptedKey, kek, iv);

        // Import as CryptoKey
        const workspaceKey = await importKey(workspaceKeyBytes);

        return workspaceKey;
    } catch (error) {
        console.error('Workspace key decryption failed:', error);
        throw error;
    }
}

// ==================== ENCODING UTILITIES ====================

/**
 * Convert ArrayBuffer to Base64 string
 * 
 * @param {ArrayBuffer} buffer - Data to encode
 * @returns {string} Base64-encoded string
 */
export function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 * 
 * @param {string} base64 - Base64-encoded string
 * @returns {ArrayBuffer} Decoded data
 */
export function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Convert Uint8Array to Base64 string
 * 
 * @param {Uint8Array} bytes - Data to encode
 * @returns {string} Base64-encoded string
 */
export function uint8ArrayToBase64(bytes) {
    return arrayBufferToBase64(bytes.buffer);
}

/**
 * Convert Base64 string to Uint8Array
 * 
 * @param {string} base64 - Base64-encoded string
 * @returns {Uint8Array} Decoded data
 */
export function base64ToUint8Array(base64) {
    return new Uint8Array(base64ToArrayBuffer(base64));
}

// ==================== VALIDATION ====================

/**
 * Validate that Web Crypto API is available
 * 
 * @returns {boolean} True if crypto is supported
 */
export function isCryptoSupported() {
    return (
        typeof crypto !== 'undefined' &&
        typeof crypto.subtle !== 'undefined' &&
        typeof crypto.getRandomValues !== 'undefined'
    );
}

/**
 * Check if running in secure context (HTTPS or localhost)
 * Web Crypto API requires secure context
 * 
 * @returns {boolean} True if secure context
 */
export function isSecureContext() {
    return window.isSecureContext;
}

/**
 * Validate crypto setup and throw descriptive errors
 * Call this before using any crypto functions
 */
export function validateCryptoSetup() {
    if (!isCryptoSupported()) {
        throw new Error('Web Crypto API not supported in this browser');
    }

    if (!isSecureContext()) {
        throw new Error('Crypto functions require HTTPS or localhost');
    }
}

// ==================== EXPORTS ====================

const cryptoUtils = {
    // Constants
    CRYPTO_CONFIG,

    // Key generation
    generateWorkspaceKey,
    generateIV,
    generateSalt,

    // Key derivation
    deriveKeyFromPassword,
    deriveThreadKey,

    // UMEK
    generateUMEK,
    deriveUMEKFromPassword,
    encryptIdentityPrivateKey,
    decryptIdentityPrivateKey,


    // Encryption/Decryption
    encryptAESGCM,
    decryptAESGCM,
    encryptMessage,
    decryptMessage,

    // Key management
    exportKey,
    importKey,
    encryptWorkspaceKey,
    decryptWorkspaceKey,

    // Encoding
    arrayBufferToBase64,
    base64ToArrayBuffer,
    uint8ArrayToBase64,
    base64ToUint8Array,

    // Validation
    isCryptoSupported,
    isSecureContext,
    validateCryptoSetup
};

export default cryptoUtils;
