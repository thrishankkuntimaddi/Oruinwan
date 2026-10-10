// End-to-end encryption, compatible with the web client
// (client/src/services/identityKeyService.js, conversationKeyService.js, utils/crypto*.js).
//
//  - Identity key: RSA-2048 (RSA-OAEP, SHA-256). Its private JWK is stored on the server
//    encrypted with AES-256-GCM under the UMEK, a key derived from the user's password
//    (PBKDF2-SHA256, 100 000 iterations, 16-byte salt) or a server-held key (SERVER_KEK).
//  - Conversation keys: random AES-256 keys, wrapped for each member with RSA-OAEP.
//  - Messages: AES-256-GCM, 12-byte IV; ciphertext = base64(ciphertext || tag).
//
// The unlocked private key is kept as a non-extractable CryptoKey in IndexedDB, so the
// password is needed only once per phone. Everything here uses the WebView's WebCrypto.
import { api } from './http.js';
import { setE2ee } from '../e2ee.js';

const subtle = globalThis.crypto?.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(buf) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(str) {
  const bin = atob(String(str).replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------- key cache (IndexedDB)

const DB = 'oru-keys';
const STORE = 'identity';

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb(mode, fn) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const cacheGet = (key) => idb('readonly', (s) => s.get(key)).catch(() => null);
const cacheSet = (key, value) => idb('readwrite', (s) => s.put(value, key)).catch(() => {});
const cacheDelete = (key) => idb('readwrite', (s) => s.delete(key)).catch(() => {});

// ---------------------------------------------------------------- identity

let identity = null; // { userId, privateKey, publicKeyPem, algorithm }
const convKeys = new Map(); // 'channel:<id>' | 'dm:<id>' → CryptoKey
const wrapped = new Map(); // prefetched, still-wrapped workspace keys

const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' };
const IDENTITY_ALGORITHM = 'RSA-2048';

export const isUnlocked = () => Boolean(identity);

async function deriveUmek(password, salt, extractable = false) {
  const material = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt'],
  );
}

function isRsa(algorithm) {
  return !algorithm || /^RSA/i.test(algorithm);
}

/** Loads the cached private key for this phone, if it was unlocked before. */
export async function restoreIdentity(userId) {
  if (!subtle) return setE2ee('unsupported', 'This phone’s web view has no WebCrypto.');
  const cached = await cacheGet(`id:${userId}`);
  if (cached?.privateKey) {
    identity = { userId, ...cached };
    setE2ee('ready');
    return true;
  }
  setE2ee('password_required');
  return false;
}

async function uploadPublicKey(pem, algorithm, version = 1) {
  await api.post('/v2/identity/public-key', { publicKey: pem, algorithm, version });
}

/**
 * Unlocks the user's identity with their password, or creates it on first use
 * (the same thing the web client does on a first sign-in).
 */
export async function unlockIdentity(userId, password) {
  if (!subtle) {
    setE2ee('unsupported', 'This phone’s web view has no WebCrypto.');
    return 'unsupported';
  }
  let state = null;
  try {
    state = await api.get('/v2/crypto/identity');
  } catch (err) {
    if (err.status !== 404) {
      setE2ee('error', err.message);
      throw err;
    }
  }
  if (!state) return createIdentity(userId, password);
  if (!isRsa(state.algorithm)) {
    setE2ee('unsupported', 'This account uses a key type the app does not support yet.');
    return 'unsupported';
  }

  let umek;
  if (state.umekProtectionType === 'PASSWORD') {
    if (!password) {
      setE2ee('password_required');
      return 'password_required';
    }
    umek = await deriveUmek(password, fromB64(state.umekSalt));
  } else if (state.umekProtectionType === 'SERVER_KEK') {
    const raw = fromB64(state.umekEnvelope || '');
    if (raw.length !== 32) {
      setE2ee('unsupported', 'This account’s keys are protected in a way the app cannot unlock yet. Use the web app.');
      return 'unsupported';
    }
    umek = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
  } else {
    setE2ee('unsupported', 'Unknown key protection.');
    return 'unsupported';
  }

  let jwk;
  try {
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(state.identityPrivateKeyIv), tagLength: 128 },
      umek,
      fromB64(state.encryptedIdentityPrivateKey),
    );
    jwk = JSON.parse(dec.decode(plain));
  } catch {
    setE2ee('password_required', 'That password did not unlock your keys.');
    const err = new Error('That password did not unlock your messages. If you changed it recently, use the new one.');
    err.code = 'WRONG_PASSWORD';
    throw err;
  }
  const privateKey = await subtle.importKey('jwk', jwk, RSA, false, ['decrypt']);
  identity = { userId, privateKey, publicKeyPem: state.identityPublicKey, algorithm: state.algorithm || IDENTITY_ALGORITHM };
  await cacheSet(`id:${userId}`, { privateKey, publicKeyPem: identity.publicKeyPem, algorithm: identity.algorithm });
  // Make sure the public key is published and pending keys get re-wrapped for us.
  uploadPublicKey(identity.publicKeyPem, identity.algorithm, state.version || 1).catch(() => {});
  api.post('/v2/conversations/repair-access').catch(() => {});
  setE2ee('ready');
  return 'ready';
}

