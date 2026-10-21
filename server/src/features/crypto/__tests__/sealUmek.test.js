'use strict';

// Moving password-protected accounts to automatic unlock (server-sealed UMEK), keeping sealed
// keys sealed, and "unlock from another device".
process.env.CRYPTO_KEK_V1 = 'b'.repeat(64);
process.env.CRYPTO_KEK_ACTIVE_VERSION = '1';

const crypto = require('crypto');

const mockDb = { state: null };
jest.mock('../../../shared/redis', () => ({ getRedis: () => null }));
jest.mock('../../../identity', () => ({
  cryptoState: {
    findByUserId: jest.fn(async () => (mockDb.state ? { ...mockDb.state } : null)),
    upsert: jest.fn(async (userId, doc) => { mockDb.state = { ...doc, userId }; return mockDb.state; }),
  },
  users: { findById: jest.fn(async () => ({ _id: 'u1' })) },
}));

const controller = require('../identity.controller');
const envelope = require('../umekEnvelope');
const { mockReq, mockRes } = require('../../auth/__tests__/memStore');

const UMEK = crypto.randomBytes(32);

function encryptPrivateKey(umek) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', umek, iv);
  const data = Buffer.concat([c.update(JSON.stringify({ kty: 'RSA', d: 'secret' })), c.final(), c.getAuthTag()]);
  return { encryptedIdentityPrivateKey: data.toString('base64'), identityPrivateKeyIv: iv.toString('base64') };
}

beforeEach(() => {
  mockDb.state = {
    userId: 'u1', identityPublicKey: 'PUB', ...encryptPrivateKey(UMEK),
    umekEnvelope: 'password-derived', umekSalt: 'salt', umekProtectionType: 'PASSWORD', algorithm: 'RSA-2048', version: 3,
  };
});

async function call(handler, { body = {}, params = {}, deviceId = 'device-one-001' } = {}) {
  const res = mockRes();
  await handler(mockReq({ body, params, user: { sub: 'u1' }, headers: { 'x-device-id': deviceId } }), res);
  return res;
}

test('a device that opened the key with the password seals it: the account unlocks automatically from then on', async () => {
  const res = await call(controller.sealUmek, { body: { umek: UMEK.toString('base64') } });
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual(expect.objectContaining({ success: true, umekProtectionType: 'SERVER_KEK', version: 4 }));
  expect(mockDb.state.umekProtectionType).toBe('SERVER_KEK');
  expect(mockDb.state.umekSalt).toBeNull();
  // Stored sealed, never as the raw key, and the server can open it again for a new device.
  expect(mockDb.state.umekEnvelope).not.toBe(UMEK.toString('base64'));
  expect(envelope.openUmek(mockDb.state.umekEnvelope, mockDb.state.kekVersion)).toEqual(UMEK);
  // The identity key itself is unchanged.
  expect(mockDb.state.identityPublicKey).toBe('PUB');
});

test('a key that does not open the private key is refused (no lock-out by a bad upload)', async () => {
  const res = await call(controller.sealUmek, { body: { umek: crypto.randomBytes(32).toString('base64') } });
  expect(res.statusCode).toBe(400);
  expect(res.body.code).toBe('UMEK_MISMATCH');
  expect(mockDb.state.umekProtectionType).toBe('PASSWORD');
  expect((await call(controller.sealUmek, { body: { umek: 'short' } })).statusCode).toBe(400);
});

test('sealing twice is harmless', async () => {
  await call(controller.sealUmek, { body: { umek: UMEK.toString('base64') } });
  const again = await call(controller.sealUmek, { body: { umek: UMEK.toString('base64') } });
  expect(again.body.alreadySealed).toBe(true);
});

test('older apps cannot re-lock a sealed key with a password', async () => {
  await call(controller.sealUmek, { body: { umek: UMEK.toString('base64') } });
  const before = { ...mockDb.state };
  const res = await call(controller.rotateUMEK, {
    body: { encryptedIdentityPrivateKey: 'x', identityPrivateKeyIv: 'y', umekSalt: 'z', umekProtectionType: 'PASSWORD', currentVersion: before.version },
  });
  expect(res.statusCode).toBe(200);
  expect(res.body.kept).toBe('SERVER_KEK');
  expect(mockDb.state.umekProtectionType).toBe('SERVER_KEK');
  expect(mockDb.state.umekEnvelope).toBe(before.umekEnvelope);
});

describe('unlock from another device', () => {
  test('the other device must seal the key before it can approve; the asking device then sees SERVER_KEK', async () => {
    const created = await call(controller.createUnlockRequest, { deviceId: 'locked-device-1' });
    expect(created.statusCode).toBe(200);
    const id = created.body.id;

    const early = await call(controller.decideUnlockRequest, { params: { id }, body: { approve: true }, deviceId: 'phone-device-01' });
    expect(early.statusCode).toBe(409);
    expect(early.body.code).toBe('UMEK_NOT_SEALED');

    await call(controller.sealUmek, { body: { umek: UMEK.toString('base64') }, deviceId: 'phone-device-01' });
    const ok = await call(controller.decideUnlockRequest, { params: { id }, body: { approve: true }, deviceId: 'phone-device-01' });
    expect(ok.statusCode).toBe(200);

    const seen = await call(controller.getUnlockRequest, { params: { id }, deviceId: 'locked-device-1' });
    expect(seen.body).toEqual({ status: 'approved', umekProtectionType: 'SERVER_KEK' });
  });

  test('a device cannot approve its own unlock request', async () => {
    await call(controller.sealUmek, { body: { umek: UMEK.toString('base64') } });
    const created = await call(controller.createUnlockRequest, { deviceId: 'locked-device-2' });
    const res = await call(controller.decideUnlockRequest, { params: { id: created.body.id }, body: { approve: true }, deviceId: 'locked-device-2' });
    expect(res.statusCode).toBe(403);
  });
});
