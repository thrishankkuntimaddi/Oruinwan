'use strict';

// Sign-up and password reset must enforce the password rule on the server, not only in the forms.
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';

const mockResetUser = { email: 'a@example.com', save: jest.fn(async () => {}), refreshTokens: [] };
jest.mock('../../../identity/queries/auth', () => ({
  userDocs: { findByResetToken: jest.fn(async () => mockResetUser), build: jest.fn() },
  emailTaken: jest.fn(async () => false), companyByAllowedEmail: jest.fn(), companyForAutoJoin: jest.fn(), invites: {},
}));
jest.mock('../../../identity', () => ({ users: { findByUsername: jest.fn(async () => null), findByPhone: jest.fn(async () => null) }, companies: {} }));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const { userDocs } = require('../../../identity/queries/auth');
const { signup, resetPassword } = require('../auth.controller');

function call(handler, body) {
  const req = { body, headers: {}, get: () => 'jest', ip: '127.0.0.1', cookies: {}, socket: {} };
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    cookie() { return this; }, clearCookie() { return this; },
  };
  return handler(req, res).then(() => res);
}

const WEAK = ['a', 'password', 'Password', 'Passw0rd', 'passw0rd!', 'PASSWORD!1'.toLowerCase(), 'Aa1!'];

describe('sign-up', () => {
  test.each(WEAK)('refuses the weak password %p before creating anything', async (pw) => {
    const res = await call(signup, { username: 'newbie', email: 'new@example.com', password: pw });
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/8-16 characters/);
    expect(userDocs.build).not.toHaveBeenCalled();
  });
});

describe('password reset', () => {
  test.each(WEAK)('refuses the weak password %p and keeps the old hash', async (pw) => {
    mockResetUser.passwordHash = 'old-hash';
    const res = await call(resetPassword, { token: 't', email: 'a@example.com', password: pw });
    expect(res.statusCode).toBe(400);
    expect(mockResetUser.passwordHash).toBe('old-hash');
  });

  test('accepts a strong password', async () => {
    mockResetUser.passwordHash = 'old-hash';
    const res = await call(resetPassword, { token: 't', email: 'a@example.com', password: 'Str0ng-Pass!' });
    expect(res.statusCode).toBe(200);
    expect(mockResetUser.passwordHash).not.toBe('old-hash');
  });
});
