// End-to-end encryption, compatible with the web client
// (client/src/services/identityKeyService.js, conversationKeyService.js, utils/crypto*.js).
//
//  - Identity key: RSA-2048 (RSA-OAEP, SHA-256). Its private JWK is stored on the server
//    encrypted with AES-256-GCM under the UMEK, a key derived from the user's password
//    (PBKDF2-SHA256, 100 000 iterations, 16-byte salt) or a server-held key (SERVER_KEK).
//  - Conversation keys: random AES-256 keys, wrapped for each member with RSA-OAEP.
//  - Messages: AES-256-GCM, 12-byte IV; ciphertext = base64(ciphertext || tag).
//
// The unlocked private key is kept as a non-extractable CryptoKey in IndexedDB. Messages unlock
// automatically: the server keeps a sealed copy of the UMEK and wraps it for each signed-in
// device. Accounts whose UMEK is still password-derived move to that mode the next time the
// password is typed on any device (sealUmekOnServer). Everything here uses WebCrypto.
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
  if (!subtle) return setE2ee('unsupported', 'WebCrypto is not available here, so encrypted messages cannot be read.');
  const cached = await cacheGet(`id:${userId}`);
  if (cached?.privateKey) {
    identity = { userId, ...cached };
    setE2ee('ready');
    checkIdentityCurrent(userId).catch(() => {});
    return true;
  }
  setE2ee('password_required');
  return false;
}

/**
 * The saved key is for an identity the account has since replaced (set up again on another
 * device, or moved to automatic unlock there): it can't open any new conversation key. Drop it
 * and unlock the account's current identity. Offline or on any error, keep what we have.
 */
export async function checkIdentityCurrent(userId) {
  const mine = identity;
  if (!mine?.publicKeyPem || mine.userId !== userId) return false;
  const state = await api.get('/v2/crypto/identity');
  if (!state?.identityPublicKey || state.identityPublicKey === mine.publicKeyPem || identity !== mine) return false;
  identity = null;
  convKeys.clear();
  wrapped.clear();
  await cacheDelete(`id:${userId}`);
  setE2ee('password_required');
  await unlockIdentity(userId);
  return true;
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
    setE2ee('unsupported', 'WebCrypto is not available here, so encrypted messages cannot be read.');
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
  if (!state) return createIdentity(userId);
  if (!isRsa(state.algorithm)) {
    setE2ee('unsupported', 'This account uses a key type the app does not support yet.');
    return 'unsupported';
  }

  let umek;
  if (state.umekProtectionType === 'PASSWORD') {
    if (!password) {
      // An account from before automatic unlock: right after signing in, move it to automatic
      // unlock instead of asking for the password (the server allows it only just after a real
      // sign-in on this device, and gives the account its conversations back).
      try {
        return await createIdentity(userId, { allowOverwrite: true, autoUpgrade: true });
      } catch {
        setE2ee('password_required');
        return 'password_required';
      }
    }
    // Extractable once, so the opened key can be sealed on the server (automatic unlock from now on).
    umek = await deriveUmek(password, fromB64(state.umekSalt), true);
    const jwk = await openPrivateKey(state, umek);
    await sealUmekOnServer(umek);
    return keepIdentity(userId, jwk, state);
  } else if (state.umekProtectionType === 'SERVER_KEK') {
    // Accounts without a password (Google / GitHub sign-ups that skipped setting one).
    try {
      umek = await unwrapServerUmek();
    } catch (err) {
      setE2ee('error', 'Could not unlock your keys from the server. Try again.');
      throw err;
    }
  } else {
    setE2ee('unsupported', 'Unknown key protection.');
    return 'unsupported';
  }

  return keepIdentity(userId, await openPrivateKey(state, umek), state);
}

/**
 * QR sign-in hands the new device its UMEK wrapped for the ephemeral key it sent (`keys`).
 * Opens the identity with it; falls back to the normal unlock when the key wasn't included.
 */
