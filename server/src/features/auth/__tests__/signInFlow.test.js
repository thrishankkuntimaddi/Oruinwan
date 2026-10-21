'use strict';

// Two-step verification (approve on another device / authenticator / email code) and the device
// limit, for every sign-in that goes through signInFlow.gate + /api/auth/signin/*.

jest.mock('../auth.controller', () => ({ signInGates: jest.fn(async () => null) }));

const realDevices = require('../../devices/devices.service');
const approvals = require('../approvals');
const flow = require('../signInFlow');
const { memStore, mockReq, mockRes } = require('./memStore');

const USER = 'u1';
const THIS_DEVICE = 'new-device-0001';

function setup({ twoFactor = false, deviceCount = 4, limit = 4 } = {}) {
  const store = memStore();
  const list = Array.from({ length: deviceCount }, (_, i) => ({
    deviceId: `dev-${i}-aaaaaaaa`, deviceName: `Device ${i}`, platform: 'web', lastActiveAt: new Date(i), location: null, revoked: false,
  }));
  const fakeDevices = {
    ...realDevices,
    activeDevices: jest.fn(async () => list.filter((d) => !d.revoked)),
    checkDeviceLimit: jest.fn(async (req, user, { deviceId } = {}) => {
      const id = realDevices.deviceIdFrom(req, deviceId);
      const act = list.filter((d) => !d.revoked);
      if (act.some((d) => d.deviceId === id)) return { over: false, limit, devices: [] };
      const over = act.length >= limit;
      return { over, limit, devices: over ? act.map((d) => ({ id: d.deviceId, name: d.deviceName, platform: d.platform, lastActiveAt: d.lastActiveAt, location: null })) : [] };
    }),
    revokeDevice: jest.fn(async (uid, id) => {
      const d = list.find((x) => x.deviceId === id);
      if (!d) throw new realDevices.DeviceError(404, 'Device session not found');
      const wasActive = !d.revoked;
      d.revoked = true;
      return { wasActive };
    }),
  };
  const aOv = { store, emit: jest.fn(), push: jest.fn(), now: () => store.clock.now };
  const fakeApprovals = {
    create: (x) => approvals.create(x, aOv),
    get: (id) => approvals.get(id, aOv),
    remove: (id) => approvals.remove(id, aOv),
  };
  const user = {
    _id: USER, email: 'alex@example.com', twoFactorEnabled: twoFactor, twoFactorSecret: twoFactor ? 'enc' : null,
    failedLoginAttempts: 0, save: jest.fn(async () => {}),
  };
  const finish = jest.fn((req, res, u, t) => res.json({ accessToken: 'session-for-' + u._id, signIn: t.signIn, kind: t.kind }));
  const sendEmail = jest.fn(async () => {});
  const overrides = {
    store, devices: fakeDevices, approvals: fakeApprovals, sendEmail,
    userDocs: { findById: jest.fn(async () => user) },
    verifyTotp: jest.fn(async (secret, otp) => secret === 'enc' && otp === '123456'),
    finishers: { password: finish, oauth: finish, sso: finish, qr: finish },
    audit: jest.fn(),
    now: () => store.clock.now,
  };
  const req = (body = {}, deviceId = THIS_DEVICE) => mockReq({ body, headers: deviceId ? { 'x-device-id': deviceId } : {} });
  const call = async (fn, body, deviceId) => {
    const res = mockRes();
    await fn(req(body, deviceId), res, overrides);
    return res;
  };
  return { store, list, user, overrides, finish, sendEmail, aOv, fakeDevices, req, call };
}

