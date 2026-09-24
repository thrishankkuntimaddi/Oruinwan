/**
 * Identity key unlock — mirrors client/src/services/identityKeyService.js.
 *
 *   GET /v2/crypto/identity → { encryptedIdentityPrivateKey, identityPrivateKeyIv,
 *                              umekProtectionType, umekSalt, umekEnvelope, algorithm }
 *   PASSWORD:   UMEK = PBKDF2-SHA256(password, umekSalt, 100000) → AES-256-GCM key
 *   SERVER_KEK: the web client uploads the raw UMEK as umekEnvelope (base64, 32 bytes);
 *               the server's /unwrap-umek endpoint is not usable (see report), so we
 *               accept a 32-byte envelope directly and otherwise report 'unsupported'.
 *   privateKeyJWK = AES-GCM-decrypt(UMEK, iv, encryptedIdentityPrivateKey)
 *
 * The decrypted JWK is cached in SecureStore (like the web caches it in IndexedDB)
 * so the password is only needed once per device.
 */
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64ToBytes, utf8Decode, utf8Encode } from './encoding';
import { aesGcmDecrypt } from './aes';
import { rsaPrivateKeyFromJwk } from './rsa';
import { x25519PrivateFromJwk } from './x25519';
import { fetchIdentityState, repairKeyAccess } from '../api/crypto';
import { secureGetLarge, secureSetLarge, secureDeleteLarge } from '../storage';

const PBKDF2_ITERATIONS = 100000;

let identity = null; // { userId, kind: 'rsa' | 'x25519', key }
let unlockPromise = null;
let status = 'locked';
let statusDetail = null;
const listeners = new Set();

/**
 * Status values:
 *  locked | unlocking | ready | password_required | no_identity | unsupported | error
 */
function setStatus(s, detail = null) {
  status = s;
  statusDetail = detail;
  listeners.forEach((fn) => fn(s, detail));
}

export function getE2EEStatus() { return { status, detail: statusDetail }; }
export function onE2EEStatus(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getIdentity() { return identity; }

const cacheKey = (userId) => `chttrix_identity_${userId}`;

function importPrivateKey(jwk, algorithm) {
  if (algorithm === 'X25519' || jwk.kty === 'OKP') return { kind: 'x25519', key: x25519PrivateFromJwk(jwk) };
  return { kind: 'rsa', key: rsaPrivateKeyFromJwk(jwk) };
}

function activate(userId, jwk, algorithm) {
  const imported = importPrivateKey(jwk, algorithm);
  identity = { userId, algorithm, ...imported };
  setStatus('ready');
  repairKeyAccess().catch(() => {}); // non-critical, same as the web client
}

async function loadState() {
  try {
    const { data } = await fetchIdentityState();
    return data;
  } catch (err) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

/** Restore from the SecureStore cache, or determine what is needed to unlock. */
export async function restoreIdentity(userId) {
  if (!userId) return getE2EEStatus();
  if (identity?.userId === userId) return getE2EEStatus();
  if (unlockPromise) {
    await unlockPromise.catch(() => {});
    if (identity?.userId === userId) return getE2EEStatus();
  }
  try {
    const cached = await secureGetLarge(cacheKey(userId));
    if (cached) {
      const { jwk, algorithm } = JSON.parse(cached);
      activate(userId, jwk, algorithm);
      return getE2EEStatus();
    }
  } catch (_) {
    await secureDeleteLarge(cacheKey(userId));
  }
  try {
    const state = await loadState();
    if (identity?.userId === userId || unlockPromise) return getE2EEStatus();
    if (!state) setStatus('no_identity');
    else if (state.umekProtectionType === 'PASSWORD') setStatus('password_required');
    else await unlockIdentity(userId, null, state);
  } catch (err) {
    if (status !== 'unsupported') setStatus('error', err?.message);
  }
  return getE2EEStatus();
}

/**
 * Unlock with the account password (PASSWORD accounts). Throws Error with
 * code 'WRONG_PASSWORD' | 'PASSWORD_REQUIRED' | 'NO_IDENTITY' | 'UNSUPPORTED'.
 */
export function unlockIdentity(userId, password, preloadedState = null) {
  const p = doUnlock(userId, password, preloadedState);
  unlockPromise = p;
  p.catch(() => {}).finally(() => { if (unlockPromise === p) unlockPromise = null; });
  return p;
}

async function doUnlock(userId, password, preloadedState) {
  setStatus('unlocking');
  const fail = (code, msg, next = 'password_required') => {
    const e = new Error(msg);
    e.code = code;
    setStatus(next, msg);
    throw e;
  };
  let state;
  try {
    state = preloadedState || (await loadState());
  } catch (err) {
    setStatus('error', err?.message);
    throw err;
  }
  if (!state) return fail('NO_IDENTITY', 'Encryption keys have not been set up for this account yet.', 'no_identity');

  let umek;
  if (state.umekProtectionType === 'PASSWORD') {
    if (!password) return fail('PASSWORD_REQUIRED', 'Password required to unlock encrypted messages.');
    umek = await pbkdf2Async(sha256, utf8Encode(password), base64ToBytes(state.umekSalt), {
      c: PBKDF2_ITERATIONS,
      dkLen: 32,
    });
  } else if (state.umekProtectionType === 'SERVER_KEK') {
    const env = state.umekEnvelope ? base64ToBytes(state.umekEnvelope) : new Uint8Array(0);
    if (env.length !== 32) {
      return fail('UNSUPPORTED', 'This account uses server-wrapped keys, which the mobile app cannot unlock yet.', 'unsupported');
    }
    umek = env;
  } else {
    return fail('UNSUPPORTED', `Unknown key protection: ${state.umekProtectionType}`, 'unsupported');
  }

  let jwk;
  try {
    const plain = aesGcmDecrypt(umek, base64ToBytes(state.identityPrivateKeyIv), base64ToBytes(state.encryptedIdentityPrivateKey));
    jwk = JSON.parse(utf8Decode(plain));
  } catch (_) {
    if (state.umekProtectionType === 'PASSWORD') return fail('WRONG_PASSWORD', 'Incorrect password.');
    return fail('UNSUPPORTED', 'Could not decrypt identity key.', 'unsupported');
  }

  try {
    activate(userId, jwk, state.algorithm);
  } catch (err) {
    return fail('UNSUPPORTED', `Unsupported identity key: ${err.message}`, 'unsupported');
  }
  try {
    await secureSetLarge(cacheKey(userId), JSON.stringify({ jwk, algorithm: state.algorithm }));
  } catch (err) {
    console.warn('[E2EE] identity cache failed (non-critical):', err?.message);
  }
  return getE2EEStatus();
}

/** Wipe the in-memory and cached identity (logout). */
export async function forgetIdentity(userId) {
  identity = null;
  setStatus('locked');
  if (userId) await secureDeleteLarge(cacheKey(userId));
}
