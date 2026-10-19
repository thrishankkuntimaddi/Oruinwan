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

const { unlockIdentity, protectIdentityWithPassword } = await import('./crypto.js');
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

  it('still asks for a password when there are no keys and no choice was made', async () => {
    mockApi.get.mockRejectedValue(Object.assign(new Error('none'), { status: 404 }));
    await expect(unlockIdentity('u3')).resolves.toBe('password_required');
    expect(mockApi.post).not.toHaveBeenCalled();
  });
});

describe('setting a password after skipping', () => {
  const PASSWORD = 'Gh-Passw0rd!';

  async function openWithPassword(body) {
    const material = await subtle.importKey('raw', new TextEncoder().encode(PASSWORD), 'PBKDF2', false, ['deriveKey']);
    const umek = await subtle.deriveKey(
      { name: 'PBKDF2', salt: Buffer.from(body.umekSalt, 'base64'), iterations: 100000, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const plain = await subtle.decrypt(
      { name: 'AES-GCM', iv: Buffer.from(body.identityPrivateKeyIv, 'base64'), tagLength: 128 },
      umek,
      Buffer.from(body.encryptedIdentityPrivateKey, 'base64'),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  it('moves server-held keys under the password, keeping the same key pair', async () => {
    const { umekRaw, jwk, state } = await serverProtectedAccount();
    mockApi.get.mockResolvedValue(state);
    mockApi.post.mockImplementation(async (path, body) => {
      if (path === '/v2/crypto/identity/unwrap-umek') return wrapForDevice(Buffer.from(umekRaw), body.clientEphemeralPublicKey);
      if (path === '/v2/crypto/identity/rotate-umek') return { success: true, newVersion: 2 };
      return {};
    });
    await expect(protectIdentityWithPassword('u4', PASSWORD)).resolves.toBe('ready');
    const rotate = mockApi.post.mock.calls.find(([p]) => p === '/v2/crypto/identity/rotate-umek')[1];
    expect(rotate).toMatchObject({ umekProtectionType: 'PASSWORD', currentVersion: 1 });
    const reopened = await openWithPassword(rotate);
    expect(reopened.n).toBe(jwk.n);
    expect(reopened.d).toBe(jwk.d);
  });

  it('creates password keys when the account has none yet', async () => {
    mockApi.get.mockRejectedValue(Object.assign(new Error('none'), { status: 404 }));
    mockApi.post.mockResolvedValue({});
    await expect(protectIdentityWithPassword('u5', PASSWORD)).resolves.toBe('ready');
    const init = mockApi.post.mock.calls.find(([p]) => p === '/v2/crypto/identity/init')[1];
    expect(init.umekProtectionType).toBe('PASSWORD');
    expect((await openWithPassword(init)).kty).toBe('RSA');
    expect(mockApi.post.mock.calls.some(([p]) => p === '/v2/crypto/identity/rotate-umek')).toBe(false);
  });
});
