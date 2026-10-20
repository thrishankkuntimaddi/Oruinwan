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
  userDocs: { findByEmail: jest.fn(async () => mockState.user), create: jest.fn(async (d) => ({ _id: 'new1', ...d, refreshTokens: [], roles: [], save: jest.fn(async () => {}) })) },
  emailTaken: jest.fn(async () => false), companyByAllowedEmail: jest.fn(async () => null), companyForAutoJoin: jest.fn(async () => null), invites: {},
}));
jest.mock('../../../identity', () => ({ companies: { findByDomain: jest.fn(async () => null), findById: jest.fn(async () => null) }, users: { findByUsername: jest.fn(async () => null) } }));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const axios = require('axios');
const { userDocs } = require('../../../identity/queries/auth');
const { googleLogin, googleSignup } = require('../auth.controller');

function run(body, handler = googleLogin) {
  const req = { body, headers: {}, get: () => 'jest', ip: '127.0.0.1', cookies: {}, socket: {} };
  const res = {
    statusCode: 200, body: null, cookies: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    cookie(n, v) { this.cookies[n] = v; return this; },
    clearCookie() { return this; },
  };
  return handler(req, res).then(() => res);
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

describe('Continue with Google without an account', () => {
  beforeEach(() => {
    mockState.user = null;
    mockGoogle.getTokenInfo.mockResolvedValue({ aud: 'our-app.apps.googleusercontent.com', sub: 'g-1' });
  });

  test('does not create an account; asks the app to confirm sign-up', async () => {
    const res = await run({ accessToken: 'tok' });
    expect(res.statusCode).toBe(200);
    expect(res.body.needsSignup).toBe(true);
    expect(res.body.signupToken).toBeTruthy();
    expect(res.body.email).toBe('a@example.com');
    expect(res.body.accessToken).toBeUndefined();
    expect(userDocs.create).not.toHaveBeenCalled();
  });

  test('creates the account once confirmed with a username and date of birth', async () => {
    const { body } = await run({ accessToken: 'tok' });
    const res = await run({ signupToken: body.signupToken, username: 'Ada', dob: '1990-05-01' }, googleSignup);
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.isFirstLogin).toBe(true);
    expect(userDocs.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'a@example.com', username: 'Ada', googleId: 'g-1', verified: true,
    }));
    // The ticket works once.
    const again = await run({ signupToken: body.signupToken, username: 'Ada', dob: '1990-05-01' }, googleSignup);
    expect(again.statusCode).toBe(400);
  });

  test('refuses sign-up without a date of birth', async () => {
    const { body } = await run({ accessToken: 'tok' });
    const res = await run({ signupToken: body.signupToken, username: 'Ada' }, googleSignup);
    expect(res.statusCode).toBe(400);
    expect(userDocs.create).not.toHaveBeenCalled();
  });

  test('refuses an unknown sign-up ticket', async () => {
    const res = await run({ signupToken: 'x'.repeat(40), username: 'Ada', dob: '1990-05-01' }, googleSignup);
    expect(res.statusCode).toBe(400);
    expect(userDocs.create).not.toHaveBeenCalled();
  });
});

describe('Google sign-up joins the company that verified the email domain', () => {
  test('a new account on an auto-join domain becomes a company member', async () => {
    mockState.user = null;
    mockGoogle.getTokenInfo.mockResolvedValue({ aud: 'our-app.apps.googleusercontent.com', sub: 'g-1' });
    const { companyForAutoJoin } = require('../../../identity/queries/auth');
    companyForAutoJoin.mockResolvedValueOnce({ _id: 'co1', invitePolicy: { defaultRole: 'member' }, defaultWorkspace: null });
    const { body } = await run({ accessToken: 'tok' });
    const res = await run({ signupToken: body.signupToken, username: 'Ada', dob: '1990-05-01' }, googleSignup);
    expect(res.statusCode).toBe(200);
    expect(companyForAutoJoin).toHaveBeenCalledWith('example.com');
    expect(userDocs.create).toHaveBeenCalledWith(expect.objectContaining({ userType: 'company', companyId: 'co1', companyRole: 'member' }));
  });
});