export async function unlockWithWrappedUmek(userId, privateKey, keys) {
  if (!subtle) return unlockIdentity(userId);
  if (!keys?.rewrappedUmek || !privateKey) return unlockIdentity(userId);
  try {
    const state = await api.get('/v2/crypto/identity');
    if (!isRsa(state.algorithm)) return unlockIdentity(userId);
    const umek = await unwrapUmek(privateKey, keys);
    return keepIdentity(userId, await openPrivateKey(state, umek), state);
  } catch {
    return unlockIdentity(userId);
  }
}

/** The identity private key (JWK) inside `state`, opened with `umek`. */
async function openPrivateKey(state, umek) {
  try {
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(state.identityPrivateKeyIv), tagLength: 128 },
      umek,
      fromB64(state.encryptedIdentityPrivateKey),
    );
    return JSON.parse(dec.decode(plain));
  } catch {
    setE2ee('password_required', 'That password did not unlock your keys.');
    const err = new Error('That password did not unlock your messages. If you changed it recently, use the new one.');
    err.code = 'WRONG_PASSWORD';
    throw err;
  }
}

/** Keeps an opened identity for this session and this device. */
async function keepIdentity(userId, jwk, state) {
  const privateKey = await subtle.importKey('jwk', jwk, RSA, false, ['decrypt']);
  identity = { userId, privateKey, publicKeyPem: state.identityPublicKey, algorithm: state.algorithm || IDENTITY_ALGORITHM };
  await cacheSet(`id:${userId}`, { privateKey, publicKeyPem: identity.publicKeyPem, algorithm: identity.algorithm });
  // Make sure the public key is published and pending keys get re-wrapped for us.
  uploadPublicKey(identity.publicKeyPem, identity.algorithm, state.version || 1).catch(() => {});
  api.post('/v2/conversations/repair-access').catch(() => {});
  setE2ee('ready');
  return 'ready';
}

/**
 * After an account without a password sets one. The key stays sealed on the server (messages
 * unlock automatically on every device); a still password-protected key is moved there too.
 */
export async function protectIdentityWithPassword(userId, password) {
  return unlockIdentity(userId, password);
}

/**
 * Sends the opened UMEK once (over TLS) so the server keeps it sealed under its key and unlocks
 * the account's other devices automatically. Best effort: a failure keeps the old mode.
 */
export async function sealUmekOnServer(umek) {
  try {
    const raw = new Uint8Array(await subtle.exportKey('raw', umek));
    await api.post('/v2/crypto/identity/seal-umek', { umek: toB64(raw) });
    return true;
  } catch {
    return false;
  }
}

/**
 * For "unlock another device": opens a still password-protected key with the password and seals
 * it on the server. Resolves true once the server holds it. Throws WRONG_PASSWORD.
 */
export async function sealWithPassword(password) {
  const state = await api.get('/v2/crypto/identity');
  if (state?.umekProtectionType === 'SERVER_KEK') return true;
  const umek = await deriveUmek(password, fromB64(state.umekSalt), true);
  try {
    // Only checks the password; this device's own unlock state is left alone.
    await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(state.identityPrivateKeyIv), tagLength: 128 }, umek, fromB64(state.encryptedIdentityPrivateKey));
  } catch {
    throw Object.assign(new Error('That password did not unlock your messages.'), { code: 'WRONG_PASSWORD' });
  }
  await api.post('/v2/crypto/identity/seal-umek', { umek: toB64(new Uint8Array(await subtle.exportKey('raw', umek))) });
  return true;
}

// Same constants as the server (server/src/features/crypto/umekEnvelope.js wrapForDevice)
// and the web client (identityKeyService._unwrapUMEKFromServer).
const UNWRAP_SALT = 'umek-wrap-v1';
const UNWRAP_ITERATIONS = 10000;

/**
 * The UMEK of a server-protected account. The server holds it sealed and re-wraps it for this
 * device only: both sides make a one-time P-256 key, derive a shared AES key from the ECDH
 * secret (PBKDF2-SHA256), and the server sends the UMEK encrypted with it (iv | tag | data).
 */
async function unwrapServerUmek() {
  const mine = await newEphemeralKey();
  const wrappedKey = await api.post('/v2/crypto/identity/unwrap-umek', { clientEphemeralPublicKey: mine.publicKey });
  return unwrapUmek(mine.privateKey, wrappedKey);
}

