'use strict';

const crypto = require('crypto');

const mockUser = { deviceTokens: [] };
jest.mock('../../../identity', () => ({
  users: { findById: jest.fn(async () => mockUser), update: jest.fn(async () => {}) },
}));
jest.mock('axios', () => ({ post: jest.fn() }));
jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn(() => ({ getClient: async () => ({ getAccessToken: async () => ({ token: 'fcm-access' }) }) })),
}));

const axios = require('axios');
const identity = require('../../../identity');
const push = require('../push.service');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const serviceAccount = JSON.stringify({
  project_id: 'oruinwan-test',
  client_email: 'push@oruinwan-test.iam.gserviceaccount.com',
  private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
});

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  delete process.env.APNS_KEY;
  mockUser.deviceTokens = [];
});

test('sends nothing and fails nothing when push is not set up', async () => {
  mockUser.deviceTokens = [{ token: 'a'.repeat(40), platform: 'android' }];
  expect(push.isConfigured()).toEqual({ android: false, ios: false });
  await push.sendToUser('u1', 'Hi', 'There');
  expect(axios.post).not.toHaveBeenCalled();
});

test('sends Android notifications through Firebase with string data', async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT = serviceAccount;
  mockUser.deviceTokens = [{ token: 'a'.repeat(40), platform: 'android' }];
  axios.post.mockResolvedValue({ data: { name: 'ok' } });

  await push.sendToUser('u1', 'Priya in #general', 'New message', { dmSessionId: null, channelId: 'c1', workspaceId: 'ws1' });

  expect(axios.post).toHaveBeenCalledTimes(1);
  const [url, body, opts] = axios.post.mock.calls[0];
  expect(url).toBe('https://fcm.googleapis.com/v1/projects/oruinwan-test/messages:send');
  expect(opts.headers.Authorization).toBe('Bearer fcm-access');
  expect(body.message).toMatchObject({
    token: 'a'.repeat(40),
    notification: { title: 'Priya in #general', body: 'New message' },
    data: { channelId: 'c1', workspaceId: 'ws1', conversationId: 'c1' },
  });
  expect(Object.values(body.message.data).every((v) => typeof v === 'string')).toBe(true);
  expect(identity.users.update).not.toHaveBeenCalled();
});

test('removes tokens Firebase says are gone, and old Expo tokens', async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT = serviceAccount;
  mockUser.deviceTokens = [
    { token: 'gone'.padEnd(40, 'x'), platform: 'android' },
    { token: 'live'.padEnd(40, 'x'), platform: 'android' },
    { token: 'ExponentPushToken[abc]', platform: 'unknown' },
  ];
  axios.post.mockImplementation(async (url, body) => {
    if (body.message.token.startsWith('gone')) {
      throw Object.assign(new Error('404'), { response: { status: 404, data: { error: { status: 'NOT_FOUND' } } } });
    }
    return { data: {} };
  });

  await push.sendToUser('u1', 't', 'b');

  expect(identity.users.update).toHaveBeenCalledWith('u1', { deviceTokens: [{ token: 'live'.padEnd(40, 'x'), platform: 'android' }] });
});

test('a temporary Firebase failure keeps the token', async () => {
  process.env.FIREBASE_SERVICE_ACCOUNT = serviceAccount;
  mockUser.deviceTokens = [{ token: 'a'.repeat(40), platform: 'android' }];
  axios.post.mockRejectedValue(Object.assign(new Error('503'), { response: { status: 503, data: {} } }));
  await push.sendToUser('u1', 't', 'b');
  expect(identity.users.update).not.toHaveBeenCalled();
});

test('Apple is configured only with every key', () => {
  process.env.APNS_KEY = 'k';
  process.env.APNS_KEY_ID = 'id';
  process.env.APNS_TEAM_ID = 'team';
  expect(push.isConfigured().ios).toBe(false);
  process.env.APNS_BUNDLE_ID = 'com.oruinwan.app';
  expect(push.isConfigured().ios).toBe(true);
  delete process.env.APNS_KEY_ID; delete process.env.APNS_TEAM_ID; delete process.env.APNS_BUNDLE_ID;
});
