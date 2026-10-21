'use strict';

// Passkey registration and sign-in. The WebAuthn verification itself is simplewebauthn's job
// (mocked here); these tests cover what this server decides around it: challenges are single
// use and expire, unknown credentials are refused, and sign-in passes the same gates as any other.
process.env.ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';

const mockState = { user: null, passkeys: [] };

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(async () => ({ challenge: 'reg-challenge', rp: { id: 'localhost' } })),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(async () => ({ challenge: 'auth-challenge' })),
  verifyAuthenticationResponse: jest.fn(),
}));
jest.mock('../passkeys.repo', () => ({
  listForUser: jest.fn(async (userId) => mockState.passkeys.filter((p) => p.userId === String(userId))),
  findByCredentialId: jest.fn(async (id) => mockState.passkeys.find((p) => p.credentialId === id) || null),
  create: jest.fn(async (p) => {
    if (mockState.passkeys.some((x) => x.credentialId === p.credentialId)) return null;
    const row = { id: `pk${mockState.passkeys.length + 1}`, createdAt: new Date(), lastUsedAt: null, ...p };
    mockState.passkeys.push(row);
    return row;
  }),
  markUsed: jest.fn(async () => {}),
  rename: jest.fn(),
  remove: jest.fn(),
}));
jest.mock('../../../identity/queries/auth', () => ({
  userDocs: {
    findById: jest.fn(async (id) => (mockState.user && String(id) === String(mockState.user._id) ? mockState.user : null)),
    findByEmail: jest.fn(async (email) => (mockState.user && email === mockState.user.email ? mockState.user : null)),
  },
  emailTaken: jest.fn(), companyByAllowedEmail: jest.fn(), companyForAutoJoin: jest.fn(), invites: {},
}));
jest.mock('../../../identity', () => ({ companies: { findByDomain: jest.fn(async () => null), findById: jest.fn(async () => null) }, users: {} }));
jest.mock('../../../../utils/mongooseRetry', () => ({ saveWithRetry: jest.fn(async () => {}) }));
jest.mock('../../../../utils/sendEmail', () => jest.fn());
jest.mock('../../../../models/AuditLog', () => ({ create: jest.fn().mockResolvedValue({}) }));

const webauthn = require('@simplewebauthn/server');
const repo = require('../passkeys.repo');
const { handlers } = require('../passkeys');

function run(handler, { body = {}, user = null, params = {} } = {}) {
  const req = { body, params, user, headers: {}, get: () => 'jest', ip: '127.0.0.1', cookies: {}, socket: {} };
  const res = {
    statusCode: 200, body: null, cookies: {},
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    cookie(n, v) { this.cookies[n] = v; return this; },
    clearCookie() { return this; },
  };
  return handler(req, res).then(() => res);
}

const clientData = (challenge) => Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge })).toString('base64url');
const assertion = (credentialId, challenge = 'auth-challenge') => ({
  id: credentialId, rawId: credentialId, type: 'public-key',
  response: { clientDataJSON: clientData(challenge), authenticatorData: 'x', signature: 'y' },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockState.user = {
    _id: 'u1', email: 'a@example.com', username: 'Ada', verified: true, accountStatus: 'active',
    passwordHash: 'x', twoFactorEnabled: false, refreshTokens: [], roles: [], save: jest.fn(async () => {}),
  };
  mockState.passkeys = [];
  webauthn.verifyRegistrationResponse.mockResolvedValue({
    verified: true,
    registrationInfo: {
      credential: { id: 'cred-1', publicKey: new Uint8Array([1, 2, 3]), counter: 0, transports: ['internal'] },
      credentialBackedUp: true,
    },
  });
  webauthn.verifyAuthenticationResponse.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 5 } });
});

async function register(name = 'MacBook') {
  const opts = await run(handlers.registerOptions, { user: { sub: 'u1' } });
  expect(opts.statusCode).toBe(200);
  return run(handlers.registerVerify, { user: { sub: 'u1' }, body: { response: { id: 'cred-1', response: {} }, name } });
}