async function createIdentity(userId, password) {
  if (!password) {
    setE2ee('password_required');
    return 'password_required';
  }
  const pair = await subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  const pem = `-----BEGIN PUBLIC KEY-----\n${toB64(await subtle.exportKey('spki', pair.publicKey))}\n-----END PUBLIC KEY-----`;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const umek = await deriveUmek(password, salt, true);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, umek, enc.encode(JSON.stringify(jwk)));

  // Same payload as the web client's first sign-in, so either client can unlock it later.
  await api.post('/v2/crypto/identity/init', {
    identityPublicKey: pem,
    encryptedIdentityPrivateKey: toB64(encrypted),
    identityPrivateKeyIv: toB64(iv),
    umekEnvelope: toB64(await subtle.exportKey('raw', umek)),
    umekEnvelopeIv: null,
    umekSalt: toB64(salt),
    umekProtectionType: 'PASSWORD',
    algorithm: IDENTITY_ALGORITHM,
    version: 1,
  });
  await uploadPublicKey(pem, IDENTITY_ALGORITHM, 1);

  const privateKey = await subtle.importKey('jwk', jwk, RSA, false, ['decrypt']);
  identity = { userId, privateKey, publicKeyPem: pem, algorithm: IDENTITY_ALGORITHM };
  await cacheSet(`id:${userId}`, { privateKey, publicKeyPem: pem, algorithm: IDENTITY_ALGORITHM });
  api.post('/v2/conversations/repair-access').catch(() => {});
  setE2ee('ready');
  return 'ready';
}

export async function forgetIdentity(userId) {
  identity = null;
  convKeys.clear();
  wrapped.clear();
  if (userId) await cacheDelete(`id:${userId}`);
  setE2ee('none');
}

// ---------------------------------------------------------------- conversation keys

