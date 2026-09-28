'use strict';

// Password login must ask for the authenticator code when 2FA is on.
// (otplib ships ESM that jest can't load, so the TOTP check is stubbed: '123456' is the valid code.)
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';
const bcrypt = require('bcryptjs');

const mockState = { user: null, secret: 'enc-secret' };

jest.mock('../../security/totp', () => ({
  verifyUserTotp: jest.fn(async (secret, otp) => secret === 'enc-secret' && otp === '123456'),
}));

jest.mock('../../../../models/User', () => ({
  findOne: jest.fn(() => ({ select: () => ({ populate: async () => mockState.user }) })),
  findById: jest.fn(() => ({ select: () => ({ lean: async () => ({ twoFactorSecret: mockState.secret }) }) })),
}));
jest.mock('../../../../models/Company', () => ({ findOne: jest.fn(async () => null) }));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const { login } = require('../auth.controller');

let hash;

function run(body) {
  const req = { body, headers: {}, get: () => 'jest', ip: '127.0.0.1', cookies: {}, socket: {} };
  const res = {
    statusCode: 200, body: null, cookies: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    cookie(n, v) { this.cookies[n] = v; return this; },
    clearCookie() { return this; },
  };
  return login(req, res).then(() => res);
}

beforeAll(async () => {
  hash = await bcrypt.hash('Passw0rd!', 4);
});

beforeEach(() => {
  mockState.user = {
    _id: 'u1', email: 'a@example.com', username: 'A', passwordHash: hash, verified: true,
    authProvider: 'local', twoFactorEnabled: true, refreshTokens: [], roles: [],
    failedLoginAttempts: 0, save: jest.fn(async () => {}),
  };
});

test('asks for the code when 2FA is on and no code is sent', async () => {
  const res = await run({ email: 'a@example.com', password: 'Passw0rd!' });
  expect(res.statusCode).toBe(401);
  expect(res.body.requires2FA).toBe(true);
  expect(res.body.accessToken).toBeUndefined();
});

test('rejects a wrong code and counts it as a failed attempt', async () => {
  const res = await run({ email: 'a@example.com', password: 'Passw0rd!', otp: '000000' });
  expect(res.statusCode).toBe(401);
  expect(res.body.invalidCode).toBe(true);
  expect(mockState.user.failedLoginAttempts).toBe(1);
});

test('signs in with the right code', async () => {
  const res = await run({ email: 'a@example.com', password: 'Passw0rd!', otp: '123 456' });
  expect(res.statusCode).toBe(200);
  expect(res.body.accessToken).toBeTruthy();
});

test('wrong password never reveals that 2FA is on', async () => {
  const res = await run({ email: 'a@example.com', password: 'nope' });
  expect(res.statusCode).toBe(400);
  expect(res.body.requires2FA).toBeUndefined();
});
