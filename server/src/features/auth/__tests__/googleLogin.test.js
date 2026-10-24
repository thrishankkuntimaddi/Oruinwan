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
  userDocs: { findByEmail: jest.fn(async () => mockState.user), findForGoogle: jest.fn(async () => mockState.user), create: jest.fn(async (d) => ({ _id: 'new1', ...d, refreshTokens: [], roles: [], save: jest.fn(async () => {}) })) },
  emailTaken: jest.fn(async () => false), companyByAllowedEmail: jest.fn(async () => null), companyForAutoJoin: jest.fn(async () => null), invites: {},
}));
jest.mock('../../../identity', () => ({ companies: { findByDomain: jest.fn(async () => null), findById: jest.fn(async () => null) }, users: { findByUsername: jest.fn(async () => null) } }));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const axios = require('axios');
const { userDocs } = require('../../../identity/queries/auth');
const { googleLogin, googleSignup, exchangeDesktopGoogleCode } = require('../auth.controller');

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
  expect(mockGoogle.verifyIdToken).toHaveBeenCalledWith({ idToken: 'id-token', audience: ['our-app.apps.googleusercontent.com'] });
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

describe('desktop app: Google code exchange and its ID tokens', () => {
  const VERIFIER = 'v'.repeat(64);
  const body = { code: 'c-1', codeVerifier: VERIFIER, redirectUri: 'http://127.0.0.1:53111/callback' };

  beforeEach(() => {
    process.env.GOOGLE_DESKTOP_CLIENT_ID = 'desktop.apps.googleusercontent.com';
    process.env.GOOGLE_DESKTOP_CLIENT_SECRET = 'desktop-secret';
  });
  afterEach(() => {
    delete process.env.GOOGLE_DESKTOP_CLIENT_ID;
    delete process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
  });

  test('swaps the code for an ID token with the secret the server holds', async () => {
    axios.post.mockResolvedValue({ data: { id_token: 'id-tok' } });
    const res = await run(body, exchangeDesktopGoogleCode);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ idToken: 'id-tok' });
    const [url, form] = axios.post.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const sent = new URLSearchParams(form);
    expect(sent.get('client_secret')).toBe('desktop-secret');
    expect(sent.get('code_verifier')).toBe(VERIFIER);
    expect(sent.get('redirect_uri')).toBe(body.redirectUri);
  });

  test('only accepts a return address on this computer', async () => {
    for (const redirectUri of ['https://evil.example/callback', 'http://localhost:5000/callback', 'http://127.0.0.1:5000/other']) {
      const res = await run({ ...body, redirectUri }, exchangeDesktopGoogleCode);
      expect(res.statusCode).toBe(400);
    }
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('says so when the server has no desktop client', async () => {
    delete process.env.GOOGLE_DESKTOP_CLIENT_SECRET;
    const res = await run(body, exchangeDesktopGoogleCode);
    expect(res.statusCode).toBe(503);
  });

  test('a code Google refuses signs nobody in', async () => {
    axios.post.mockRejectedValue(Object.assign(new Error('bad'), { response: { status: 400, data: { error: 'invalid_grant' } } }));
    const res = await run(body, exchangeDesktopGoogleCode);
    expect(res.statusCode).toBe(401);
    expect(res.body.idToken).toBeUndefined();
  });

  test('ID tokens may be for the web client or the desktop client, nothing else', async () => {
    mockGoogle.verifyIdToken.mockResolvedValue({ getPayload: () => profile });
    const res = await run({ credential: 'id-tok' });
    expect(res.statusCode).toBe(200);
    expect(mockGoogle.verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-tok',
      audience: ['our-app.apps.googleusercontent.com', 'desktop.apps.googleusercontent.com'],
    });
  });
});

describe('one person, one account: Google finds and links the existing account', () => {
  const { saveWithRetry } = require('../../../../utils/mongooseRetry');
  beforeEach(() => {
    mockGoogle.getTokenInfo.mockResolvedValue({ aud: 'our-app.apps.googleusercontent.com', sub: 'g-1' });
  });

  test('looks the account up by Google id and email, and links Google to an email+password account', async () => {
    mockState.user = { ...mockState.user, googleId: null, googleAccount: false, authProvider: 'local' };
    const res = await run({ accessToken: 'tok' });
    expect(res.statusCode).toBe(200);
    expect(userDocs.findForGoogle).toHaveBeenCalledWith({ googleId: 'g-1', email: 'a@example.com' });
    expect(mockState.user.googleId).toBe('g-1');
    expect(saveWithRetry).toHaveBeenCalled();
    expect(userDocs.create).not.toHaveBeenCalled();
  });

  test('an unverified account is verified by Google and its unproven password is replaced', async () => {
    mockState.user = { ...mockState.user, verified: false, passwordHash: 'typed-by-someone', authProvider: 'local', passwordSetAt: new Date() };
    const res = await run({ accessToken: 'tok' });
    expect(res.statusCode).toBe(200);
    expect(mockState.user.verified).toBe(true);
    expect(mockState.user.passwordHash).not.toBe('typed-by-someone');
    expect(mockState.user.passwordSetAt).toBeUndefined();
  });

  test('confirming sign-up when the account already exists signs in to it, never a second account', async () => {
    const existing = mockState.user;
    userDocs.findForGoogle.mockResolvedValueOnce(null); // first look: no account yet
    const { body } = await run({ accessToken: 'tok' });
    expect(body.needsSignup).toBe(true);
    // Meanwhile the account was made (another device, or a second tap on Create).
    userDocs.findForGoogle.mockResolvedValueOnce(existing);
    const res = await run({ signupToken: body.signupToken, username: 'Ada', dob: '1990-05-01' }, googleSignup);
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(userDocs.create).not.toHaveBeenCalled();
  });

  test('two submits at once: the loser signs in to the account the winner made', async () => {
    userDocs.findForGoogle.mockResolvedValueOnce(null);
    const { body } = await run({ accessToken: 'tok' });
    userDocs.findForGoogle.mockResolvedValueOnce(null);
    userDocs.create.mockRejectedValueOnce(Object.assign(new Error('duplicate key'), { code: '23505' }));
    userDocs.findForGoogle.mockResolvedValueOnce(mockState.user);
    const res = await run({ signupToken: body.signupToken, username: 'Ada', dob: '1990-05-01' }, googleSignup);
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
  });
});

describe('canonicalEmail: one Gmail mailbox, many spellings', () => {
  const { canonicalEmail } = jest.requireActual('../../../identity/queries/auth');
  test.each([
    ['John.Smith@gmail.com', 'johnsmith@gmail.com'],
    ['johnsmith+work@gmail.com', 'johnsmith@gmail.com'],
    [' j.o.h.n.smith@GoogleMail.com ', 'johnsmith@gmail.com'],
    ['First.Last@company.com', 'first.last@company.com'],
    ['a+b@outlook.com', 'a+b@outlook.com'],
  ])('%s → %s', (input, expected) => {
    expect(canonicalEmail(input)).toBe(expected);
  });
});
