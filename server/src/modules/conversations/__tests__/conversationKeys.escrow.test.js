'use strict';

// Conversation keys always reach every member: the server copy is added to older keys
// (escrow), copies that no longer open are wrapped again (rewrap), and members without a copy
// get one from the server copy.
process.env.SERVER_KEK = process.env.SERVER_KEK || 'e2e0'.repeat(16);
const crypto = require('crypto');

const mockIds = { CH: '64b000000000000000000001', DM: '64b000000000000000000002' };
const CH = mockIds.CH;
const DM = mockIds.DM;
const ALICE = '64a000000000000000000001';
const BOB = '64a000000000000000000002';
const CAROL = '64a000000000000000000003';

const { publicKey: mockPub } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });

const mockStore = { docs: new Map(), members: { channel: [], dm: [] }, keys: new Set() };

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
  },
}));
jest.mock('../../../identity', () => ({
  identityKeys: {
    findByUserId: jest.fn(async (u) => (mockStore.keys.has(String(u)) ? { userId: u, publicKey: mockPub } : null)),
    batchFindByUserIds: jest.fn(async () => []),
  },
}));
jest.mock('../../../../models/DMSession', () => ({
  findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ _id: mockIds.DM, participants: mockStore.members.dm }) }) })),
}));
jest.mock('../../../features/channels/channel.model.js', () => ({
  findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ _id: mockIds.CH, members: mockStore.members.channel.map((u) => ({ user: u })) }) }) })),
}));

const svc = require('../conversationKeys.service');

beforeEach(() => {
  mockStore.docs.clear();
  mockStore.keys = new Set([ALICE, BOB, CAROL]);
  mockStore.members.channel = [ALICE, BOB, CAROL];
  mockStore.members.dm = [ALICE, BOB];
});

const legacy = (type, id, holders) => mockStore.docs.set(`${type}:${id}`, {
  conversationId: id, conversationType: type, workspaceId: 'w1', createdBy: null,
  workspaceEncryptedKey: null, workspaceKeyIv: null, workspaceKeyAuthTag: null, version: 1,
  encryptedKeys: holders.map((u) => ({ userId: u, encryptedKey: 'x', algorithm: 'RSA-2048' })),
});

test('a member who holds an older key adds the server copy, and members without a copy get one', async () => {
  legacy('channel', CH, [ALICE]);
  const raw = crypto.randomBytes(32);
  const out = await svc.escrowConversationKey(CH, 'channel', ALICE, raw.toString('base64'));
  expect(out).toEqual({ status: 'ESCROWED', distributed: 2 });
  const saved = mockStore.docs.get(`channel:${CH}`);
  expect(saved.workspaceEncryptedKey).toBeTruthy();
  expect(saved.encryptedKeys.map((e) => e.userId).sort()).toEqual([ALICE, BOB, CAROL].sort());
  // The server copy is the same key the member sent.
  const { unwrapWithServerKEK } = require('../cryptoUtils');
  expect(unwrapWithServerKEK(saved.workspaceEncryptedKey, saved.workspaceKeyIv, saved.workspaceKeyAuthTag).equals(raw)).toBe(true);
});

test('escrow is refused for non-members, people without a copy and malformed keys', async () => {
  legacy('dm', DM, [ALICE]);
  expect((await svc.escrowConversationKey(DM, 'dm', CAROL, crypto.randomBytes(32).toString('base64'))).status).toBe('NOT_MEMBER');
  expect((await svc.escrowConversationKey(DM, 'dm', BOB, crypto.randomBytes(32).toString('base64'))).status).toBe('NO_ACCESS');
  expect((await svc.escrowConversationKey(DM, 'dm', ALICE, 'c2hvcnQ=')).status).toBe('BAD_KEY');
  expect(mockStore.docs.get(`dm:${DM}`).workspaceEncryptedKey).toBeNull();
});

test('an existing server copy is never replaced by escrow', async () => {
  legacy('dm', DM, [ALICE]);
  await svc.escrowConversationKey(DM, 'dm', ALICE, crypto.randomBytes(32).toString('base64'));
  const first = mockStore.docs.get(`dm:${DM}`).workspaceEncryptedKey;
  const again = await svc.escrowConversationKey(DM, 'dm', ALICE, crypto.randomBytes(32).toString('base64'));
  expect(again.status).toBe('ALREADY_ESCROWED');
  expect(mockStore.docs.get(`dm:${DM}`).workspaceEncryptedKey).toBe(first);
});

test('rewrap replaces a copy that no longer opens with one for the current public key', async () => {
  legacy('channel', CH, [ALICE]);
  await svc.escrowConversationKey(CH, 'channel', ALICE, crypto.randomBytes(32).toString('base64'));
  const before = mockStore.docs.get(`channel:${CH}`).encryptedKeys.find((e) => e.userId === BOB).encryptedKey;
  expect(await svc.rewrapForUser(CH, 'channel', BOB)).toEqual({ status: 'REWRAPPED' });
  const after = mockStore.docs.get(`channel:${CH}`).encryptedKeys.filter((e) => e.userId === BOB);
  expect(after).toHaveLength(1);
  expect(after[0].encryptedKey).not.toBe(before);
});

test('rewrap needs a server copy and membership', async () => {
  legacy('channel', CH, [ALICE]);
  expect((await svc.rewrapForUser(CH, 'channel', ALICE)).status).toBe('NO_SERVER_COPY');
  mockStore.members.channel = [ALICE];
  expect((await svc.rewrapForUser(CH, 'channel', BOB)).status).toBe('NOT_MEMBER');
});

test('a member who sets up encryption later gets their copy once a server copy exists', async () => {
  mockStore.keys.delete(CAROL);
  legacy('channel', CH, [ALICE]);
  const out = await svc.escrowConversationKey(CH, 'channel', ALICE, crypto.randomBytes(32).toString('base64'));
  expect(out.distributed).toBe(1); // Bob now, Carol has no key yet
  mockStore.keys.add(CAROL);
  expect(await svc.distributeKeyToNewMember(CH, 'channel', CAROL)).toBe(true);
  expect(mockStore.docs.get(`channel:${CH}`).encryptedKeys.map((e) => e.userId)).toContain(CAROL);
});
