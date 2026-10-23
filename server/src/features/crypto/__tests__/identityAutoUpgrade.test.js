'use strict';

// Accounts from before automatic unlock (password-locked keys) move to automatic unlock without
// the password, but only right after a real sign-in on the same device.
process.env.SERVER_KEK = process.env.SERVER_KEK || 'e2e0'.repeat(16);
process.env.SERVER_CRYPTO_KEK = process.env.SERVER_CRYPTO_KEK || 'test-kek-0123456789abcdef0123456789';
const express = require('express');
const bcrypt = require('bcryptjs');

const mockDb = { state: null, user: null, device: null, dropped: [], repaired: [] };

jest.mock('../../../identity', () => ({
  cryptoState: {
    findByUserId: jest.fn(async () => mockDb.state),
    upsert: jest.fn(async (userId, doc) => { mockDb.state = { ...doc, userId }; return mockDb.state; }),
  },
  users: { findById: jest.fn(async () => mockDb.user) },
}));
jest.mock('../../../identity/keys.repo', () => ({
  identityKeys: { upsert: jest.fn(async () => {}) },
  conversationKeys: { removeAllMemberKeysForUser: jest.fn(async (userId) => { mockDb.dropped.push(userId); return 1; }) },
}));
jest.mock('../../../modules/conversations/conversationKeys.service', () => ({
  repairUserConversationAccess: jest.fn(async (userId) => { mockDb.repaired.push(userId); return { repaired: 1, dms: { total: 0 } }; }),
}));
jest.mock('../../../shared/postgres', () => ({
  query: jest.fn(async () => ({ rows: mockDb.device ? [mockDb.device] : [] })),
}));

const { initIdentityCryptoState } = require('../identity.controller');

let server;
let base;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.user = { sub: 'u1' }; next(); });
  app.post('/init', initIdentityCryptoState);
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://127.0.0.1:${server.address().port}`;
  mockDb.user = { _id: 'u1', passwordHash: await bcrypt.hash('Secret#2026', 4) };
});
afterAll(() => new Promise((r) => server.close(r)));

const DEVICE = 'dev-1234567890abcdef';
beforeEach(() => {
  mockDb.state = {
    userId: 'u1', identityPublicKey: 'OLD-PUB', encryptedIdentityPrivateKey: 'old', identityPrivateKeyIv: 'iv',
    umekEnvelope: 'password-derived', umekSalt: 'salt', umekProtectionType: 'PASSWORD', algorithm: 'RSA-2048', version: 1,
  };
  mockDb.device = { revoked: false, meta: { signInAt: new Date().toISOString() } };
  mockDb.dropped = []; mockDb.repaired = [];
});

const body = (extra) => ({
  identityPublicKey: 'NEW-PUB', encryptedIdentityPrivateKey: 'new', identityPrivateKeyIv: 'iv2',
  umekEnvelope: Buffer.alloc(32, 7).toString('base64'), umekProtectionType: 'SERVER_KEK', algorithm: 'RSA-2048',
  allowOverwrite: true, autoUpgrade: true, ...extra,
});
const post = (b, device = DEVICE) => fetch(`${base}/init`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(device ? { 'X-Device-Id': device } : {}) }, body: JSON.stringify(b),
});

test('right after signing in on this device, a password-locked account moves to automatic unlock', async () => {
  const res = await post(body());
  expect(res.status).toBe(200);
  expect(mockDb.state.identityPublicKey).toBe('NEW-PUB');
  expect(mockDb.state.umekProtectionType).toBe('SERVER_KEK');
  expect(mockDb.repaired).toEqual(['u1']);
});

test('an old sign-in (a replayed session) is refused', async () => {
  mockDb.device.meta.signInAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const res = await post(body());
  expect(res.status).toBe(401);
  expect(mockDb.state.identityPublicKey).toBe('OLD-PUB');
});

test('a signed-out device or no device id is refused', async () => {
  mockDb.device.revoked = true;
  expect((await post(body())).status).toBe(401);
  mockDb.device.revoked = false;
  expect((await post(body(), null)).status).toBe(401);
  expect(mockDb.dropped).toEqual([]);
});

test('only password-locked keys, and only to automatic unlock', async () => {
  mockDb.state.umekProtectionType = 'SERVER_KEK';
  expect((await post(body())).status).toBe(401);
  mockDb.state.umekProtectionType = 'PASSWORD';
  expect((await post(body({ umekProtectionType: 'PASSWORD', umekSalt: 's', umekEnvelope: 'password-derived' }))).status).toBe(401);
});
