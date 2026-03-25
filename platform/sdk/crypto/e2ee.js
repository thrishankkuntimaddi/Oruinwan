/**
 * platform/sdk/crypto/e2ee.js
 *
 * Chttrix Platform SDK — E2EE Message Encryption Façade
 *
 * SDK interface for end-to-end message encryption and decryption.
 * Delegates entirely to the existing implementations in:
 *   client/src/utils/crypto.js         — core AES-GCM / PBKDF2 / HKDF
 *   client/src/utils/encryptionUtils.js — ECDH + message encrypt/decrypt
 *
 * No logic lives here — this is a pure pass-through façade.
 * Platform clients replace these imports with their own crypto
 * implementation while preserving the same function signatures.
 *
 * Phase A5: Façade only — no behavioral change.
 *
 * ⚠️  DO NOT change ciphertext formats, IV handling, or key derivation.
 *     Any change here is a breaking change for all stored encrypted messages.
 */

// ─── From client/src/utils/crypto.js ─────────────────────────────────────────

console.log("🔥 PLATFORM CRYPTO USED");

export {
    // Key generation
    generateWorkspaceKey,

    // IV / Salt helpers
    generateIV,
    generateSalt,

    // PBKDF2 key derivation
    deriveKeyFromPassword,

    // UMEK (User Master Encryption Key)
    generateUMEK,
    deriveUMEKFromPassword,
    encryptIdentityPrivateKey,
    decryptIdentityPrivateKey,

    // Thread key derivation (HKDF)
    deriveThreadKey,

    // AES-GCM primitives
    encryptAESGCM,
    decryptAESGCM,

    // Message encrypt / decrypt (workspace key)
    encryptMessage,
    decryptMessage,

    // Workspace key wrapping
    encryptWorkspaceKey,
    decryptWorkspaceKey,

    // Key import / export (raw bytes ↔ CryptoKey)
    exportKey,
    importKey,

    // Encoding helpers
    arrayBufferToBase64,
    base64ToArrayBuffer,
    uint8ArrayToBase64,
    base64ToUint8Array,

    // Environment guards
    isCryptoSupported,
    isSecureContext,
    validateCryptoSetup,

    // Default
    default as cryptoUtils,
} from '../../../client/src/utils/crypto.js';

// ─── From client/src/utils/encryptionUtils.js ────────────────────────────────
// Re-exported under distinct names where they overlap with crypto.js exports.

export {
    // ECDH P-256 key pair (older format — use cryptoIdentity.js for X25519/RSA)
    generateKeyPair,

    // Private key password protection
    encryptPrivateKey,
    decryptPrivateKey,

    // ECDH P-256 shared secret derivation
    deriveSharedSecret,

    // IndexedDB key store helpers (non-workspace, legacy)
    storeKeys,
    getStoredKeys,
    clearKeys,
} from '../../../client/src/utils/encryptionUtils.js';