/** A one-time P-256 key pair; publicKey is the raw point, base64 (what the server expects). */
export async function newEphemeralKey() {
  const pair = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  return { privateKey: pair.privateKey, publicKey: toB64(new Uint8Array(await subtle.exportKey('raw', pair.publicKey))) };
}

/** Opens { serverEphemeralPublicKey, rewrappedUmek } (server wrapForDevice) with our ephemeral private key. */
export async function unwrapUmek(privateKey, { serverEphemeralPublicKey, rewrappedUmek }) {
  const mine = { privateKey };
  const serverPublic = await subtle.importKey('raw', fromB64(serverEphemeralPublicKey), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secret = await subtle.deriveBits({ name: 'ECDH', public: serverPublic }, mine.privateKey, 256);
  const material = await subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey']);
  const wrapKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(UNWRAP_SALT), iterations: UNWRAP_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
  const blob = fromB64(rewrappedUmek);
  const iv = blob.slice(0, 12);
  const tag = blob.slice(12, 28);
  const data = blob.slice(28);
  const sealed = new Uint8Array(data.length + tag.length);
  sealed.set(data);
  sealed.set(tag, data.length);
  const raw = await subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, wrapKey, sealed);
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
}

/** Creates keys for an account that has none yet (server-sealed UMEK, see below). */
async function createIdentity(userId, serverExtras = {}) {
  const pair = await subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  const pem = `-----BEGIN PUBLIC KEY-----\n${toB64(await subtle.exportKey('spki', pair.publicKey))}\n-----END PUBLIC KEY-----`;
  // Every new account: a random UMEK, sent once over TLS and kept sealed by the server, so each
  // signed-in device unlocks automatically.
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const umek = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
  const protection = { umekEnvelope: toB64(raw), umekSalt: null, umekProtectionType: 'SERVER_KEK' };
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, umek, enc.encode(JSON.stringify(jwk)));

  // Same payload as the web client's first sign-in, so either client can unlock it later.
  await api.post('/v2/crypto/identity/init', {
    ...serverExtras,
    identityPublicKey: pem,
    encryptedIdentityPrivateKey: toB64(encrypted),
    identityPrivateKeyIv: toB64(iv),
    umekEnvelopeIv: null,
    ...protection,
    algorithm: IDENTITY_ALGORITHM,
    version: 1,
  });
  await uploadPublicKey(pem, IDENTITY_ALGORITHM, 1).catch((err) => {
    // Setting up again: /identity/init has already published the key.
    if (!serverExtras.allowOverwrite) throw err;
  });
  if (serverExtras.allowOverwrite) {
    convKeys.clear();
    wrapped.clear();
  }

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

async function unwrapRaw(entry) {
  if (!identity) throw Object.assign(new Error('Locked'), { code: 'LOCKED' });
  if (entry.algorithm === 'X25519') throw Object.assign(new Error('Unsupported key'), { code: 'UNSUPPORTED' });
  return subtle.decrypt({ name: 'RSA-OAEP' }, identity.privateKey, fromB64(entry.encryptedKey));
}

/**
 * Opens a conversation key copy. A copy that doesn't open (wrapped for an identity key this
 * account has since replaced) is swapped for a fresh one from the server copy, once.
 */