async function unwrap(entry) {
  if (!identity) throw Object.assign(new Error('Locked'), { code: 'LOCKED' });
  if (entry.algorithm === 'X25519') throw Object.assign(new Error('Unsupported key'), { code: 'UNSUPPORTED' });
  const raw = await subtle.decrypt({ name: 'RSA-OAEP' }, identity.privateKey, fromB64(entry.encryptedKey));
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/** One request for every key in the workspace; they are unwrapped only when needed. */
export async function prefetchWorkspaceKeys(workspaceId) {
  try {
    const data = await api.get(`/v2/conversations/workspace/${workspaceId}/keys`);
    for (const k of data?.conversationKeys || []) wrapped.set(`${k.conversationType}:${k.conversationId}`, k);
  } catch {
    /* keys are fetched one by one instead */
  }
}

async function createDmKey(conv, workspaceId, participantIds) {
  const data = await api.post('/v2/identity/public-keys', { userIds: participantIds });
  const list = Array.isArray(data?.publicKeys) ? data.publicKeys : Object.entries(data?.publicKeys || {}).map(([userId, v]) => ({ userId, ...v }));
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const encryptedKeys = [];
  for (const pk of list) {
    const pem = pk.publicKey || pk.identityPublicKey;
    if (!pem || !isRsa(pk.algorithm)) continue;
    const der = fromB64(pem.replace(/-----[A-Z0-9 ]+-----/g, ''));
    const publicKey = await subtle.importKey('spki', der, RSA, false, ['encrypt']);
    const encryptedKey = toB64(await subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, raw));
    encryptedKeys.push({ userId: String(pk.userId), encryptedKey, ephemeralPublicKey: null, algorithm: pk.algorithm || IDENTITY_ALGORITHM });
  }
  if (encryptedKeys.length < participantIds.length) {
    throw Object.assign(new Error('The other person has not opened Oruinwan yet, so this conversation cannot be encrypted for them.'), { code: 'NO_PEER_KEY' });
  }
  try {
    await api.post(`/v2/conversations/${conv.id}/keys`, { conversationType: 'dm', workspaceId, encryptedKeys });
  } catch (err) {
    if (err.status === 409) return null; // created by the other side meanwhile
    throw err;
  }
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function conversationKey(conv, { workspaceId, participantIds, create = false } = {}) {
  const id = `${conv.kind}:${conv.id}`;
  if (convKeys.has(id)) return convKeys.get(id);
  if (!identity) throw Object.assign(new Error('Locked'), { code: 'LOCKED' });

  let entry = wrapped.get(id);
  if (!entry) {
    try {
      entry = await api.get(`/v2/conversations/${conv.id}/keys`, { type: conv.kind });
    } catch (err) {
      if (err.status === 403) {
        await api.post('/v2/conversations/repair-access').catch(() => {});
        try {
          entry = await api.get(`/v2/conversations/${conv.id}/keys`, { type: conv.kind });
        } catch {
          throw Object.assign(new Error('Your key for this conversation is not ready yet.'), { code: 'NOT_DISTRIBUTED' });
        }
      } else if (err.status === 404 && create && conv.kind === 'dm' && participantIds?.length) {
        const key = await createDmKey(conv, workspaceId, participantIds);
        if (key) {
          convKeys.set(id, key);
          return key;
        }
        entry = await api.get(`/v2/conversations/${conv.id}/keys`, { type: conv.kind });
      } else if (err.status === 404) {
        throw Object.assign(new Error('This conversation has no encryption key yet.'), { code: 'NOT_INITIALIZED' });
      } else throw err;
    }
  }
  const key = await unwrap(entry);
  convKeys.set(id, key);
  wrapped.delete(id);
  return key;
}

// ---------------------------------------------------------------- messages

export async function encryptText(key, text) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, enc.encode(text));
  return { ciphertext: toB64(ct), messageIv: toB64(iv), isEncrypted: true };
}

export async function decryptPayload(key, payload) {
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(payload.messageIv), tagLength: 128 }, key, fromB64(payload.ciphertext));
  return dec.decode(plain);
}

/** Returns { text, state } for a server message. state: ok | locked | nokey | failed | deleted | attachment | system */
export async function readMessage(conv, m) {
  if (m.type === 'system') return { state: 'system', text: m.text || m.systemText || m.payload?.text || '' };
  if (m.isDeletedUniversally || m.isDeleted) return { state: 'deleted', text: '' };
  const payload = m.payload?.payload || m.payload;
  if (!payload?.ciphertext) {
    if (m.attachments?.length || ['image', 'video', 'file', 'voice'].includes(m.type)) {
      return { state: 'attachment', text: m.attachments?.[0]?.name || m.attachments?.[0]?.fileName || labelFor(m.type) };
    }
    if (m.type && m.type !== 'message') return { state: 'attachment', text: labelFor(m.type) };
    return { state: 'ok', text: m.text || '' };
  }
  if (!identity) return { state: 'locked', text: '' };
  let key;
  try {
    key = await conversationKey(conv);
  } catch {
    return { state: 'nokey', text: '' };
  }
  try {
    return { state: 'ok', text: await decryptPayload(key, payload) };
  } catch {
    return { state: 'failed', text: '' };
  }
}

function labelFor(type) {
  return (
    {
      poll: 'Poll',
      image: 'Photo',
      video: 'Video',
      file: 'File',
      voice: 'Voice message',
      contact: 'Contact',
      meeting: 'Meeting',
      checklist: 'Checklist',
      screen_recording: 'Screen recording',
    }[type] || 'Attachment'
  );
}