describe('device limit', () => {
  test('under the limit: the sign-in goes ahead', async () => {
    const s = setup({ deviceCount: 3 });
    expect(await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides)).toBeNull();
  });

  test('a device already signed in may sign in again', async () => {
    const s = setup({ deviceCount: 4 });
    expect(await flow.gate(s.req({}, 'dev-2-aaaaaaaa'), s.user, { kind: 'oauth', method: 'google' }, s.overrides)).toBeNull();
  });

  test('a 5th device gets DEVICE_LIMIT with the device list and a pending token, no session', async () => {
    const s = setup({ deviceCount: 4 });
    const stop = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    expect(stop.status).toBe(409);
    expect(stop.body.code).toBe('DEVICE_LIMIT');
    expect(stop.body.limit).toBe(4);
    expect(stop.body.devices).toHaveLength(4);
    expect(stop.body.devices[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String), platform: 'web' }));
    expect(stop.body.pendingToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stop.body.accessToken).toBeUndefined();
    // Only the hash of the token is stored.
    expect([...s.store.map.keys()].some((k) => k.includes(stop.body.pendingToken))).toBe(false);
  });

  test('signing out one device completes the sign-in; the pending token works once', async () => {
    const s = setup();
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    const res = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, signOutDeviceIds: ['dev-0-aaaaaaaa'] });
    expect(res.statusCode).toBe(200);
    expect(res.body.accessToken).toBe('session-for-u1');
    expect(s.fakeDevices.revokeDevice).toHaveBeenCalledWith(USER, 'dev-0-aaaaaaaa', {});
    const replay = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, signOutDeviceIds: ['dev-1-aaaaaaaa'] });
    expect(replay.statusCode).toBe(410);
    expect(s.finish).toHaveBeenCalledTimes(1);
  });

  test('"sign out everywhere and sign in here" signs every other device out', async () => {
    const s = setup();
    const { body } = await flow.gate(s.req(), s.user, { kind: 'oauth', method: 'google' }, s.overrides);
    const res = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, signOutAll: true });
    expect(res.statusCode).toBe(200);
    expect(s.list.every((d) => d.revoked)).toBe(true);
  });

  test('continuing without choosing a device keeps answering DEVICE_LIMIT with the same token', async () => {
    const s = setup();
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    const res = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken });
    expect(res.statusCode).toBe(409);
    expect(res.body.pendingToken).toBe(body.pendingToken);
    const status = await s.call(flow.status, { pendingToken: body.pendingToken });
    expect(status.body.stage).toBe('device_limit');
    expect(status.body.devices).toHaveLength(4);
  });

  test('the pending token is bound to the device that started and expires after 10 minutes', async () => {
    const s = setup();
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    const other = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, signOutAll: true }, 'someone-else-0001');
    expect(other.statusCode).toBe(403);
    s.store.clock.now += flow.TICKET_TTL_MS + 1;
    const late = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, signOutAll: true });
    expect(late.statusCode).toBe(410);
    expect(s.finish).not.toHaveBeenCalled();
  });

  test('malformed or unknown tokens are refused', async () => {
    const s = setup();
    expect((await s.call(flow.continueSignIn, { pendingToken: 'x' })).statusCode).toBe(410);
    expect((await s.call(flow.continueSignIn, { pendingToken: 'A'.repeat(43) })).statusCode).toBe(410);
  });
});

