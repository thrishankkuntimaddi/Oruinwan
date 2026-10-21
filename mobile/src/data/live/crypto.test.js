// @vitest-environment node
// Keys for accounts without a password (Google / GitHub sign-ups that skip setting one):
// the phone app must unwrap them exactly like the server wraps them, and create them in the
// shape the server seals. Uses the server's real wrapForDevice, not a copy.
import { createRequire } from 'module';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);
// CI installs only the phone app's packages, so the server's logger (pino) can't load there.
// wrapForDevice never logs; a silent stand-in lets the real server file load anywhere.
const silent = () => {};
const loggerPath = require.resolve('../../../../server/utils/logger.js');
require.cache[loggerPath] = {
  id: loggerPath, filename: loggerPath, loaded: true,
  exports: { info: silent, warn: silent, error: silent, debug: silent },
};
const { wrapForDevice } = require('../../../../server/src/features/crypto/umekEnvelope.js');

const mockApi = { get: vi.fn(), post: vi.fn() };
vi.mock('./http.js', () => ({ api: mockApi }));

const { unlockIdentity, protectIdentityWithPassword, sealWithPassword, newEphemeralKey, unwrapUmek, unlockWithWrappedUmek } = await import('./crypto.js');
const subtle = globalThis.crypto.subtle;
const b64 = (bytes) => Buffer.from(bytes).toString('base64');

async function serverProtectedAccount() {
  const pair = await subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  );
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  const umekRaw = crypto.getRandomValues(new Uint8Array(32));
  const umek = await subtle.importKey('raw', umekRaw, { name: 'AES-GCM' }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, umek, new TextEncoder().encode(JSON.stringify(jwk))));
  return {
    umekRaw,
    jwk,
    state: {
      umekProtectionType: 'SERVER_KEK',
      umekEnvelope: 'sealed-on-server',
      identityPrivateKeyIv: b64(iv),
      encryptedIdentityPrivateKey: b64(encrypted),
      identityPublicKey: '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----',
      algorithm: 'RSA-2048',
      version: 1,
    },
  };
}

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
});

describe('server-protected keys', () => {
  it('unlocks with the UMEK the server re-wraps for this device', async () => {
    const { umekRaw, state } = await serverProtectedAccount();
    mockApi.get.mockResolvedValue(state);
    mockApi.post.mockImplementation(async (path, body) => {
      if (path === '/v2/crypto/identity/unwrap-umek') return wrapForDevice(Buffer.from(umekRaw), body.clientEphemeralPublicKey);
      return {};
    });
    await expect(unlockIdentity('u1')).resolves.toBe('ready');
    const unwrapCall = mockApi.post.mock.calls.find(([p]) => p === '/v2/crypto/identity/unwrap-umek');
    expect(unwrapCall[1].clientEphemeralPublicKey).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(unwrapCall[1]).not.toHaveProperty('umekEnvelope');
  });

  it('fails cleanly when the server wraps a different key', async () => {
    const { state } = await serverProtectedAccount();
    mockApi.get.mockResolvedValue(state);
    mockApi.post.mockImplementation(async (path, body) =>
      path === '/v2/crypto/identity/unwrap-umek' ? wrapForDevice(Buffer.alloc(32, 7), body.clientEphemeralPublicKey) : {});
    await expect(unlockIdentity('u1')).rejects.toBeTruthy();
  });

  it('creates server-protected keys that the uploaded UMEK opens', async () => {
    mockApi.get.mockRejectedValue(Object.assign(new Error('none'), { status: 404 }));
    mockApi.post.mockResolvedValue({});
    await expect(unlockIdentity('u2', null, { serverProtected: true })).resolves.toBe('ready');
    const init = mockApi.post.mock.calls.find(([p]) => p === '/v2/crypto/identity/init')[1];
    expect(init.umekProtectionType).toBe('SERVER_KEK');
    expect(init.umekSalt).toBeNull();
    const raw = Buffer.from(init.umekEnvelope, 'base64');
    expect(raw).toHaveLength(32);
    const key = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(init.identityPrivateKeyIv, 'base64'), tagLength: 128 },
      key,
      Buffer.from(init.encryptedIdentityPrivateKey, 'base64'),
    );
    expect(JSON.parse(new TextDecoder().decode(plain)).kty).toBe('RSA');
  });

  it('creates server-protected keys whenever an account has none (no password choice needed)', async () => {
    mockApi.get.mockRejectedValue(Object.assign(new Error('none'), { status: 404 }));
    mockApi.post.mockResolvedValue({});
    await expect(unlockIdentity('u3')).resolves.toBe('ready');
    const init = mockApi.post.mock.calls.find(([p]) => p === '/v2/crypto/identity/init')[1];
    expect(init.umekProtectionType).toBe('SERVER_KEK');
  });
});

