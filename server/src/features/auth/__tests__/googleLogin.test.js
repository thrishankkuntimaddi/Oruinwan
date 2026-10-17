'use strict';

// Google sign-in must only trust tokens Google issued to this server's own client id.
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
process.env.GOOGLE_CLIENT_ID = 'our-app.apps.googleusercontent.com';

const mockGoogle = { getTokenInfo: jest.fn(), verifyIdToken: jest.fn() };
const mockState = { user: null };

jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn(() => mockGoogle) }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../../identity/queries/auth', () => ({
  userDocs: { findByEmail: jest.fn(async () => mockState.user), create: jest.fn() },
  emailTaken: jest.fn(), companyByAllowedEmail: jest.fn(), companyForAutoJoin: jest.fn(), invites: {},
}));
jest.mock('../../../identity', () => ({ companies: { findByDomain: jest.fn(async () => null), findById: jest.fn(async () => null) } }));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const axios = require('axios');
const { userDocs } = require('../../../identity/queries/auth');
const { googleLogin } = require('../auth.controller');

function run(body) {
  const req = { body, headers: {}, get: () => 'jest', ip: '127.0.0.1', cookies: {}, socket: {} };
  const res = {
    statusCode: 200, body: null, cookies: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    cookie(n, v) { this.cookies[n] = v; return this; },
    clearCookie() { return this; },
  };
  return googleLogin(req, res).then(() => res);
}

const profile = { sub: 'g-1', email: 'a@example.com', email_verified: true, name: 'A', picture: 'p' };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.GOOGLE_CLIENT_ID = 'our-app.apps.googleusercontent.com';
  mockState.user = {
    _id: 'u1', email: 'a@example.com', username: 'A', verified: true, googleAccount: true,
    passwordHash: 'x', authProvider: 'google', refreshTokens: [], roles: [], save: jest.fn(async () => {}),
  };
  axios.get.mockResolvedValue({ data: profile });
});

test('signs in with an access token issued to this app', async () => {
  mockGoogle.getTokenInfo.mockResolvedValue({ aud: 'our-app.apps.googleusercontent.com', sub: 'g-1' });
  const res = await run({ accessToken: 'tok' });
  expect(res.statusCode).toBe(200);
  expect(res.body.accessToken).toBeTruthy();
});

test('refuses an access token Google issued to another app', async () => {
  mockGoogle.getTokenInfo.mockResolvedValue({ aud: 'someone-else.apps.googleusercontent.com', sub: 'g-1' });
  const res = await run({ accessToken: 'tok' });
  expect(res.statusCode).toBe(401);
  expect(res.body.accessToken).toBeUndefined();
  expect(axios.get).not.toHaveBeenCalled();
  expect(userDocs.findByEmail).not.toHaveBeenCalled();
});

test('refuses an access token Google does not recognise', async () => {
  mockGoogle.getTokenInfo.mockRejectedValue(new Error('invalid_token'));
  const res = await run({ accessToken: 'tok' });
  expect(res.statusCode).toBe(401);
  expect(userDocs.findByEmail).not.toHaveBeenCalled();
});

test('refuses a Google account whose email is not verified', async () => {
  mockGoogle.getTokenInfo.mockResolvedValue({ aud: 'our-app.apps.googleusercontent.com', sub: 'g-1' });
  axios.get.mockResolvedValue({ data: { ...profile, email_verified: false } });
  const res = await run({ accessToken: 'tok' });
  expect(res.statusCode).toBe(401);
  expect(userDocs.findByEmail).not.toHaveBeenCalled();
});

test('refuses an ID token for another app', async () => {
  mockGoogle.verifyIdToken.mockRejectedValue(new Error('Wrong recipient, payload audience != requiredAudience'));
  const res = await run({ credential: 'id-token' });
  expect(res.statusCode).toBe(401);
  expect(mockGoogle.verifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: 'our-app.apps.googleusercontent.com' });
});

test('says Google sign-in is off when the server has no client id', async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  const res = await run({ accessToken: 'tok' });
  expect(res.statusCode).toBe(503);
  expect(mockGoogle.getTokenInfo).not.toHaveBeenCalled();
});
