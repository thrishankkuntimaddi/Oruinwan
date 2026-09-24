/**
 * X25519 key unwrap/wrap. Two wire formats exist in the codebase:
 *  - web client (cryptoIdentity.js): AES key = raw ECDH secret, ephemeral key = raw 32 bytes
 *  - server (conversationKeys.crypto.js): AES key = HKDF(secret, '', 'conversation-key-wrap'),
 *    ephemeral key = SPKI DER.
 * Both put iv(12) || ciphertext || tag(16) in encryptedKey.
 */
import { x25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64ToBytes, bytesToBase64, utf8Encode } from './encoding';
import { aesGcmDecrypt, aesGcmEncrypt } from './aes';

function rawPublic(bytes) {
  return bytes.length === 32 ? bytes : bytes.subarray(bytes.length - 32); // SPKI DER → last 32 bytes
}

export function x25519PrivateFromJwk(jwk) {
  if (!jwk || jwk.kty !== 'OKP' || jwk.crv !== 'X25519' || !jwk.d) throw new Error('Not an X25519 JWK');
  return base64ToBytes(jwk.d);
}

export function x25519Unwrap(encryptedKeyB64, ephemeralPublicKeyB64, privateKey) {
  const combined = base64ToBytes(encryptedKeyB64);
  const iv = combined.subarray(0, 12);
  const ct = combined.subarray(12);
  const shared = x25519.getSharedSecret(privateKey, rawPublic(base64ToBytes(ephemeralPublicKeyB64)));
  try {
    return aesGcmDecrypt(shared, iv, ct);
  } catch (_) {
    const k = hkdf(sha256, shared, new Uint8Array(0), utf8Encode('conversation-key-wrap'), 32);
    return aesGcmDecrypt(k, iv, ct);
  }
}

/** Wrap in the web-client format (the one the web client can unwrap). */
export function x25519Wrap(keyBytes, recipientPublicKeyBytes) {
  const eph = x25519.utils.randomSecretKey();
  const shared = x25519.getSharedSecret(eph, rawPublic(recipientPublicKeyBytes));
  const { ciphertext, iv } = aesGcmEncrypt(shared, keyBytes);
  const combined = new Uint8Array(iv.length + ciphertext.length);
  combined.set(iv, 0);
  combined.set(ciphertext, iv.length);
  return {
    encryptedKey: bytesToBase64(combined),
    ephemeralPublicKey: bytesToBase64(x25519.getPublicKey(eph)),
  };
}
