'use strict';

// The device limit and two-step verification apply to every way of signing in, and refreshing a
// session never adds a device.
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
process.env.GOOGLE_CLIENT_ID = 'our-app.apps.googleusercontent.com';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const mockGoogle = { getTokenInfo: jest.fn(), verifyIdToken: jest.fn() };
const mockState = { user: null, refreshUser: null };

jest.mock('google-auth-library', () => ({ OAuth2Client: jest.fn(() => mockGoogle) }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../../../shared/redis', () => ({ getRedis: () => null }));
jest.mock('../../security/totp', () => ({ verifyUserTotp: jest.fn(async (secret, otp) => otp === '123456') }));
jest.mock('../../../identity/queries/auth', () => ({
  userDocs: {
    findByEmail: jest.fn(async () => mockState.user),
    findById: jest.fn(async () => mockState.user),
    create: jest.fn(async (d) => ({ _id: 'new1', ...d, refreshTokens: [], roles: [], save: jest.fn(async () => {}) })),
  },
  emailTaken: jest.fn(async () => false), companyByAllowedEmail: jest.fn(async () => null), companyForAutoJoin: jest.fn(async () => null), invites: {},
}));
jest.mock('../../../identity', () => ({
  companies: { findByDomain: jest.fn(async () => null), findById: jest.fn(async () => null) },
  users: {
    findByUsername: jest.fn(async () => null),
    findByRefreshTokenHash: jest.fn(async () => mockState.refreshUser),
    expireRefreshToken: jest.fn(async () => {}),
    addRefreshToken: jest.fn(async () => {}),
    pruneRefreshTokens: jest.fn(async () => {}),
    deleteRefreshToken: jest.fn(async () => {}),
  },
}));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const devices = require('../../devices/devices.service');
const auth = require('../auth.controller');
const { mockReq, mockRes } = require('./memStore');

const OVER = { over: true, limit: 4, devices: [1, 2, 3, 4].map((i) => ({ id: `dev-${i}-xxxxxxxx`, name: `Device ${i}`, platform: 'web', lastActiveAt: new Date(), location: null })) };

let checkSpy;
let recordSpy;
beforeEach(async () => {
  jest.clearAllMocks();
  mockState.user = {
    _id: 'u1', email: 'a@example.com', username: 'A', verified: true, googleAccount: true, authProvider: 'local',
    passwordHash: await bcrypt.hash('Passw0rd!', 4), refreshTokens: [], roles: [], twoFactorEnabled: false,
    failedLoginAttempts: 0, save: jest.fn(async () => {}),
  };
  checkSpy = jest.spyOn(devices, 'checkDeviceLimit').mockResolvedValue(OVER);
  recordSpy = jest.spyOn(devices, 'recordSignIn').mockResolvedValue(null);
  jest.spyOn(devices, 'activeDevices').mockResolvedValue([]);
  mockGoogle.getTokenInfo.mockResolvedValue({ aud: 'our-app.apps.googleusercontent.com', sub: 'g-1' });
  require('axios').get.mockResolvedValue({ data: { sub: 'g-1', email: 'a@example.com', email_verified: true } });
});

afterEach(() => jest.restoreAllMocks());

async function run(handler, body, headers = { 'x-device-id': 'fifth-device-01' }) {
  const res = mockRes();
  await handler(mockReq({ body, headers }), res);
  return res;
}

const expectLimited = (res) => {
  expect(res.statusCode).toBe(409);
  expect(res.body.code).toBe('DEVICE_LIMIT');
  expect(res.body.devices).toHaveLength(4);
  expect(res.body.pendingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(res.body.accessToken).toBeUndefined();
  expect(res.cookies.jwt).toBeUndefined();
  expect(recordSpy).not.toHaveBeenCalled();
};

test('password sign-in', async () => {
  expectLimited(await run(auth.login, { email: 'a@example.com', password: 'Passw0rd!' }));
  checkSpy.mockResolvedValue({ over: false, limit: 4, devices: [] });
  const ok = await run(auth.login, { email: 'a@example.com', password: 'Passw0rd!' });
  expect(ok.statusCode).toBe(200);
  expect(recordSpy).toHaveBeenCalledWith(expect.anything(), 'u1', { signIn: { method: 'password' } });
});

test('Google sign-in (web, desktop and Android all post here)', async () => {
  expectLimited(await run(auth.googleLogin, { accessToken: 'tok' }));
});

test('Google sign-up of a new account', async () => {
  const { userDocs } = require('../../../identity/queries/auth');
  userDocs.findByEmail.mockResolvedValueOnce(null);
  const start = await run(auth.googleLogin, { accessToken: 'tok' });
  expect(start.body.needsSignup).toBe(true);
  checkSpy.mockResolvedValue({ over: false, limit: 4, devices: [] });
  const done = await run(auth.googleSignup, { signupToken: start.body.signupToken, username: 'newbie', dob: '1990-01-01' });
  expect(done.statusCode).toBe(200);
  expect(checkSpy).toHaveBeenCalled();
});

test('Google sign-in with 2FA on asks for the second factor before anything else', async () => {
  mockState.user.twoFactorEnabled = true;
  mockState.user.twoFactorSecret = 'enc';
  const res = await run(auth.googleLogin, { accessToken: 'tok' });
  expect(res.statusCode).toBe(401);
  expect(res.body.code).toBe('MFA_REQUIRED');
  expect(res.body.methods).toEqual({ approve: false, totp: true, email: true });
  expect(res.body.accessToken).toBeUndefined();
});

test('SSO (browser and app): startSsoSession hands back the DEVICE_LIMIT answer instead of a session', async () => {
  const res = mockRes();
  const out = await auth.startSsoSession(mockReq({ headers: {} }), res, 'u1', { method: 'sso_okta', deviceId: 'browser-device-1' });
  expect(out.status).toBe(409);
  expect(out.pending.code).toBe('DEVICE_LIMIT');
  expect(out.accessToken).toBeUndefined();
  expect(res.cookies.jwt).toBeUndefined();
  expect(checkSpy).toHaveBeenCalledWith(expect.anything(), mockState.user, { deviceId: 'browser-device-1' });
});

test('refresh never creates a device', async () => {
  const token = jwt.sign({ sub: 'u1', jti: 'x' }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: '1d' });
  mockState.refreshUser = { _id: 'u1', roles: [], refreshToken: { expiresAt: new Date(Date.now() + 86400000), startedAt: new Date() } };
  jest.spyOn(devices, 'isRequestDeviceRevoked').mockResolvedValue(false);
  const touch = jest.spyOn(devices, 'touchDevice').mockResolvedValue(false);
  const res = mockRes();
  const req = mockReq({ body: { refreshToken: token }, headers: { 'x-device-id': 'never-seen-device', 'x-client-platform': 'android' } });
  await auth.refresh(req, res);
  expect(res.statusCode).toBe(200);
  expect(res.body.accessToken).toBeTruthy();
  expect(touch).toHaveBeenCalled();
  expect(recordSpy).not.toHaveBeenCalled();
});

test('signing out frees the device place', async () => {
  mockState.refreshUser = { _id: 'u1' };
  const out = jest.spyOn(devices, 'signOutDevice').mockResolvedValue(true);
  const res = mockRes();
  await auth.logout(mockReq({ body: { refreshToken: 'rt' }, headers: { 'x-device-id': 'device-1-xxxx', 'x-client-platform': 'ios' } }), res);
  expect(res.body.message).toBe('Logged out');
  expect(out).toHaveBeenCalledWith(expect.anything(), 'u1');
});