describe('registration', () => {
  test('stores the credential for the signed-in user', async () => {
    const res = await register();
    expect(res.statusCode).toBe(201);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', credentialId: 'cred-1', counter: 0, transports: ['internal'], name: 'MacBook', backedUp: true,
    }));
    expect(res.body.passkey).toEqual(expect.objectContaining({ id: 'pk1', name: 'MacBook', backedUp: true }));
    expect(res.body.passkey.publicKey).toBeUndefined();
    expect(webauthn.verifyRegistrationResponse).toHaveBeenCalledWith(expect.objectContaining({
      expectedChallenge: 'reg-challenge', expectedRPID: 'localhost', requireUserVerification: true,
    }));
  });

  test('the registration challenge works once', async () => {
    await register();
    const again = await run(handlers.registerVerify, { user: { sub: 'u1' }, body: { response: { id: 'cred-1', response: {} } } });
    expect(again.statusCode).toBe(400);
    expect(repo.create).toHaveBeenCalledTimes(1);
  });

  test('lists passkeys without key material', async () => {
    await register();
    const res = await run(handlers.list, { user: { sub: 'u1' } });
    expect(res.body.passkeys).toHaveLength(1);
    expect(Object.keys(res.body.passkeys[0])).not.toContain('publicKey');
    expect(Object.keys(res.body.passkeys[0])).not.toContain('credentialId');
  });
});

describe('sign-in', () => {
  async function signIn(credentialId = 'cred-1', { getOptions = true, challenge } = {}) {
    if (getOptions) {
      const opts = await run(handlers.loginOptions, { body: {} });
      expect(opts.statusCode).toBe(200);
    }
    return run(handlers.loginVerify, { body: { response: assertion(credentialId, challenge) } });
  }

  test('a known passkey issues a session and updates the counter', async () => {
    await register();
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.cookies.jwt).toBeTruthy();
    expect(repo.markUsed).toHaveBeenCalledWith('pk1', 5);
    expect(webauthn.verifyAuthenticationResponse).toHaveBeenCalledWith(expect.objectContaining({
      expectedChallenge: 'auth-challenge',
      credential: expect.objectContaining({ id: 'cred-1', counter: 0 }),
      requireUserVerification: true,
    }));
  });

  test('the device limit applies to passkey sign-in too', async () => {
    await register();
    const devices = require('../../devices/devices.service');
    const spy = jest.spyOn(devices, 'checkDeviceLimit').mockResolvedValue({ over: true, limit: 4, devices: [] });
    const res = await signIn();
    spy.mockRestore();
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('DEVICE_LIMIT');
    expect(res.body.accessToken).toBeUndefined();
  });

  test('an unknown credential is refused', async () => {
    const res = await signIn('nobody');
    expect(res.statusCode).toBe(401);
    expect(res.body.accessToken).toBeUndefined();
    expect(webauthn.verifyAuthenticationResponse).not.toHaveBeenCalled();
  });

  test('a replayed challenge is refused', async () => {
    await register();
    expect((await signIn()).statusCode).toBe(200);
    const replay = await signIn('cred-1', { getOptions: false });
    expect(replay.statusCode).toBe(400);
    expect(replay.body.accessToken).toBeUndefined();
  });

  test('a challenge the server never issued is refused', async () => {
    await register();
    const res = await signIn('cred-1', { getOptions: false, challenge: 'made-up' });
    expect(res.statusCode).toBe(400);
  });

  test('an expired challenge is refused', async () => {
    await register();
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await run(handlers.loginOptions, { body: {} });
      jest.setSystemTime(Date.now() + 5 * 60 * 1000 + 1);
      const res = await signIn('cred-1', { getOptions: false });
      expect(res.statusCode).toBe(400);
    } finally {
      jest.useRealTimers();
    }
  });

  test('a failed signature is refused', async () => {
    await register();
    webauthn.verifyAuthenticationResponse.mockRejectedValue(new Error('Signature invalid'));
    const res = await signIn();
    expect(res.statusCode).toBe(401);
    expect(repo.markUsed).not.toHaveBeenCalled();
  });

  test('a suspended user cannot sign in', async () => {
    await register();
    mockState.user.accountStatus = 'suspended';
    const res = await signIn();
    expect(res.statusCode).toBe(403);
    expect(res.body.accessToken).toBeUndefined();
  });

  test('does not ask for the authenticator code: the passkey is already two factors', async () => {
    await register();
    mockState.user.twoFactorEnabled = true;
    mockState.user.twoFactorSecret = 'enc';
    const res = await signIn();
    expect(res.statusCode).toBe(200);
    expect(res.body.requires2FA).toBeUndefined();
  });

  test('with an email, names that account\'s passkeys', async () => {
    await register();
    await run(handlers.loginOptions, { body: { email: 'a@example.com' } });
    expect(webauthn.generateAuthenticationOptions).toHaveBeenLastCalledWith(expect.objectContaining({
      allowCredentials: [{ id: 'cred-1', transports: ['internal'] }],
    }));
    await run(handlers.loginOptions, { body: { email: 'who@example.com' } });
    expect(webauthn.generateAuthenticationOptions.mock.calls.at(-1)[0].allowCredentials).toBeUndefined();
  });
});
