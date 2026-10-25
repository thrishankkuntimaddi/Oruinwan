'use strict';

const crypto = require('crypto');

const mockUser = { deviceTokens: [] };
jest.mock('../../../identity', () => ({
  users: { findById: jest.fn(async () => mockUser), update: jest.fn(async () => {}) },
}));
jest.mock('axios', () => ({ post: jest.fn() }));
const mockWebPush = jest.fn(async () => ({ statusCode: 201 }));
jest.mock('web-push', () => ({ sendNotification: (...a) => mockWebPush(...a) }));

// A fake HTTP/2 connection to Apple that records each request and answers 200.
const mockApnsRequests = [];
jest.mock('http2', () => {
  const { EventEmitter } = require('events');
  return {
    connect: jest.fn(() => {
      const session = new EventEmitter();
      session.close = jest.fn();
      session.request = (headers) => {
        const req = new EventEmitter();
        req.setEncoding = () => {};
        req.end = (payload) => {
          mockApnsRequests.push({ headers, payload: JSON.parse(payload) });
          setImmediate(() => { req.emit('response', { ':status': 200 }); req.emit('end'); });
        };
        return req;
      };
      return session;
    }),
  };
});
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
  delete process.env.WEB_PUSH_PUBLIC_KEY;
  delete process.env.WEB_PUSH_PRIVATE_KEY;
  mockUser.deviceTokens = [];
});

test('sends nothing and fails nothing when push is not set up', async () => {
  mockUser.deviceTokens = [{ token: 'a'.repeat(40), platform: 'android' }];
  expect(push.isConfigured()).toEqual({ android: false, ios: false, web: false, webKey: null });
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

describe('message pushes carry the quick-reply category', () => {
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const setApple = () => {
    process.env.APNS_KEY = ec.privateKey.export({ type: 'pkcs8', format: 'pem' });
    process.env.APNS_KEY_ID = 'kid';
    process.env.APNS_TEAM_ID = 'team';
    process.env.APNS_BUNDLE_ID = 'com.oruinwan.app';
  };
  afterEach(() => {
    delete process.env.APNS_KEY_ID; delete process.env.APNS_TEAM_ID; delete process.env.APNS_BUNDLE_ID;
    mockApnsRequests.length = 0;
  });

  test('isMessagePush: message types with a conversation only', () => {
    const { isMessagePush } = push._internal;
    expect(isMessagePush({ type: 'mention', channelId: 'c1' })).toBe(true);
    expect(isMessagePush({ type: 'dm', dmSessionId: 'd1' })).toBe(true);
    expect(isMessagePush({ type: 'thread_reply', channelId: 'c1', parentMessageId: 'm1' })).toBe(true);
    expect(isMessagePush({ type: 'mention' })).toBe(false);
    expect(isMessagePush({ type: 'huddle_started', channelId: 'c1' })).toBe(false);
    expect(isMessagePush({ type: 'task_assigned' })).toBe(false);
    expect(isMessagePush(undefined)).toBe(false);
  });

  test('iOS: aps.category oru.message on a DM push, none on a task push', async () => {
    setApple();
    mockUser.deviceTokens = [{ token: 'b'.repeat(64), platform: 'ios' }];
    await push.sendToUser('u1', 'Ana', 'New message', { type: 'dm', dmSessionId: 'd1', workspaceId: 'ws1' });
    await push.sendToUser('u1', 'Task', 'Assigned to you', { type: 'task_assigned', workspaceId: 'ws1' });

    expect(mockApnsRequests).toHaveLength(2);
    const [dm, task] = mockApnsRequests.map((r) => r.payload);
    expect(dm.aps).toMatchObject({ alert: { title: 'Ana', body: 'New message' }, category: 'oru.message', 'thread-id': 'd1' });
    expect(dm.category).toBe('oru.message');
    expect(task.aps.category).toBeUndefined();
    expect(task.category).toBeUndefined();
    expect(mockApnsRequests[0].headers['apns-topic']).toBe('com.oruinwan.app');
  });

  test('Android: message pushes say category oru.message in the data', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = serviceAccount;
    mockUser.deviceTokens = [{ token: 'a'.repeat(40), platform: 'android' }];
    axios.post.mockResolvedValue({ data: {} });
    await push.sendToUser('u1', 'Ana mentioned you', 'in #general', { type: 'mention', channelId: 'c1' });
    expect(axios.post.mock.calls[0][1].message.data).toMatchObject({ category: 'oru.message', conversationId: 'c1', type: 'mention' });
    expect(axios.post.mock.calls[0][1].message.android.notification.channel_id).toBe('messages');
  });
});

describe('call pushes', () => {
  const call = { huddleId: 'h1', kind: 'dm', dmId: 'd1', from: { id: 'u2', name: 'Ben' }, video: true, ring: true };

  test('Android: a ringing call is a high-priority data-only message that expires with the ring', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = serviceAccount;
    mockUser.deviceTokens = [{ token: 'a'.repeat(40), platform: 'android' }];
    axios.post.mockReset();
    axios.post.mockResolvedValue({ data: {} });
    await push.sendCallToUser('u1', 'call', call);
    const message = axios.post.mock.calls[0][1].message;
    expect(message.notification).toBeUndefined();
    expect(message.android).toEqual({ priority: 'HIGH', ttl: '45s' });
    expect(message.data.type).toBe('call');
    expect(JSON.parse(message.data.call)).toMatchObject({ huddleId: 'h1', from: { name: 'Ben' }, video: true });
  });

  test('Android: a cancel is data-only too', async () => {
    process.env.FIREBASE_SERVICE_ACCOUNT = serviceAccount;
    mockUser.deviceTokens = [{ token: 'a'.repeat(40), platform: 'android' }];
    axios.post.mockReset();
    axios.post.mockResolvedValue({ data: {} });
    await push.sendCallToUser('u1', 'call_cancel', { huddleId: 'h1', reason: 'answered_elsewhere' });
    const message = axios.post.mock.calls[0][1].message;
    expect(message.notification).toBeUndefined();
    expect(message.data).toMatchObject({ type: 'call_cancel', huddleId: 'h1', reason: 'answered_elsewhere' });
  });
});

