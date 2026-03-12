/**
 * platform/constants/encryptionConstants.js
 *
 * Chttrix Platform — Shared Encryption Parameters
 *
 * Single source of truth for cryptographic algorithm parameters used
 * across client-side E2EE, server-side key wrapping, and any future
 * platform SDK crypto utilities.
 *
 * These values are derived from the existing implementation in:
 *   • client/src/utils/crypto.js        (CRYPTO_CONFIG)
 *   • server/src/modules/conversations/ (key wrapping)
 *   • server/src/modules/encryption/
 *
 * Phase A4: Definition only — no integration yet.
 * The existing crypto.js CRYPTO_CONFIG object remains unchanged.
 * Integration will replace CRYPTO_CONFIG with this shared source in
 * a later phase.
 *
 * IMPORTANT: Do NOT alter these values. Any change to these parameters
 * is a breaking change — all stored encrypted blobs would become
 * unreadable with different parameters.
 */

// ─── Symmetric Encryption (AES-GCM) ──────────────────────────────────────────

export const ENCRYPTION_CONSTANTS = Object.freeze({

    // ── AES-GCM (message / key encryption) ────────────────────────────────
    AES_ALGORITHM:       'AES-GCM',
    AES_KEY_LENGTH:      256,     // bits  (AES-256)
    IV_LENGTH:           12,      // bytes (96-bit nonce — GCM standard)
    GCM_TAG_LENGTH:      128,     // bits  (authentication tag)

    // ── PBKDF2 (password → UMEK key derivation) ───────────────────────────
    PBKDF2_ALGORITHM:    'PBKDF2',
    PBKDF2_HASH:         'SHA-256',
    PBKDF2_ITERATIONS:   100000,  // iterations (OWASP minimum for SHA-256)
    SALT_LENGTH:         16,      // bytes (128-bit salt)
    PBKDF2_KEY_LENGTH:   32,      // bytes (256-bit derived key)

    // ── HKDF (thread key derivation from conversation key) ─────────────────
    HKDF_HASH:           'SHA-256',
    HKDF_INFO_PREFIX:    'thread:', // prepended to parentMessageId as HKDF info

    // ── Key sizes ──────────────────────────────────────────────────────────
    AES_KEY_BYTES:       32,      // bytes (256 bits / 8)
    UMEK_KEY_BYTES:      32,      // bytes — UMEK is AES-256 symmetric

    // ── Identity key algorithm ─────────────────────────────────────────────
    // RSA-OAEP used for public-key wrapping of conversation keys
    // (Identity key pair — public key wraps conversation keys for recipients)
    IDENTITY_KEY_ALGORITHM:     'RSA-OAEP',
    IDENTITY_KEY_MODULUS_LENGTH: 2048,       // bits
    IDENTITY_KEY_HASH:           'SHA-256',

    // ── Storage key prefix (IndexedDB / localStorage namespacing) ──────────
    STORAGE_KEY_PREFIX:  'chttrix_e2ee_',
});

// ─── Re-export individual constants for ergonomic destructured imports ────────

export const {
    AES_ALGORITHM,
    AES_KEY_LENGTH,
    IV_LENGTH,
    GCM_TAG_LENGTH,
    PBKDF2_ITERATIONS,
    PBKDF2_HASH,
    SALT_LENGTH,
} = ENCRYPTION_CONSTANTS;