async function openEntry(conv, entry) {
  try {
    return { raw: await unwrapRaw(entry), entry };
  } catch (err) {
    if (err.code === 'LOCKED' || err.code === 'UNSUPPORTED') throw err;
    await api.post(`/v2/conversations/${conv.id}/keys/rewrap`, { type: conv.kind }).catch(() => {});
    const fresh = await api.get(`/v2/conversations/${conv.id}/keys`, { type: conv.kind });
    return { raw: await unwrapRaw(fresh), entry: fresh };
  }
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

/** Participant ids and workspace of a DM: from its details, else from what the caller knows. */
async function dmMembers(conv, opts) {
  try {
    const data = await api.get(`/v2/dm/${conv.id}`);
    const ids = (data?.dm?.participants || []).map((p) => String(p?._id || p)).filter(Boolean);
    if (ids.length) return { ids, workspaceId: data.dm.workspaceId || opts.workspaceId };
  } catch {
    /* older server: no details endpoint */
  }
  const ids = (opts.participantIds || []).map(String).filter(Boolean);
  if (identity && !ids.includes(String(identity.userId))) ids.push(String(identity.userId));
  return { ids, workspaceId: opts.workspaceId };
}

/**
 * A DM the server has no key for (a server older than the app, or making it failed there):
 * make the key here for every participant, then give the server its copy (escrow) so anyone
 * without a copy, now or later, can be given one. If someone made it first, use theirs.
 */
async function createDmKey(conv, opts) {
  const { ids, workspaceId } = await dmMembers(conv, opts);
  if (!ids.length || !workspaceId) return null;
  const { publicKeys = [] } = (await api.post('/v2/identity/public-keys', { userIds: ids })) || {};
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const encryptedKeys = [];
  for (const { userId, publicKey, algorithm } of publicKeys) {
    if (!isRsa(algorithm) || !publicKey) continue;
    try {
      const der = fromB64(String(publicKey).replace(/-----[^-]+-----/g, ''));
      const pub = await subtle.importKey('spki', der, RSA, false, ['encrypt']);
      encryptedKeys.push({ userId: String(userId), encryptedKey: toB64(await subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw)), algorithm: IDENTITY_ALGORITHM });
    } catch {
      /* that person gets a copy from the server copy later */
    }
  }
  if (!encryptedKeys.some((k) => k.userId === String(identity.userId))) return null;
  try {
    await api.post(`/v2/conversations/${conv.id}/keys`, { conversationType: 'dm', workspaceId, encryptedKeys });
  } catch (err) {
    if (err.status === 409) return null; // someone made it first: the caller fetches theirs
    throw err;
  }
  api.post(`/v2/conversations/${conv.id}/keys/escrow`, { type: 'dm', key: toB64(raw) }).catch(() => {});
  return subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function conversationKey(conv, opts = {}) {
  const id = `${conv.kind}:${conv.id}`;
  if (convKeys.has(id)) return convKeys.get(id);
  if (!identity) throw Object.assign(new Error('Locked'), { code: 'LOCKED' });
  try {
    return await fetchConversationKey(conv, id);
  } catch (err) {
    if (err.code !== 'NOT_INITIALIZED' || conv.kind !== 'dm' || !opts.create) throw err;
    const made = await createDmKey(conv, opts).catch(() => null);
    if (made) {
      convKeys.set(id, made);
      return made;
    }
    return fetchConversationKey(conv, id);
  }
}

async function fetchConversationKey(conv, id) {

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
      } else if (err.status === 404 && conv.kind === 'dm') {
        // The server makes DM keys (with a server copy, so people who set up encryption later
        // still get them). It does so on this request, so one retry picks it up.
        try {
          entry = await api.get(`/v2/conversations/${conv.id}/keys`, { type: conv.kind });
        } catch {
          throw Object.assign(new Error('This conversation has no encryption key yet.'), { code: 'NOT_INITIALIZED' });
        }
      } else if (err.status === 404) {
        throw Object.assign(new Error('This conversation has no encryption key yet.'), { code: 'NOT_INITIALIZED' });
      } else throw err;
    }
  }
  let opened;
  try {
    opened = await openEntry(conv, entry);
  } catch (err) {
    // A prefetched copy may be stale: try the live one before giving up.
    if (!wrapped.has(id)) throw err;
    wrapped.delete(id);
    opened = await openEntry(conv, await api.get(`/v2/conversations/${conv.id}/keys`, { type: conv.kind }));
  }
  const key = await subtle.importKey('raw', opened.raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  convKeys.set(id, key);
  wrapped.delete(id);
  // An older key without a server copy can't be given to people who join later: send it once.
  if (opened.entry?.serverCopy === false) {
    api.post(`/v2/conversations/${conv.id}/keys/escrow`, { type: conv.kind, key: toB64(opened.raw) }).catch(() => {});
  }
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