describe('browsers (Web Push)', () => {
  const sub = JSON.stringify({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } });
  const setUp = () => {
    process.env.WEB_PUSH_PUBLIC_KEY = 'BPublicKey';
    process.env.WEB_PUSH_PRIVATE_KEY = 'privateKey';
    mockUser.deviceTokens = [{ token: sub, platform: 'web' }];
    mockWebPush.mockReset();
    mockWebPush.mockResolvedValue({ statusCode: 201 });
  };

  test('the app learns the public key, and messages go out one per conversation', async () => {
    setUp();
    expect(push.isConfigured()).toMatchObject({ web: true, webKey: 'BPublicKey' });
    await push.sendToUser('u1', 'Priya in #general', 'New message', { channelId: 'c1', type: 'channel_message' });
    expect(mockWebPush).toHaveBeenCalledTimes(1);
    const [subscription, payload, opts] = mockWebPush.mock.calls[0];
    expect(subscription.endpoint).toMatch(/fcm\/send\/abc$/);
    expect(JSON.parse(payload)).toMatchObject({ title: 'Priya in #general', body: 'New message', tag: 'c1', data: { channelId: 'c1' } });
    expect(opts.vapidDetails).toMatchObject({ publicKey: 'BPublicKey', privateKey: 'privateKey', subject: 'mailto:admin@poelys.com' });
  });

  test('a ringing call is urgent and expires with the ring; its end replaces it', async () => {
    setUp();
    await push.sendCallToUser('u1', 'call', { huddleId: 'h1', kind: 'dm', from: { name: 'Ben' }, video: false });
    const [, payload, opts] = mockWebPush.mock.calls[0];
    expect(JSON.parse(payload)).toMatchObject({ title: 'Ben', body: 'Incoming voice call', tag: 'call:h1', data: { type: 'call', huddleId: 'h1' } });
    expect(opts).toMatchObject({ TTL: 45, urgency: 'high' });
    await push.sendCallToUser('u1', 'call_cancel', { huddleId: 'h1' });
    expect(JSON.parse(mockWebPush.mock.calls[1][1])).toMatchObject({ tag: 'call:h1', data: { type: 'call_cancel' } });
  });

  test('a subscription the browser dropped is removed', async () => {
    setUp();
    mockWebPush.mockRejectedValue(Object.assign(new Error('gone'), { statusCode: 410 }));
    const identity = require('../../../identity');
    await push.sendToUser('u1', 'Hi', 'There');
    expect(identity.users.update).toHaveBeenCalledWith('u1', { deviceTokens: [] });
  });
});
