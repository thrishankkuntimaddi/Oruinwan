'use strict';

const mockState = { user: null, phoneOwner: null };

function mockMakeUser(overrides = {}) {
  return {
    _id: 'u1',
    username: 'Old Name',
    email: 'a@example.com',
    phone: '5551234',
    phoneCode: '+1',
    authProvider: 'local',
    passwordHash: '$2a$12$abcdefghijklmnopqrstuv',
    profile: { about: 'hello' },
    preferences: { theme: 'light' },
    emails: [{ _id: 'e1', email: 'a@example.com', verified: true, isPrimary: true }],
    ...overrides,
    set(path, value) {
      const parts = path.split('.');
      let o = this;
      for (const p of parts.slice(0, -1)) { o[p] = o[p] || {}; o = o[p]; }
      o[parts[parts.length - 1]] = value;
    },
    toObject() {
      const { set: _s, toObject: _t, ...rest } = this;
      return JSON.parse(JSON.stringify(rest));
    },
  };
}

jest.mock('../../../../models/User', () => ({
  findById: jest.fn(() => {
    const q = {
      select: () => q,
      populate: () => q,
      then: (resolve, reject) => Promise.resolve(mockState.user).then(resolve, reject),
    };
    return q;
  }),
  findOne: jest.fn(() => ({ select: () => ({ lean: async () => mockState.phoneOwner }) })),
}));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const { saveWithRetry } = require('../../../../utils/mongooseRetry');
const { updateMe, computeHasPassword } = require('../auth.controller');

function run(body) {
  const req = { user: { sub: 'u1' }, body, headers: {} };
  const res = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  return updateMe(req, res).then(() => res);
}

beforeEach(() => {
  mockState.user = mockMakeUser();
  mockState.phoneOwner = null;
});

describe('PUT /api/auth/me validation', () => {
  test('username is trimmed and must be 2-50 characters', async () => {
    expect((await run({ username: ' a ' })).statusCode).toBe(400);
    expect((await run({ username: 'x'.repeat(51) })).statusCode).toBe(400);
    expect(saveWithRetry).not.toHaveBeenCalled();

    const ok = await run({ username: '  Ada Lovelace  ' });
    expect(ok.statusCode).toBe(200);
    expect(mockState.user.username).toBe('Ada Lovelace');
  });

  test('about can be cleared and is capped at 500', async () => {
    expect((await run({ about: 'y'.repeat(501) })).statusCode).toBe(400);
    const ok = await run({ about: '' });
    expect(ok.statusCode).toBe(200);
    expect(mockState.user.profile.about).toBe('');
  });

  test('phone can be cleared (unset, not stored as empty string)', async () => {
    const ok = await run({ phone: '' });
    expect(ok.statusCode).toBe(200);
    expect(mockState.user.phone).toBeUndefined();
  });

  test('phone and phoneCode formats are validated', async () => {
    expect((await run({ phone: 'abc123' })).statusCode).toBe(400);
    expect((await run({ phone: '12' })).statusCode).toBe(400);
    expect((await run({ phoneCode: '1' })).statusCode).toBe(400);
    expect((await run({ phoneCode: '+1234' })).statusCode).toBe(400);
    const ok = await run({ phone: '555-123 4567', phoneCode: '+44' });
    expect(ok.statusCode).toBe(200);
    expect(mockState.user.phone).toBe('5551234567');
    expect(mockState.user.phoneCode).toBe('+44');
  });

  test('a phone number used by another account is a 409', async () => {
    mockState.phoneOwner = { _id: 'someone-else' };
    const res = await run({ phone: '555 999 0000' });
    expect(res.statusCode).toBe(409);
    expect(saveWithRetry).not.toHaveBeenCalled();
  });

  test('theme and appearance.textSize are validated and merged', async () => {
    expect((await run({ preferences: { theme: 'neon' } })).statusCode).toBe(400);
    expect((await run({ preferences: { appearance: { textSize: 'huge' } } })).statusCode).toBe(400);
    const ok = await run({ preferences: { theme: 'dark', appearance: { textSize: 'large' } } });
    expect(ok.statusCode).toBe(200);
    expect(mockState.user.preferences.theme).toBe('dark');
    expect(mockState.user.preferences.appearance.textSize).toBe('large');
  });

  test('returns the /me shape: preferences with defaults, hasPassword, no hash', async () => {
    const res = await run({ username: 'New Name' });
    expect(res.statusCode).toBe(200);
    const u = res.body.user;
    expect(u.username).toBe('New Name');
    expect(u.hasPassword).toBe(true);
    expect(u.passwordHash).toBeUndefined();
    expect(u.preferences).toMatchObject({
      theme: 'light',
      appearance: { textSize: 'default' },
      privacy: { readReceipts: true, typingIndicators: true, allowDiscovery: true },
      region: { language: 'en', timezone: 'auto', dateFormat: 'MM/DD/YYYY', timeFormat: '12h' },
    });
    expect(u.about).toBe('hello');
  });
});

describe('computeHasPassword', () => {
  test('OAuth placeholder or random hashes do not count until a password is set', () => {
    expect(computeHasPassword({ passwordHash: null })).toBe(false);
    expect(computeHasPassword({ passwordHash: 'oauth-github-1', authProvider: 'github' })).toBe(false);
    expect(computeHasPassword({ passwordHash: '$2a$12$x', authProvider: 'google', passwordSetAt: null })).toBe(false);
    expect(computeHasPassword({ passwordHash: '$2a$12$x', authProvider: 'google', passwordSetAt: new Date() })).toBe(true);
    expect(computeHasPassword({ passwordHash: '$2a$12$x', authProvider: 'local' })).toBe(true);
  });
});
