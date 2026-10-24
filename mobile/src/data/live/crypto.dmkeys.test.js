// @vitest-environment node
// Phone app: a DM the server has no key for gets one made here (with the server's copy), and a
// saved key for an identity the account has since replaced is dropped for the current one.
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockApi = { get: vi.fn(), post: vi.fn() };
vi.mock('./http.js', () => ({ api: mockApi }));

// Minimal IndexedDB: one object store, enough for crypto.js's key cache.
function fakeIndexedDB() {
  const data = new Map();
  const later = (fn) => setTimeout(fn, 0);
  const db = {
    close() {},
    transaction() {
      const tx = {};
      const op = (fn) => { const req = {}; later(() => { req.result = fn(); later(() => tx.oncomplete?.()); }); return req; };
      tx.objectStore = () => ({
        get: (k) => op(() => data.get(k)),
        put: (v, k) => op(() => { data.set(k, v); }),
        delete: (k) => op(() => { data.delete(k); }),
      });
      return tx;
    },
  };
  return { data, open: () => { const req = { result: db }; later(() => req.onsuccess?.()); return req; } };
}

const subtle = globalThis.crypto.subtle;
const b64 = (bytes) => Buffer.from(bytes).toString('base64');
const fromB64 = (s) => new Uint8Array(Buffer.from(s, 'base64'));
const httpError = (status) => Object.assign(new Error(`HTTP ${status}`), { status });

const rsa = () => subtle.generateKey(
  { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
  true, ['encrypt', 'decrypt'],
);
const pemOf = async (pub) => `-----BEGIN PUBLIC KEY-----\n${b64(new Uint8Array(await subtle.exportKey('spki', pub)))}\n-----END PUBLIC KEY-----`;

// A server-protected account whose UMEK the (mocked) server hands back unwrapped-equivalent.
async function account(userId) {
  const pair = await rsa();
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  const umekRaw = crypto.getRandomValues(new Uint8Array(32));
  const umek = await subtle.importKey('raw', umekRaw, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, umek, new TextEncoder().encode(JSON.stringify(jwk))));
  return {
    userId, pair, umekRaw,
    state: {
      umekProtectionType: 'SERVER_KEK', umekEnvelope: 'sealed', algorithm: 'RSA-2048', version: 1,
      identityPrivateKeyIv: b64(iv), encryptedIdentityPrivateKey: b64(encrypted), identityPublicKey: await pemOf(pair.publicKey),
    },
  };
}

let crypto_;
async function freshCrypto() {
  vi.resetModules();
  crypto_ = await import('./crypto.js');
  return crypto_;
}

// The server's UMEK hand-over, done with the real server code.
async function serverUnwrap(umekRaw, clientEphemeralPublicKey) {
  const { createRequire } = await import('module');
  const require = createRequire(import.meta.url);
  const silent = () => {};
  const loggerPath = require.resolve('../../../../server/utils/logger.js');
  require.cache[loggerPath] = { id: loggerPath, filename: loggerPath, loaded: true, exports: { info: silent, warn: silent, error: silent, debug: silent } };
  return require('../../../../server/src/features/crypto/umekEnvelope.js').wrapForDevice(Buffer.from(umekRaw), clientEphemeralPublicKey);
}

const ME = '64a000000000000000000001';
const THEM = '64a000000000000000000002';
const DM = '64b000000000000000000009';
const WS = '64c000000000000000000003';

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
  vi.stubGlobal('indexedDB', fakeIndexedDB());
});

