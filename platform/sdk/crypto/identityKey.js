/**
 * platform/sdk/crypto/identityKey.js
 *
 * Chttrix Platform SDK — Identity Key Façade
 *
 * SDK interface for all identity keypair operations.
 * Delegates entirely to the existing implementation in:
 *   client/src/utils/cryptoIdentity.js
 *
 * No logic lives here — this is a pure pass-through façade.
 * When the mobile or desktop clients need identity key support,
 * they will replace these imports with platform-appropriate implementations
 * (e.g., react-native-quick-crypto, Node.js crypto) while keeping
 * the same exported function signatures.
 *
 * Phase A5: Façade only — no behavioral change.
 *
 * ⚠️  DO NOT alter the function logic here.
 *     Do not change arguments, return types, or cryptographic behavior.
 */

export {
    // ── Capability detection ────────────────────────────────────────────────
    checkCryptoSupport,

    // ── Key generation ──────────────────────────────────────────────────────
    generateIdentityKeyPair,  // auto-selects X25519 or RSA-2048
    generateX25519KeyPair,    // explicit X25519 (preferred)
    generateRSAKeyPair,       // explicit RSA-2048 (fallback)

    // ── Key export / import ─────────────────────────────────────────────────
    exportPublicKeyPEM,       // → PEM string for server storage
    importPublicKeyPEM,       // ← PEM string → CryptoKey
    exportPrivateKeyJWK,      // → JWK for IndexedDB storage
    importPrivateKeyJWK,      // ← JWK → CryptoKey

    // ── Conversation key wrapping ───────────────────────────────────────────
    wrapKeyWithRSA,           // encrypt conv. key with RSA public key
    unwrapKeyWithRSA,         // decrypt conv. key with RSA private key
    wrapKeyWithX25519,        // ECIES-style wrap with X25519
    unwrapKeyWithX25519,      // ECIES-style unwrap with X25519

    // ── Default export ──────────────────────────────────────────────────────
    // NOTE: KEY_VERSION and IDENTITY_KEY_CONFIG are NOT named exports from
    // cryptoIdentity.js — they are local `const` declarations without the
    // `export` keyword (see lines 14 and 36 of cryptoIdentity.js).
    // They are accessible only via the default export:
    //   import cryptoIdentity from 'platform/sdk/crypto/identityKey.js'
    //   cryptoIdentity.KEY_VERSION         → 1
    //   cryptoIdentity.IDENTITY_KEY_CONFIG → { x25519, rsa, aesGcm }
    default as cryptoIdentity,
} from '../../../client/src/utils/cryptoIdentity.js';
