/**
 * Conversation (channel / DM) AES keys — mirrors client/src/services/conversationKeyService.js.
 * Keys are wrapped per user with RSA-OAEP-SHA256 (web default) or X25519.
 * Unwrapped keys live in memory only.
 */
import { randomBytes } from '@noble/hashes/utils.js';
import { base64ToBytes, bytesToBase64 } from './encoding';
import { rsaOaepDecrypt, rsaOaepEncrypt, rsaPublicKeyFromPem } from './rsa';
import { x25519Unwrap, x25519Wrap } from './x25519';
import { getIdentity } from './identity';
import {
  fetchConversationKey, fetchWorkspaceConversationKeys, storeConversationKeys,
  fetchPublicKeys, repairKeyAccess,
} from '../api/crypto';

const keys = new Map(); // `${type}:${id}` -> Uint8Array(32)
const wrapped = new Map(); // `${type}:${id}` -> server entry (prefetched, not yet unwrapped)
const inflight = new Map();
let repairedOnce = false;

export class KeyError extends Error {
  /** code: LOCKED | NOT_INITIALIZED | NOT_DISTRIBUTED | UNWRAP_FAILED | ERROR */
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

const cacheId = (id, type) => `${type}:${id}`;

function unwrap(entry) {
  const identity = getIdentity();
  if (!identity) throw new KeyError('LOCKED', 'Encryption is locked');
  try {
    let bytes;
    if (entry.algorithm === 'X25519') {
      if (identity.kind !== 'x25519') throw new Error('key algorithm mismatch');
      bytes = x25519Unwrap(entry.encryptedKey, entry.ephemeralPublicKey, identity.key);
    } else {
      if (identity.kind !== 'rsa') throw new Error('key algorithm mismatch');
      bytes = rsaOaepDecrypt(identity.key, base64ToBytes(entry.encryptedKey));
    }
    if (bytes.length !== 32) throw new Error('unexpected key length');
    return bytes;
  } catch (err) {
    throw new KeyError('UNWRAP_FAILED', `Could not unwrap conversation key: ${err.message}`);
  }
}

async function fetchKey(id, type, allowRepair) {
  try {
    const { data } = await fetchConversationKey(id, type);
    return unwrap(data);
  } catch (err) {
    if (err instanceof KeyError) throw err;
    const s = err?.response?.status;
    if (s === 404) throw new KeyError('NOT_INITIALIZED', 'No encryption key exists for this conversation yet');
    if (s === 403) {
      if (allowRepair && !repairedOnce) {
        repairedOnce = true;
        await repairKeyAccess().catch(() => {});
        return fetchKey(id, type, false);
      }
      throw new KeyError('NOT_DISTRIBUTED', 'The encryption key has not been shared with you yet');
    }
    throw new KeyError('ERROR', err?.message || 'Failed to load encryption key');
  }
}

/** Returns the 32-byte conversation key or throws KeyError. */
export async function getConversationKey(id, type) {
  const k = cacheId(id, type);
  if (keys.has(k)) return keys.get(k);
  if (!getIdentity()) throw new KeyError('LOCKED', 'Encryption is locked');
  if (inflight.has(k)) return inflight.get(k);
  const p = (async () => {
    let bytes;
    if (wrapped.has(k)) {
      try { bytes = unwrap(wrapped.get(k)); } catch (_) { bytes = null; }
      wrapped.delete(k);
    }
    if (!bytes) bytes = await fetchKey(id, type, true);
    keys.set(k, bytes);
    return bytes;
  })().finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

export function getCachedConversationKey(id, type) {
  return keys.get(cacheId(id, type)) || null;
}

/** Prefetch every wrapped key for a workspace in one request; unwrap lazily. */
export async function prefetchWorkspaceKeys(workspaceId) {
  try {
    const { data } = await fetchWorkspaceConversationKeys(workspaceId);
    for (const ck of data?.conversationKeys || []) {
      const k = cacheId(ck.conversationId, ck.conversationType);
      if (!keys.has(k)) wrapped.set(k, ck);
    }
  } catch (_) {}
}

function wrapFor(keyBytes, { publicKey, algorithm }) {
  if (algorithm === 'X25519') {
    const b64 = String(publicKey).replace(/-----[A-Z0-9 ]+-----/g, '').replace(/\s/g, '');
    return { ...x25519Wrap(keyBytes, base64ToBytes(b64)), algorithm };
  }
  const enc = rsaOaepEncrypt(rsaPublicKeyFromPem(publicKey), keyBytes);
  return { encryptedKey: bytesToBase64(enc), ephemeralPublicKey: null, algorithm };
}

/**
 * DM only: fetch the key, or create + distribute one if the conversation has none
 * (same as the web's ensureConversationKey).
 */
export async function ensureDMKey(dmSessionId, workspaceId, participantIds) {
  try {
    return await getConversationKey(dmSessionId, 'dm');
  } catch (err) {
    if (!(err instanceof KeyError) || err.code !== 'NOT_INITIALIZED') throw err;
  }
  const ids = Array.from(new Set(participantIds.filter(Boolean).map(String)));
  const { data } = await fetchPublicKeys(ids);
  const byUser = new Map((data?.publicKeys || []).map((p) => [String(p.userId), p]));
  const missing = ids.filter((id) => !byUser.has(id));
  if (missing.length) {
    throw new KeyError('NOT_DISTRIBUTED', 'The other participant has not set up encryption yet');
  }
  const keyBytes = randomBytes(32);
  const encryptedKeys = ids.map((userId) => ({ userId, ...wrapFor(keyBytes, byUser.get(userId)) }));
  try {
    await storeConversationKeys(dmSessionId, { conversationType: 'dm', workspaceId, encryptedKeys });
  } catch (err) {
    if (err?.response?.status === 409) {
      keys.delete(cacheId(dmSessionId, 'dm'));
      return getConversationKey(dmSessionId, 'dm');
    }
    throw new KeyError('ERROR', err?.message || 'Failed to store DM key');
  }
  keys.set(cacheId(dmSessionId, 'dm'), keyBytes);
  return keyBytes;
}

export function clearConversationKeys() {
  keys.clear();
  wrapped.clear();
  inflight.clear();
  repairedOnce = false;
}