describe('a DM without a key on the server', () => {
  it('is keyed here for both people, with the server copy sent', async () => {
    const me = await account(ME);
    const them = await rsa();
    const stored = { keys: null, escrow: null };
    mockApi.get.mockImplementation(async (path) => {
      if (path === '/v2/crypto/identity') return me.state;
      if (path === `/v2/conversations/${DM}/keys`) throw httpError(404);
      if (path === `/v2/dm/${DM}`) throw httpError(404); // older server
      throw httpError(404);
    });
    mockApi.post.mockImplementation(async (path, body) => {
      if (path === '/v2/crypto/identity/unwrap-umek') return serverUnwrap(me.umekRaw, body.clientEphemeralPublicKey);
      if (path === '/v2/identity/public-keys') {
        return { publicKeys: [
          { userId: ME, publicKey: me.state.identityPublicKey, algorithm: 'RSA-2048' },
          { userId: THEM, publicKey: await pemOf(them.publicKey), algorithm: 'RSA-2048' },
        ] };
      }
      if (path === `/v2/conversations/${DM}/keys`) { stored.keys = body; return {}; }
      if (path === `/v2/conversations/${DM}/keys/escrow`) { stored.escrow = body; return {}; }
      return {};
    });

    const c = await freshCrypto();
    await expect(c.unlockIdentity(ME)).resolves.toBe('ready');
    const key = await c.conversationKey({ kind: 'dm', id: DM }, { workspaceId: WS, participantIds: [ME, THEM], create: true });

    expect(stored.keys.workspaceId).toBe(WS);
    expect(stored.keys.encryptedKeys.map((k) => k.userId).sort()).toEqual([ME, THEM].sort());
    const raw = new Uint8Array(await subtle.decrypt({ name: 'RSA-OAEP' }, them.privateKey, fromB64(stored.keys.encryptedKeys.find((k) => k.userId === THEM).encryptedKey)));
    await vi.waitFor(() => expect(stored.escrow).not.toBeNull());
    expect(fromB64(stored.escrow.key)).toEqual(raw);

    // The key encrypts what the other person can read.
    const sent = await c.encryptText(key, 'hello from the phone');
    const theirKey = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
    const plain = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sent.messageIv), tagLength: 128 }, theirKey, fromB64(sent.ciphertext));
    expect(new TextDecoder().decode(plain)).toBe('hello from the phone');
  });

  it("uses the other person's key when they made it first", async () => {
    const me = await account(ME);
    const theirKey = crypto.getRandomValues(new Uint8Array(32));
    const myCopy = b64(new Uint8Array(await subtle.encrypt({ name: 'RSA-OAEP' }, me.pair.publicKey, theirKey)));
    let made = false;
    mockApi.get.mockImplementation(async (path) => {
      if (path === '/v2/crypto/identity') return me.state;
      if (path === `/v2/conversations/${DM}/keys`) {
        if (!made) throw httpError(404);
        return { encryptedKey: myCopy, algorithm: 'RSA-2048', serverCopy: true };
      }
      throw httpError(404);
    });
    mockApi.post.mockImplementation(async (path, body) => {
      if (path === '/v2/crypto/identity/unwrap-umek') return serverUnwrap(me.umekRaw, body.clientEphemeralPublicKey);
      if (path === '/v2/identity/public-keys') return { publicKeys: [{ userId: ME, publicKey: me.state.identityPublicKey, algorithm: 'RSA-2048' }] };
      if (path === `/v2/conversations/${DM}/keys`) { made = true; throw httpError(409); }
      return {};
    });

    const c = await freshCrypto();
    await c.unlockIdentity(ME);
    const key = await c.conversationKey({ kind: 'dm', id: DM }, { workspaceId: WS, participantIds: [ME, THEM], create: true });
    const sent = await c.encryptText(key, 'x');
    const k = await subtle.importKey('raw', theirKey, { name: 'AES-GCM' }, false, ['decrypt']);
    await expect(subtle.decrypt({ name: 'AES-GCM', iv: fromB64(sent.messageIv), tagLength: 128 }, k, fromB64(sent.ciphertext))).resolves.toBeTruthy();
  });

  it('reading (not sending) never makes a key', async () => {
    const me = await account(ME);
    mockApi.get.mockImplementation(async (path) => {
      if (path === '/v2/crypto/identity') return me.state;
      throw httpError(404);
    });
    mockApi.post.mockImplementation(async (path, body) => (
      path === '/v2/crypto/identity/unwrap-umek' ? serverUnwrap(me.umekRaw, body.clientEphemeralPublicKey) : {}));
    const c = await freshCrypto();
    await c.unlockIdentity(ME);
    await expect(c.conversationKey({ kind: 'dm', id: DM })).rejects.toMatchObject({ code: 'NOT_INITIALIZED' });
    expect(mockApi.post.mock.calls.some(([p]) => p === `/v2/conversations/${DM}/keys`)).toBe(false);
  });
});

describe('a saved key for a replaced identity', () => {
  it('is dropped and the current identity is unlocked', async () => {
    const before = await account(ME);
    const after = await account(ME); // set up again elsewhere: a new key pair
    let state = before.state;
    let umek = before.umekRaw;
    mockApi.get.mockImplementation(async (path) => {
      if (path === '/v2/crypto/identity') return state;
      throw httpError(404);
    });
    mockApi.post.mockImplementation(async (path, body) => (
      path === '/v2/crypto/identity/unwrap-umek' ? serverUnwrap(umek, body.clientEphemeralPublicKey) : {}));

    let c = await freshCrypto();
    await c.unlockIdentity(ME); // saved on this phone

    // Later, the account's identity was replaced on another device; the phone restarts.
    state = after.state;
    umek = after.umekRaw;
    c = await freshCrypto();
    await expect(c.restoreIdentity(ME)).resolves.toBe(true);
    await vi.waitFor(async () => {
      // The phone now opens copies made for the new identity.
      const fresh = crypto.getRandomValues(new Uint8Array(32));
      const copy = b64(new Uint8Array(await subtle.encrypt({ name: 'RSA-OAEP' }, after.pair.publicKey, fresh)));
      mockApi.get.mockImplementation(async (path) => {
        if (path === '/v2/crypto/identity') return state;
        if (path === `/v2/conversations/${DM}/keys`) return { encryptedKey: copy, algorithm: 'RSA-2048' };
        throw httpError(404);
      });
      await expect(c.conversationKey({ kind: 'dm', id: DM })).resolves.toBeTruthy();
    }, { timeout: 5000 });
  });

  it('a current saved key stays, without asking the server to unlock', async () => {
    const me = await account(ME);
    mockApi.get.mockResolvedValue(me.state);
    mockApi.post.mockImplementation(async (path, body) => (
      path === '/v2/crypto/identity/unwrap-umek' ? serverUnwrap(me.umekRaw, body.clientEphemeralPublicKey) : {}));
    let c = await freshCrypto();
    await c.unlockIdentity(ME);
    mockApi.post.mockClear();

    c = await freshCrypto();
    await c.restoreIdentity(ME);
    await expect(c.checkIdentityCurrent(ME)).resolves.toBe(false);
    expect(mockApi.post.mock.calls.some(([p]) => p === '/v2/crypto/identity/unwrap-umek')).toBe(false);
  });
});
