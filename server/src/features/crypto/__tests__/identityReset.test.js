'use strict';

// Setting encryption up again after a password reset (/api/v2/crypto/identity/init with
// allowOverwrite): the server must check the current account password before replacing the
// keys, and must re-grant conversation keys for the new public key.
const express = require('express');
const bcrypt = require('bcryptjs');

const mockDb = { state: null, user: null, upserts: [], dropped: [], repaired: [] };

jest.mock('../../../identity', () => ({
  cryptoState: {
    findByUserId: jest.fn(async () => mockDb.state),
    upsert: jest.fn(async (userId, doc) => { mockDb.state = { ...doc, userId }; return mockDb.state; }),
  },
  users: { findById: jest.fn(async (id, opts) => (opts?.withSecrets ? mockDb.user : { ...mockDb.user, passwordHash: undefined })) },
}));
jest.mock('../../../identity/keys.repo', () => ({
  identityKeys: { upsert: jest.fn(async (userId, k) => { mockDb.upserts.push({ userId, ...k }); }) },
  conversationKeys: { removeAllMemberKeysForUser: jest.fn(async (userId) => { mockDb.dropped.push(userId); return 3; }) },
}));
jest.mock('../../../modules/conversations/conversationKeys.service', () => ({
  repairUserConversationAccess: jest.fn(async (userId) => { mockDb.repaired.push(userId); return { repaired: 3, dms: { total: 0 } }; }),
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
  mockDb.user = { _id: 'u1', passwordHash: await bcrypt.hash('NewPass#2026', 4) };
});
afterAll(() => new Promise((r) => server.close(r)));

beforeEach(() => {
  mockDb.state = {
    userId: 'u1', identityPublicKey: 'OLD-PUB', encryptedIdentityPrivateKey: 'old', identityPrivateKeyIv: 'iv',
    umekEnvelope: 'password-derived', umekSalt: 'salt', umekProtectionType: 'PASSWORD', algorithm: 'RSA-2048', version: 1,
  };
  mockDb.upserts = []; mockDb.dropped = []; mockDb.repaired = [];
});

const body = (extra) => ({
  identityPublicKey: 'NEW-PUB', encryptedIdentityPrivateKey: 'new', identityPrivateKeyIv: 'iv2',
  umekEnvelope: 'password-derived', umekSalt: 'salt2', umekProtectionType: 'PASSWORD', algorithm: 'RSA-2048', ...extra,
});
const post = (b) => fetch(`${base}/init`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

test('existing keys are never replaced without allowOverwrite', async () => {
  const res = await post(body());
  expect(res.status).toBe(409);
  expect(mockDb.state.identityPublicKey).toBe('OLD-PUB');
});

test('replacing keys needs the current account password', async () => {
  const none = await post(body({ allowOverwrite: true }));
  expect(none.status).toBe(401);
  const wrong = await post(body({ allowOverwrite: true, currentPassword: 'Guess#1234' }));
  expect(wrong.status).toBe(401);
  expect(mockDb.state.identityPublicKey).toBe('OLD-PUB');
  expect(mockDb.dropped).toEqual([]);
});

test('with the right password the keys are replaced and conversation access is re-granted', async () => {
  const res = await post(body({ allowOverwrite: true, currentPassword: 'NewPass#2026' }));
  expect(res.status).toBe(200);
  expect(mockDb.state.identityPublicKey).toBe('NEW-PUB');
  expect(mockDb.state.version).toBe(2);
  expect(mockDb.upserts).toEqual([expect.objectContaining({ userId: 'u1', publicKey: 'NEW-PUB' })]);
  expect(mockDb.dropped).toEqual(['u1']);
  expect(mockDb.repaired).toEqual(['u1']);
});

test('an account without a password cannot replace its keys this way', async () => {
  const saved = mockDb.user;
  mockDb.user = { _id: 'u1' };
  try {
    const res = await post(body({ allowOverwrite: true, currentPassword: 'anything' }));
    expect(res.status).toBe(401);
  } finally {
    mockDb.user = saved;
  }
});
