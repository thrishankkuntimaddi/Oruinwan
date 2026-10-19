'use strict';

// GitHub/LinkedIn sign-in hand-off: the callback gives the app a one-time code, and swapping
// it for a session runs the same checks as every other sign-in.
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
delete process.env.REDIS_URL;

const mockState = { user: null };
jest.mock('../../security/totp', () => ({ verifyUserTotp: jest.fn(async (secret, otp) => secret === 'enc-secret' && otp === '123456') }));
jest.mock('../../../identity/queries/auth', () => ({
  userDocs: { findById: jest.fn(async (id) => (mockState.user && String(mockState.user._id) === String(id) ? mockState.user : null)) },
  emailTaken: jest.fn(), companyByAllowedEmail: jest.fn(), companyForAutoJoin: jest.fn(), invites: {},
}));
jest.mock('../../../identity', () => ({ companies: { findByDomain: jest.fn(async () => null), findById: jest.fn(async () => null) } }));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const { oauthExchange } = require('../auth.controller');
const handoff = require('../oauthHandoff');

function call(body, headers = {}) {
  const req = { body, headers, get: (h) => headers[h.toLowerCase()] || 'jest', ip: '127.0.0.1', cookies: {}, socket: {} };
  const res = {
    statusCode: 200, body: null, cookies: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    cookie(n, v) { this.cookies[n] = v; return this; },
    clearCookie() { return this; },
  };
  return oauthExchange(req, res).then(() => res);
}

beforeEach(() => {
  mockState.user = {
    _id: 'u1', email: 'a@example.com', username: 'A', authProvider: 'github', verified: true,
    refreshTokens: [], roles: [], failedLoginAttempts: 0, save: jest.fn(async () => {}),
  };
});

test('an unknown code is refused', async () => {
  const res = await call({ code: 'x'.repeat(43) });
  expect(res.statusCode).toBe(400);
  expect(res.body.accessToken).toBeUndefined();
});

test('a valid code gives a full session, once', async () => {
  const code = await handoff.createHandoff('u1', 'github');
  const res = await call({ code }, { 'x-client-platform': 'android' });
  expect(res.statusCode).toBe(200);
  expect(res.body.accessToken).toBeTruthy();
  expect(res.body.refreshToken).toBeTruthy();
  expect(mockState.user.refreshTokens).toHaveLength(1);
  expect(res.body.requiresPasswordSetup).toBe(true);
  expect((await call({ code })).statusCode).toBe(400);
});

test('two-factor accounts must send their code, and the hand-off waits for it', async () => {
  Object.assign(mockState.user, { twoFactorEnabled: true, twoFactorSecret: 'enc-secret' });
  const code = await handoff.createHandoff('u1', 'github');

  const first = await call({ code });
  expect(first.statusCode).toBe(401);
  expect(first.body.requires2FA).toBe(true);
  expect(first.body.accessToken).toBeUndefined();

  const wrong = await call({ code, otp: '000000' });
  expect(wrong.statusCode).toBe(401);
  expect(wrong.body.invalidCode).toBe(true);
  expect(mockState.user.failedLoginAttempts).toBe(1);

  const right = await call({ code, otp: '123 456' });
  expect(right.statusCode).toBe(200);
  expect(right.body.accessToken).toBeTruthy();
});

test('suspended accounts are refused and the code is burned', async () => {
  mockState.user.accountStatus = 'suspended';
  const code = await handoff.createHandoff('u1', 'github');
  expect((await call({ code })).statusCode).toBe(403);
  mockState.user.accountStatus = 'active';
  expect((await call({ code })).statusCode).toBe(400);
});

test('locked accounts are refused', async () => {
  mockState.user.lockedUntil = new Date(Date.now() + 60000);
  const code = await handoff.createHandoff('u1', 'github');
  expect((await call({ code })).statusCode).toBe(429);
});

describe('where the code is sent', () => {
  const env = { NODE_ENV: 'production', FRONTEND_URL: 'https://chat.example.com', CORS_EXTRA_ORIGINS: 'https://app.example.com' };

  test('a trusted origin is used', () => {
    expect(handoff.returnOrigin('https://app.example.com/anything', env)).toBe('https://app.example.com');
  });

  test.each(['https://evil.example.net', 'javascript:alert(1)', 'http://localhost:5173', '', undefined])(
    'anything else falls back to FRONTEND_URL (%p)', (requested) => {
      expect(handoff.returnOrigin(requested, env)).toBe('https://chat.example.com');
    });

  test('the redirect carries only the code, in the fragment', async () => {
    const res = { redirect: jest.fn(), clearCookie: jest.fn() };
    const prev = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://chat.example.com';
    try {
      await handoff.redirectWithHandoff({ cookies: {} }, res, { _id: 'u1' }, 'github');
    } finally {
      process.env.FRONTEND_URL = prev;
    }
    const url = res.redirect.mock.calls[0][0];
    expect(url).toMatch(/^https:\/\/chat\.example\.com\/oauth-success#code=[A-Za-z0-9_-]{43}$/);
    expect(url).not.toMatch(/access=/);
  });
});
