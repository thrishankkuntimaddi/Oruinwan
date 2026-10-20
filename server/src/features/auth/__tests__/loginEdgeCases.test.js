'use strict';

// Password sign-in for an account made with Google (no password yet) must answer like a wrong
// password instead of crashing, and "forgot password" must answer the same for unknown emails.
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';

const mockState = { user: null };

jest.mock('../../../identity/queries/auth', () => ({
  userDocs: { findByEmail: jest.fn(async () => mockState.user) },
  emailTaken: jest.fn(), companyByAllowedEmail: jest.fn(), companyForAutoJoin: jest.fn(), invites: {},
}));
jest.mock('../../../identity', () => ({ companies: { findByDomain: jest.fn(async () => null), findById: jest.fn(async () => null) } }));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn(async () => ({})));
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const { login, forgotPassword } = require('../auth.controller');

function run(handler, body) {
  const req = { body, headers: {}, get: () => 'jest', ip: '127.0.0.1', cookies: {}, socket: {} };
  const res = {
    statusCode: 200, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    cookie() { return this; }, clearCookie() { return this; },
  };
  return handler(req, res).then(() => res);
}

test('password sign-in for an account without a password is a normal "invalid credentials"', async () => {
  mockState.user = { _id: 'g1', email: 'g@northwind.test', authProvider: 'google', verified: true, refreshTokens: [], save: jest.fn() };
  const res = await run(login, { email: 'g@northwind.test', password: 'Whatever#1' });
  expect(res.statusCode).toBe(400);
  expect(res.body.message).toBe('Invalid credentials');
});

test('forgot password answers the same whether or not the account exists', async () => {
  mockState.user = null;
  const unknown = await run(forgotPassword, { email: 'nobody@northwind.test' });
  mockState.user = { _id: 'u1', email: 'dana@northwind.test', username: 'dana', save: jest.fn() };
  const known = await run(forgotPassword, { email: 'dana@northwind.test' });
  expect(unknown.statusCode).toBe(200);
  expect(known.statusCode).toBe(200);
  expect(unknown.body).toEqual(known.body);
});
