/**
 * AES-256-GCM (128-bit tag, 12-byte IV) — byte-compatible with Web Crypto:
 * output is ciphertext || tag, exactly what the web client stores.
 */
import { gcm } from '@noble/ciphers/aes.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { utf8Encode } from './encoding';

export const IV_LENGTH = 12;

export function randomKey() {
  return randomBytes(32);
}

export function aesGcmEncrypt(key, plaintext, iv = randomBytes(IV_LENGTH)) {
  const pt = typeof plaintext === 'string' ? utf8Encode(plaintext) : plaintext;
  return { ciphertext: gcm(key, iv).encrypt(pt), iv };
}

export function aesGcmDecrypt(key, iv, ciphertext) {
  return gcm(key, iv).decrypt(ciphertext);
}

/** Mirrors client/src/utils/crypto.js deriveThreadKey: HKDF-SHA256, 32 zero-byte salt. */
export function deriveThreadKey(conversationKey, parentMessageId) {
  return hkdf(sha256, conversationKey, new Uint8Array(32), utf8Encode(`thread:${parentMessageId}`), 32);
}
