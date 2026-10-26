// @vitest-environment node
// Phone app: conversation keys with versions (server conversations/keyEpochs.js). After a group
// adds someone "from now on" or removes someone, the conversation has a new key; the phone reads
// older messages with the earlier keys it was given, sends with the current one (saying which),
// and fetches the new key once when the server says the key changed.
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
const GROUP = '64b000000000000000000009';
const conv = { kind: 'dm', id: GROUP };

const newKey = () => crypto.getRandomValues(new Uint8Array(32));
const copyFor = async (pub, raw) => b64(new Uint8Array(await subtle.encrypt({ name: 'RSA-OAEP' }, pub, raw)));
const seal = async (raw, text, keyVersion) => {
  const k = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, k, new TextEncoder().encode(text)));
  return { ciphertext: b64(ct), messageIv: b64(iv), ...(keyVersion ? { keyVersion } : {}) };
};

let me;
let served; // what GET /keys returns
async function setup() {
  me = await account(ME);
  mockApi.get.mockImplementation(async (path) => {
    if (path === '/v2/crypto/identity') return me.state;
    if (path === `/v2/conversations/${GROUP}/keys`) return served();
    throw httpError(404);
  });
  mockApi.post.mockImplementation(async (path, body) => (
    path === '/v2/crypto/identity/unwrap-umek' ? serverUnwrap(me.umekRaw, body.clientEphemeralPublicKey) : {}));
  const c = await freshCrypto();
  await c.unlockIdentity(ME);
  return c;
}

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
  vi.stubGlobal('indexedDB', fakeIndexedDB());
});

describe('conversation key versions on the phone', () => {
  it('reads messages from before and after the key changed, and sends with the current key', async () => {
    const k1 = newKey();
    const k2 = newKey();
    served = async () => ({
      encryptedKey: await copyFor(me.pair.publicKey, k2), algorithm: 'RSA-2048', version: 2,
      previous: [{ version: 1, encryptedKey: await copyFor(me.pair.publicKey, k1), algorithm: 'RSA-2048' }],
    });
    const c = await setup();
    const key = await c.conversationKey(conv);
    expect(c.keyVersionOf(key)).toBe(2);
    // Old messages carry no version (1); new ones name theirs.
    await expect(c.decryptPayload(key, await seal(k1, 'before'))).resolves.toBe('before');
    await expect(c.decryptPayload(key, await seal(k2, 'after', 2))).resolves.toBe('after');
    const sent = await c.encryptText(key, 'mine');
    expect(sent.keyVersion).toBe(2);
    await expect(c.decryptPayload(key, sent)).resolves.toBe('mine');
  });

  it('someone added "from now on" holds only the new key and cannot open earlier messages', async () => {
    const k1 = newKey();
    const k2 = newKey();
    served = async () => ({ encryptedKey: await copyFor(me.pair.publicKey, k2), algorithm: 'RSA-2048', version: 2, previous: [] });
    const c = await setup();
    const key = await c.conversationKey(conv);
    await expect(c.decryptPayload(key, await seal(k1, 'private earlier'))).rejects.toBeTruthy();
    await expect(c.decryptPayload(key, await seal(k2, 'welcome', 2))).resolves.toBe('welcome');
  });

  it('a message under a newer key: fetches the key once and reads it', async () => {
    const k1 = newKey();
    const k2 = newKey();
    let current = { raw: k1, version: 1 };
    served = async () => ({ encryptedKey: await copyFor(me.pair.publicKey, current.raw), algorithm: 'RSA-2048', version: current.version, previous: current.version > 1 ? [{ version: 1, encryptedKey: await copyFor(me.pair.publicKey, k1), algorithm: 'RSA-2048' }] : [] });
    const c = await setup();
    const key = await c.conversationKey(conv);
    current = { raw: k2, version: 2 };
    await expect(c.decryptPayload(key, await seal(k2, 'new key', 2))).resolves.toBe('new key');
    const fresh = await c.conversationKey(conv);
    expect(c.keyVersionOf(fresh)).toBe(2);
  });

  it('send refused with KEY_ROTATED: encrypts again with the new key and sends once more', async () => {
    const k1 = newKey();
    const k2 = newKey();
    let current = { raw: k1, version: 1 };
    served = async () => ({ encryptedKey: await copyFor(me.pair.publicKey, current.raw), algorithm: 'RSA-2048', version: current.version, previous: [] });
    const c = await setup();
    await c.conversationKey(conv);
    current = { raw: k2, version: 2 };
    const versions = [];
    const res = await c.withCurrentKey(conv, () => c.conversationKey(conv), async (key) => {
      const body = await c.encryptText(key, 'hi');
      versions.push(body.keyVersion);
      if (body.keyVersion !== 2) throw Object.assign(new Error('rotated'), { status: 409, code: 'KEY_ROTATED' });
      return 'sent';
    });
    expect(res).toBe('sent');
    expect(versions).toEqual([1, 2]);
  });

  it('other errors are not retried', async () => {
    served = async () => ({ encryptedKey: await copyFor(me.pair.publicKey, newKey()), algorithm: 'RSA-2048', version: 1 });
    const c = await setup();
    const send = vi.fn(async () => { throw Object.assign(new Error('nope'), { status: 403, code: 'FORBIDDEN' }); });
    await expect(c.withCurrentKey(conv, () => c.conversationKey(conv), send)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