describe('two-step verification', () => {
  test('asks for a second factor and offers approval when another device is signed in', async () => {
    const s = setup({ twoFactor: true, deviceCount: 2 });
    const stop = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    expect(stop.status).toBe(401);
    expect(stop.body).toEqual(expect.objectContaining({ code: 'MFA_REQUIRED', requires2FA: true, methods: { approve: true, totp: true, email: true } }));
    expect(stop.body.emailHint).toBe('al••@example.com');
    expect(s.aOv.emit).toHaveBeenCalledWith(USER, 'auth:approval-request', expect.objectContaining({ kind: 'signin' }));
    expect(s.aOv.push).toHaveBeenCalledWith(USER, 'Sign-in request', expect.stringMatching(/^Sign-in request from .+ — Approve \/ Deny$/), expect.objectContaining({ type: 'signin_approval' }));
  });

  test('no other device: only codes are offered', async () => {
    const s = setup({ twoFactor: true, deviceCount: 0 });
    const stop = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    expect(stop.body.methods).toEqual({ approve: false, totp: true, email: true });
    expect(stop.body.approvalId).toBeNull();
  });

  test('approval on another device completes it and records which device approved', async () => {
    const s = setup({ twoFactor: true, deviceCount: 2 });
    const { body } = await flow.gate(s.req(), s.user, { kind: 'oauth', method: 'google' }, s.overrides);
    const waiting = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken });
    expect(waiting.statusCode).toBe(401);
    expect(waiting.body.waiting).toBe(true);
    expect((await s.call(flow.status, { pendingToken: body.pendingToken })).body.approval.status).toBe('pending');

    await approvals.decide(body.approvalId, { userId: USER, deviceId: 'dev-0-aaaaaaaa', deviceName: 'iPhone' }, true, s.aOv);
    expect((await s.call(flow.status, { pendingToken: body.pendingToken })).body.approval.status).toBe('approved');
    const done = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken });
    expect(done.statusCode).toBe(200);
    expect(done.body.signIn.approvedBy).toEqual({ deviceId: 'dev-0-aaaaaaaa', deviceName: 'iPhone' });
    expect(s.overrides.audit).toHaveBeenCalledWith(USER, 'SIGNIN_SECOND_FACTOR', expect.anything(), expect.objectContaining({ method: 'approval', approvedByDeviceId: 'dev-0-aaaaaaaa' }));
  });

  test('a denied request ends the sign-in', async () => {
    const s = setup({ twoFactor: true, deviceCount: 2 });
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    await approvals.decide(body.approvalId, { userId: USER, deviceId: 'dev-1-aaaaaaaa' }, false, s.aOv);
    const res = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('SIGNIN_DENIED');
    expect((await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, otp: '123456' })).statusCode).toBe(410);
  });

  test('the requesting device cannot approve itself and others cannot answer twice', async () => {
    const s = setup({ twoFactor: true, deviceCount: 2 });
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    await expect(approvals.decide(body.approvalId, { userId: USER, deviceId: THIS_DEVICE }, true, s.aOv)).rejects.toMatchObject({ status: 403 });
    await expect(approvals.decide(body.approvalId, { userId: 'someone', deviceId: 'x' }, true, s.aOv)).rejects.toMatchObject({ status: 404 });
    await approvals.decide(body.approvalId, { userId: USER, deviceId: 'dev-0-aaaaaaaa' }, true, s.aOv);
    await expect(approvals.decide(body.approvalId, { userId: USER, deviceId: 'dev-1-aaaaaaaa' }, false, s.aOv)).rejects.toMatchObject({ status: 409 });
  });

  test('the authenticator code completes it; wrong codes count as failed attempts', async () => {
    const s = setup({ twoFactor: true, deviceCount: 1 });
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    const wrong = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, otp: '000000' });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.body.invalidCode).toBe(true);
    expect(s.user.failedLoginAttempts).toBe(1);
    const ok = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, otp: '123 456' });
    expect(ok.statusCode).toBe(200);
  });

  test('older clients can still send the code with the password in one step', async () => {
    const s = setup({ twoFactor: true, deviceCount: 1 });
    expect(await flow.gate(s.req(), s.user, { kind: 'password', method: 'password', otp: '123456' }, s.overrides)).toBeNull();
    const bad = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password', otp: '111111' }, s.overrides);
    expect(bad.status).toBe(401);
    expect(bad.body.invalidCode).toBe(true);
  });

  test('email code: 6 digits, works once, expires after 10 minutes, sends are limited', async () => {
    const s = setup({ twoFactor: true, deviceCount: 0 });
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    const sent = await s.call(flow.sendEmailCode, { pendingToken: body.pendingToken });
    expect(sent.statusCode).toBe(200);
    expect(s.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'alex@example.com' }));
    const code = s.sendEmail.mock.calls[0][0].subject.match(/^(\d{6}) /)[1];

    const wrong = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, emailCode: code === '000000' ? '111111' : '000000' });
    expect(wrong.statusCode).toBe(401);
    const ok = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, emailCode: code });
    expect(ok.statusCode).toBe(200);
    expect(s.overrides.audit).toHaveBeenCalledWith(USER, 'SIGNIN_SECOND_FACTOR', expect.anything(), expect.objectContaining({ method: 'email' }));
  });

  test('an expired email code is refused', async () => {
    const s = setup({ twoFactor: true, deviceCount: 0 });
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    await s.call(flow.sendEmailCode, { pendingToken: body.pendingToken });
    const code = s.sendEmail.mock.calls[0][0].subject.slice(0, 6);
    s.store.clock.now += flow.EMAIL_CODE_TTL_MS + 1;
    // The ticket itself expired too (same 10 minutes).
    expect((await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, emailCode: code })).statusCode).toBe(410);
  });

  test('at most 3 email codes per sign-in', async () => {
    const s = setup({ twoFactor: true, deviceCount: 0 });
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    for (let i = 0; i < 3; i += 1) expect((await s.call(flow.sendEmailCode, { pendingToken: body.pendingToken })).statusCode).toBe(200);
    expect((await s.call(flow.sendEmailCode, { pendingToken: body.pendingToken })).statusCode).toBe(429);
  });

  test('too many wrong codes end the sign-in', async () => {
    const s = setup({ twoFactor: true, deviceCount: 0 });
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    let res;
    for (let i = 0; i < 10; i += 1) res = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, otp: '999999' });
    expect(res.statusCode).toBe(429);
    expect((await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, otp: '123456' })).statusCode).toBe(410);
  });

  test('second factor first, then the device limit, with the same token', async () => {
    const s = setup({ twoFactor: true, deviceCount: 4 });
    const { body } = await flow.gate(s.req(), s.user, { kind: 'password', method: 'password' }, s.overrides);
    expect(body.code).toBe('MFA_REQUIRED');
    const next = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, otp: '123456' });
    expect(next.statusCode).toBe(409);
    expect(next.body.code).toBe('DEVICE_LIMIT');
    const done = await s.call(flow.continueSignIn, { pendingToken: body.pendingToken, signOutDeviceIds: ['dev-3-aaaaaaaa'] });
    expect(done.statusCode).toBe(200);
  });

  test('passkey, SSO and QR sign-ins already count as the second factor', async () => {
    const s = setup({ twoFactor: true, deviceCount: 1 });
    for (const by of ['passkey', 'sso', 'qr']) {
      expect(await flow.gate(s.req(), s.user, { kind: 'oauth', method: by, mfaSatisfiedBy: by }, s.overrides)).toBeNull();
    }
  });
});
