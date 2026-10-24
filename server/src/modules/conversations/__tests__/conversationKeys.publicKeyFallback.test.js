'use strict';

// A member whose separate public-key upload never reached the server still gets DM and
// channel keys: the server wraps for the public key saved with their encryption setup.
process.env.SERVER_KEK = process.env.SERVER_KEK || 'e2e0'.repeat(16);
const crypto = require('crypto');

const mockIds = { DM: '64b000000000000000000002' };
const VARSHITHA = '64a000000000000000000001';
const THRUSHITHA = '64a000000000000000000002';

const mockKeyPair = () => crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const mockKeys = { [VARSHITHA]: mockKeyPair(), [THRUSHITHA]: mockKeyPair() };
const mockStore = { docs: new Map(), published: new Map(), states: new Map() };

function mockDoc(d) {
  const doc = { ...d, encryptedKeys: [...d.encryptedKeys] };
  doc.hasAccess = (u) => doc.encryptedKeys.some((e) => String(e.userId) === String(u));
  doc.getEncryptedKeyForUser = (u) => doc.encryptedKeys.find((e) => String(e.userId) === String(u)) || null;
  doc.save = async () => { mockStore.docs.set(`${doc.conversationType}:${doc.conversationId}`, { ...doc }); return doc; };
  return doc;
}

jest.mock('../../../identity/queries/auth', () => ({
  conversationKeyDocs: {
    findByConversation: jest.fn(async (id, type) => {
      const d = mockStore.docs.get(`${type}:${id}`);
      return d ? mockDoc(d) : null;
    }),
    create: jest.fn(async (d) => { mockStore.docs.set(`${d.conversationType}:${d.conversationId}`, { ...d }); return mockDoc(d); }),
  },
}));
jest.mock('../../../identity', () => ({
  identityKeys: {
    findByUserId: jest.fn(async (u) => mockStore.published.get(String(u)) || null),
    batchFindByUserIds: jest.fn(async (ids) => ids.map((u) => mockStore.published.get(String(u))).filter(Boolean)),
  },
  cryptoState: {
    findByUserId: jest.fn(async (u) => mockStore.states.get(String(u)) || null),
    batchFindByUserIds: jest.fn(async (ids) => ids.map((u) => mockStore.states.get(String(u))).filter(Boolean)),
  },
}));
jest.mock('../../../../models/DMSession', () => ({
  findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ _id: mockIds.DM, workspace: 'w1', participants: [VARSHITHA, THRUSHITHA] }) }) })),
}));

const svc = require('../conversationKeys.service');

const opens = (userId, doc) => {
  const copy = doc.encryptedKeys.find((e) => String(e.userId) === userId);
  if (!copy) return false;
  const raw = crypto.privateDecrypt({ key: mockKeys[userId].privateKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' }, Buffer.from(copy.encryptedKey, 'base64'));
  return raw.length === 32;
};
const state = (u) => ({ userId: u, identityPublicKey: mockKeys[u].publicKey, algorithm: 'RSA-2048' });

beforeEach(() => {
  mockStore.docs.clear();
  mockStore.published.clear();
  mockStore.states.clear();
});

test('a new DM is keyed for a member whose public key was never published', async () => {
  mockStore.states.set(VARSHITHA, state(VARSHITHA));
  mockStore.states.set(THRUSHITHA, state(THRUSHITHA));
  mockStore.published.set(THRUSHITHA, { userId: THRUSHITHA, publicKey: mockKeys[THRUSHITHA].publicKey });

  expect(await svc.ensureDMConversationKey(mockIds.DM, VARSHITHA)).toEqual({ status: 'CREATED' });
  const doc = mockStore.docs.get(`dm:${mockIds.DM}`);
  expect(opens(VARSHITHA, doc)).toBe(true);
  expect(opens(THRUSHITHA, doc)).toBe(true);
});

test('an existing DM key reaches a member who only has an encryption setup', async () => {
  mockStore.states.set(THRUSHITHA, state(THRUSHITHA));
  await svc.ensureDMConversationKey(mockIds.DM); // Varshitha has no keys at all yet
  mockStore.states.set(VARSHITHA, state(VARSHITHA));

  expect(await svc.ensureDMConversationKey(mockIds.DM, VARSHITHA)).toMatchObject({ status: 'OK', distributed: 1 });
  expect(opens(VARSHITHA, mockStore.docs.get(`dm:${mockIds.DM}`))).toBe(true);
});

test('the key saved with the encryption setup wins over an outdated published one', async () => {
  const stale = mockKeyPair();
  mockStore.states.set(VARSHITHA, state(VARSHITHA));
  mockStore.states.set(THRUSHITHA, state(THRUSHITHA));
  mockStore.published.set(VARSHITHA, { userId: VARSHITHA, publicKey: stale.publicKey });

  await svc.ensureDMConversationKey(mockIds.DM, VARSHITHA);
  expect(opens(VARSHITHA, mockStore.docs.get(`dm:${mockIds.DM}`))).toBe(true);
});

test('accounts with only a published key still work', async () => {
  mockStore.published.set(VARSHITHA, { userId: VARSHITHA, publicKey: mockKeys[VARSHITHA].publicKey });
  mockStore.published.set(THRUSHITHA, { userId: THRUSHITHA, publicKey: mockKeys[THRUSHITHA].publicKey });

  await svc.ensureDMConversationKey(mockIds.DM, VARSHITHA);
  const doc = mockStore.docs.get(`dm:${mockIds.DM}`);
  expect(opens(VARSHITHA, doc)).toBe(true);
  expect(opens(THRUSHITHA, doc)).toBe(true);
});
