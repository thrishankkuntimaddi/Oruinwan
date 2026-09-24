/**
 * RSA-OAEP (SHA-256, MGF1-SHA256, empty label) in pure JS using BigInt.
 * Compatible with Web Crypto { name: 'RSA-OAEP', hash: 'SHA-256' } and
 * Node's publicEncrypt(RSA_PKCS1_OAEP_PADDING, oaepHash 'sha256').
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { base64ToBytes, bytesToBigInt, bigIntToBytes, concatBytes, bytesEqual } from './encoding';

const ZERO = BigInt(0);
const ONE = BigInt(1);
const HLEN = 32;
const EMPTY_LABEL_HASH = sha256(new Uint8Array(0));

function mod(a, m) {
  const r = a % m;
  return r < ZERO ? r + m : r;
}

/** Left-to-right fixed 4-bit window exponentiation. */
export function modPow(base, exp, m) {
  if (m === ONE) return ZERO;
  const b = mod(base, m);
  const table = [ONE, b];
  for (let i = 2; i < 16; i++) table.push((table[i - 1] * b) % m);
  const hex = exp.toString(16);
  let result = ONE;
  for (let i = 0; i < hex.length; i++) {
    result = (result * result) % m;
    result = (result * result) % m;
    result = (result * result) % m;
    result = (result * result) % m;
    const d = parseInt(hex[i], 16);
    if (d) result = (result * table[d]) % m;
  }
  return result;
}

function mgf1(seed, length) {
  const out = new Uint8Array(length);
  let o = 0;
  for (let counter = 0; o < length; counter++) {
    const c = new Uint8Array([(counter >>> 24) & 255, (counter >>> 16) & 255, (counter >>> 8) & 255, counter & 255]);
    const h = sha256(concatBytes(seed, c));
    const n = Math.min(h.length, length - o);
    out.set(h.subarray(0, n), o);
    o += n;
  }
  return out;
}

function xor(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

const b64uToBig = (v) => bytesToBigInt(base64ToBytes(v));

/** Import an RSA private key from the JWK the web client stores (n, e, d, p, q, dp, dq, qi). */
export function rsaPrivateKeyFromJwk(jwk) {
  if (!jwk || jwk.kty !== 'RSA' || !jwk.n || !jwk.d) throw new Error('Not an RSA private JWK');
  const n = b64uToBig(jwk.n);
  const key = { n, d: b64uToBig(jwk.d), k: Math.ceil(n.toString(16).length / 2) };
  if (jwk.p && jwk.q && jwk.dp && jwk.dq && jwk.qi) {
    key.p = b64uToBig(jwk.p);
    key.q = b64uToBig(jwk.q);
    key.dp = b64uToBig(jwk.dp);
    key.dq = b64uToBig(jwk.dq);
    key.qi = b64uToBig(jwk.qi);
  }
  return key;
}

function rsaDecryptRaw(key, c) {
  if (key.p) {
    const m1 = modPow(c, key.dp, key.p);
    const m2 = modPow(c, key.dq, key.q);
    const h = mod(key.qi * (m1 - m2), key.p);
    return m2 + h * key.q;
  }
  return modPow(c, key.d, key.n);
}

export function rsaOaepDecrypt(key, ciphertext) {
  const k = key.k;
  if (ciphertext.length !== k || k < 2 * HLEN + 2) throw new Error('RSA decryption error');
  const c = bytesToBigInt(ciphertext);
  if (c >= key.n) throw new Error('RSA decryption error');
  const em = bigIntToBytes(rsaDecryptRaw(key, c), k);
  const maskedSeed = em.subarray(1, 1 + HLEN);
  const maskedDB = em.subarray(1 + HLEN);
  const seed = xor(maskedSeed, mgf1(maskedDB, HLEN));
  const db = xor(maskedDB, mgf1(seed, k - HLEN - 1));
  let bad = em[0] !== 0 || !bytesEqual(db.subarray(0, HLEN), EMPTY_LABEL_HASH);
  let idx = HLEN;
  while (idx < db.length && db[idx] === 0) idx++;
  if (idx >= db.length || db[idx] !== 1) bad = true;
  if (bad) throw new Error('RSA decryption error');
  return db.slice(idx + 1);
}

// ── Public keys (SPKI PEM) ─────────────────────────────────────────────────

function readDer(bytes, offset) {
  const tag = bytes[offset];
  let len = bytes[offset + 1];
  let hdr = 2;
  if (len & 0x80) {
    const nb = len & 0x7f;
    len = 0;
    for (let i = 0; i < nb; i++) len = (len << 8) | bytes[offset + 2 + i];
    hdr += nb;
  }
  return { tag, start: offset + hdr, end: offset + hdr + len };
}

/** Parse a "-----BEGIN PUBLIC KEY-----" SPKI RSA key into { n, e, k }. */
export function rsaPublicKeyFromPem(pem) {
  const b64 = String(pem).replace(/-----BEGIN [A-Z0-9 ]+-----/, '').replace(/-----END [A-Z0-9 ]+-----/, '');
  const der = base64ToBytes(b64);
  const spki = readDer(der, 0); // SEQUENCE
  const algo = readDer(der, spki.start); // SEQUENCE (AlgorithmIdentifier)
  const bitStr = readDer(der, algo.end); // BIT STRING
  if (bitStr.tag !== 0x03) throw new Error('Unsupported public key');
  const rsaSeq = readDer(der, bitStr.start + 1); // skip unused-bits byte
  const nNode = readDer(der, rsaSeq.start);
  const eNode = readDer(der, nNode.end);
  let nBytes = der.subarray(nNode.start, nNode.end);
  while (nBytes.length > 1 && nBytes[0] === 0) nBytes = nBytes.subarray(1);
  return { n: bytesToBigInt(nBytes), e: bytesToBigInt(der.subarray(eNode.start, eNode.end)), k: nBytes.length };
}

export function rsaOaepEncrypt(pub, message) {
  const k = pub.k;
  if (message.length > k - 2 * HLEN - 2) throw new Error('Message too long');
  const ps = new Uint8Array(k - message.length - 2 * HLEN - 2);
  const db = concatBytes(EMPTY_LABEL_HASH, ps, new Uint8Array([1]), message);
  const seed = randomBytes(HLEN);
  const maskedDB = xor(db, mgf1(seed, k - HLEN - 1));
  const maskedSeed = xor(seed, mgf1(maskedDB, HLEN));
  const em = concatBytes(new Uint8Array([0]), maskedSeed, maskedDB);
  return bigIntToBytes(modPow(bytesToBigInt(em), pub.e, pub.n), k);
}