describe('setting a password after skipping', () => {
  const PASSWORD = 'Gh-Passw0rd!';

  it('keeps server-held keys sealed: setting a password never re-locks them', async () => {
    const { umekRaw, state } = await serverProtectedAccount();
    mockApi.get.mockResolvedValue(state);
    mockApi.post.mockImplementation(async (path, body) =>
      path === '/v2/crypto/identity/unwrap-umek' ? wrapForDevice(Buffer.from(umekRaw), body.clientEphemeralPublicKey) : {});
    await expect(protectIdentityWithPassword('u4', PASSWORD)).resolves.toBe('ready');
    expect(mockApi.post.mock.calls.some(([p]) => p === '/v2/crypto/identity/rotate-umek')).toBe(false);
    expect(mockApi.post.mock.calls.some(([p]) => p === '/v2/crypto/identity/seal-umek')).toBe(false);
  });
});

/** An older account whose UMEK is derived from the password. */
async function passwordAccount(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const umek = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, true, ['encrypt']);
  const pair = await subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt']);
  const jwk = await subtle.exportKey('jwk', pair.privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, umek, new TextEncoder().encode(JSON.stringify(jwk))));
  return {
    umekRaw: new Uint8Array(await subtle.exportKey('raw', umek)),
    state: {
      umekProtectionType: 'PASSWORD', umekEnvelope: 'password-derived', umekSalt: b64(salt),
      identityPrivateKeyIv: b64(iv), encryptedIdentityPrivateKey: b64(encrypted),
      identityPublicKey: '-----BEGIN PUBLIC KEY-----\nAAAA\n-----END PUBLIC KEY-----', algorithm: 'RSA-2048', version: 3,
    },
  };
}

describe('moving password-protected keys to automatic unlock', () => {
  const PASSWORD = 'Old-Passw0rd!';

  it('signing in with the password seals the UMEK on the server', async () => {
    const { umekRaw, state } = await passwordAccount(PASSWORD);
    mockApi.get.mockResolvedValue(state);
    mockApi.post.mockResolvedValue({});
    await expect(unlockIdentity('u6', PASSWORD)).resolves.toBe('ready');
    const seal = mockApi.post.mock.calls.find(([p]) => p === '/v2/crypto/identity/seal-umek');
    expect(Buffer.from(seal[1].umek, 'base64')).toEqual(Buffer.from(umekRaw));
  });

  it('a failed seal never blocks unlocking here', async () => {
    const { state } = await passwordAccount(PASSWORD);
    mockApi.get.mockResolvedValue(state);
    mockApi.post.mockImplementation(async (path) => {
      if (path === '/v2/crypto/identity/seal-umek') throw new Error('offline');
      return {};
    });
    await expect(unlockIdentity('u7', PASSWORD)).resolves.toBe('ready');
  });

  it('no password: still locked (unlock once, by password or another device)', async () => {
    const { state } = await passwordAccount(PASSWORD);
    mockApi.get.mockResolvedValue(state);
    await expect(unlockIdentity('u8')).resolves.toBe('password_required');
  });

  it('approving an unlock on another device seals with the password; a wrong one is refused', async () => {
    const { state } = await passwordAccount(PASSWORD);
    mockApi.get.mockResolvedValue(state);
    mockApi.post.mockResolvedValue({});
    await expect(sealWithPassword('wrong')).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
    expect(mockApi.post).not.toHaveBeenCalled();
    await expect(sealWithPassword(PASSWORD)).resolves.toBe(true);
    expect(mockApi.post.mock.calls[0][0]).toBe('/v2/crypto/identity/seal-umek');
  });
});

describe('QR sign-in key hand-over', () => {
  it('opens the UMEK the server wrapped for the ephemeral key sent with the QR claim', async () => {
    const eph = await newEphemeralKey();
    const raw = crypto.getRandomValues(new Uint8Array(32));
    const umek = await unwrapUmek(eph.privateKey, wrapForDevice(Buffer.from(raw), eph.publicKey));
    // Opening proves the key: encrypt with the raw bytes, decrypt with the unwrapped key.
    const k = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode('hi'));
    expect(new TextDecoder().decode(await subtle.decrypt({ name: 'AES-GCM', iv }, umek, ct))).toBe('hi');
  });

  it('unlocks messages with the handed-over key, no server unwrap needed', async () => {
    const { umekRaw, state } = await serverProtectedAccount();
    mockApi.get.mockResolvedValue(state);
    mockApi.post.mockResolvedValue({});
    const eph = await newEphemeralKey();
    await expect(unlockWithWrappedUmek('u9', eph.privateKey, wrapForDevice(Buffer.from(umekRaw), eph.publicKey))).resolves.toBe('ready');
    expect(mockApi.post.mock.calls.some(([p]) => p === '/v2/crypto/identity/unwrap-umek')).toBe(false);
  });
});
