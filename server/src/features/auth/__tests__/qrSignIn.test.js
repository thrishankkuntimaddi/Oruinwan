'use strict';

// QR sign-in both ways: the login screen shows a code a signed-in phone approves ("show"), and a
// signed-in computer shows a code the phone app scans from its start screen ("offer").

const crypto = require('crypto');

jest.mock('../auth.controller', () => ({ signInGates: jest.fn(async () => null), issueSignInSession: jest.fn() }));
const mockCrypto = { state: null };
jest.mock('../../../identity', () => ({ cryptoState: { findByUserId: jest.fn(async () => mockCrypto.state) } }));
jest.mock('../../crypto/umekEnvelope', () => {
  const actual = jest.requireActual('../../crypto/umekEnvelope');
  return { ...actual, openUmek: jest.fn(() => Buffer.alloc(32, 7)) };
});

const qr = require('../qrSignIn');
const { memStore, mockReq, mockRes } = require('./memStore');

const ME = 'u1';
const COMPUTER = 'computer-device-01';
const PHONE = 'phone-device-0001';

function ephemeral() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { ecdh, publicKey: ecdh.getPublicKey().toString('base64') };
}

function setup({ gate = async () => null } = {}) {
  const store = memStore();
  const finish = jest.fn((req, res, user, t) => res.json({ accessToken: 'session', signIn: t.signIn, publicKey: t.extras.publicKey }));
  const overrides = {
    store, now: () => store.clock.now, emit: jest.fn(), audit: jest.fn(), qrImage: async () => 'data:image/png;base64,AAA',
    gate: jest.fn(gate), userDocs: { findById: jest.fn(async (id) => ({ _id: id })) }, finish,
  };
  const as = (deviceId, user = null, body = {}) => mockReq({ body, headers: { 'x-device-id': deviceId }, user: user ? { sub: user } : null });
  const poll = async (deviceId, body) => {
    const res = mockRes();
    await qr.poll(as(deviceId, null, body), res, overrides);
    return res;
  };
  return { store, overrides, finish, as, poll };
}

describe('show: the login screen shows the QR, a signed-in phone approves', () => {
  test('scan → approve → the computer gets a session once', async () => {
    const s = setup();
    const key = ephemeral();
    const shown = await qr.request(s.as(COMPUTER, null, { publicKey: key.publicKey }), s.overrides);
    expect(shown.qrText).toBe(`oruinwan://signin?c=${shown.code}`);
    expect(shown.qrText).not.toContain(shown.secret);
    expect(shown.qrDataUrl).toMatch(/^data:image\/png/);

    expect((await s.poll(COMPUTER, { code: shown.code, secret: shown.secret })).body.status).toBe('waiting');

    const scanned = await qr.scan(s.as(PHONE, ME, { code: shown.code }), s.overrides);
    expect(scanned.requester.deviceName).toMatch(/Chrome/);
    expect((await s.poll(COMPUTER, { code: shown.code, secret: shown.secret })).body.status).toBe('scanned');

    await qr.decide(s.as(PHONE, ME, { code: shown.code, approve: true }), s.overrides);
    const done = await s.poll(COMPUTER, { code: shown.code, secret: shown.secret });
    expect(done.statusCode).toBe(200);
    expect(done.body.accessToken).toBe('session');
    expect(done.body.publicKey).toBe(key.publicKey);
    expect(done.body.signIn).toEqual({ method: 'qr', approvedBy: expect.objectContaining({ deviceId: PHONE }) });
    // The approval is the second factor; the device limit still runs.
    expect(s.overrides.gate).toHaveBeenCalledWith(expect.anything(), { _id: ME }, expect.objectContaining({ mfaSatisfiedBy: 'qr' }));
    expect(s.overrides.audit).toHaveBeenCalledWith(ME, 'QR_SIGNIN_APPROVED', expect.anything(), expect.objectContaining({ approverDeviceId: PHONE }));

    const replay = await s.poll(COMPUTER, { code: shown.code, secret: shown.secret });
    expect(replay.statusCode).toBe(410);
    expect(s.finish).toHaveBeenCalledTimes(1);
  });

  test('seeing the QR is not enough: the secret and the device must match', async () => {
    const s = setup();
    const shown = await qr.request(s.as(COMPUTER, null, { publicKey: ephemeral().publicKey }), s.overrides);
    await qr.scan(s.as(PHONE, ME, { code: shown.code }), s.overrides);
    await qr.decide(s.as(PHONE, ME, { code: shown.code, approve: true }), s.overrides);
    expect((await s.poll(PHONE, { code: shown.code, secret: crypto.randomBytes(32).toString('base64url') })).statusCode).toBe(403);
    expect((await s.poll('attacker-device-1', { code: shown.code, secret: shown.secret })).statusCode).toBe(403);
    expect(s.finish).not.toHaveBeenCalled();
  });

  test('codes expire after 60 s unscanned', async () => {
    const s = setup();
    const shown = await qr.request(s.as(COMPUTER, null, { publicKey: ephemeral().publicKey }), s.overrides);
    s.store.clock.now += qr.WAIT_TTL_MS + 1;
    await expect(qr.scan(s.as(PHONE, ME, { code: shown.code }), s.overrides)).rejects.toMatchObject({ status: 410 });
    expect((await s.poll(COMPUTER, { code: shown.code, secret: shown.secret })).statusCode).toBe(410);
  });

  test('a code can be scanned by one account only, and only that account decides', async () => {
    const s = setup();
    const shown = await qr.request(s.as(COMPUTER, null, { publicKey: ephemeral().publicKey }), s.overrides);
    await qr.scan(s.as(PHONE, ME, { code: shown.code }), s.overrides);
    await expect(qr.scan(s.as('other-phone-01', 'u2', { code: shown.code }), s.overrides)).rejects.toMatchObject({ status: 409 });
    await expect(qr.decide(s.as('other-phone-01', 'u2', { code: shown.code, approve: true }), s.overrides)).rejects.toMatchObject({ status: 409 });
  });

  test('declined on the phone: the computer is told and the code is gone', async () => {
    const s = setup();
    const shown = await qr.request(s.as(COMPUTER, null, { publicKey: ephemeral().publicKey }), s.overrides);
    await qr.scan(s.as(PHONE, ME, { code: shown.code }), s.overrides);
    await qr.decide(s.as(PHONE, ME, { code: shown.code, approve: false }), s.overrides);
    const res = await s.poll(COMPUTER, { code: shown.code, secret: shown.secret });
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('QR_DENIED');
    expect((await s.poll(COMPUTER, { code: shown.code, secret: shown.secret })).statusCode).toBe(410);
  });

  test('the device limit applies: over it the computer gets DEVICE_LIMIT instead of a session', async () => {
    const s = setup({ gate: async () => ({ status: 409, body: { code: 'DEVICE_LIMIT', pendingToken: 't' } }) });
    const shown = await qr.request(s.as(COMPUTER, null, { publicKey: ephemeral().publicKey }), s.overrides);
    await qr.scan(s.as(PHONE, ME, { code: shown.code }), s.overrides);
    await qr.decide(s.as(PHONE, ME, { code: shown.code, approve: true }), s.overrides);
    const res = await s.poll(COMPUTER, { code: shown.code, secret: shown.secret });
    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('DEVICE_LIMIT');
    expect(s.finish).not.toHaveBeenCalled();
  });

  test('a phone scanning a "show" code with the start-screen scanner is pointed the other way', async () => {
    const s = setup();
    const shown = await qr.request(s.as(COMPUTER, null, { publicKey: ephemeral().publicKey }), s.overrides);
    await expect(qr.claim(s.as(PHONE, null, { code: shown.code, publicKey: ephemeral().publicKey }), s.overrides)).rejects.toMatchObject({ status: 400, code: 'QR_WRONG_SIDE' });
  });

  test('only real P-256 public keys are accepted', async () => {
    const s = setup();
    await expect(qr.request(s.as(COMPUTER, null, { publicKey: 'abc' }), s.overrides)).rejects.toMatchObject({ status: 400 });
    const notOnCurve = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64');
    await expect(qr.request(s.as(COMPUTER, null, { publicKey: notOnCurve }), s.overrides)).rejects.toMatchObject({ status: 400 });
  });

  test('QR codes are rate limited per IP', async () => {
    const s = setup();
    const pk = ephemeral().publicKey;
    for (let i = 0; i < 40; i += 1) await qr.request(s.as(COMPUTER, null, { publicKey: pk }), s.overrides);
    await expect(qr.request(s.as(COMPUTER, null, { publicKey: pk }), s.overrides)).rejects.toMatchObject({ status: 429 });
  });
});

describe('offer: a signed-in computer shows the QR, the phone app scans it from its start screen', () => {
  test('claim → computer allows → the phone gets a session once', async () => {
    const s = setup();
    const offered = await qr.offer(s.as(COMPUTER, ME), s.overrides);
    expect(offered.qrText).toBe(`oruinwan://signin?c=${offered.code}`);
    expect((await qr.offerStatus(s.as(COMPUTER, ME, { code: offered.code }), s.overrides)).status).toBe('waiting');

    const key = ephemeral();
    const claimed = await qr.claim(s.as(PHONE, null, { code: offered.code, publicKey: key.publicKey }), s.overrides);
    expect(claimed.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(s.overrides.emit).toHaveBeenCalledWith(ME, 'auth:qr-claimed', expect.objectContaining({ code: offered.code }));

    const st = await qr.offerStatus(s.as(COMPUTER, ME, { code: offered.code }), s.overrides);
    expect(st.status).toBe('claimed');
    expect(st.requester).toEqual(expect.objectContaining({ deviceName: expect.any(String) }));
    // Someone else's account sees nothing.
    expect((await qr.offerStatus(s.as('x-device-0001', 'u2', { code: offered.code }), s.overrides)).status).toBe('expired');

    expect((await s.poll(PHONE, { code: offered.code, secret: claimed.secret })).body.status).toBe('claimed');
    await qr.decide(s.as(COMPUTER, ME, { code: offered.code, approve: true }), s.overrides);
    const done = await s.poll(PHONE, { code: offered.code, secret: claimed.secret });
    expect(done.body.accessToken).toBe('session');
    expect(done.body.publicKey).toBe(key.publicKey);
    expect((await s.poll(PHONE, { code: offered.code, secret: claimed.secret })).statusCode).toBe(410);
  });

  test('a code is claimed once; a second phone is refused', async () => {
    const s = setup();
    const offered = await qr.offer(s.as(COMPUTER, ME), s.overrides);
    await qr.claim(s.as(PHONE, null, { code: offered.code, publicKey: ephemeral().publicKey }), s.overrides);
    await expect(qr.claim(s.as('phone-two-00001', null, { code: offered.code, publicKey: ephemeral().publicKey }), s.overrides)).rejects.toMatchObject({ status: 409 });
  });

  test('expired offers cannot be claimed', async () => {
    const s = setup();
    const offered = await qr.offer(s.as(COMPUTER, ME), s.overrides);
    s.store.clock.now += qr.WAIT_TTL_MS + 1;
    await expect(qr.claim(s.as(PHONE, null, { code: offered.code, publicKey: ephemeral().publicKey }), s.overrides)).rejects.toMatchObject({ status: 410 });
  });

  test('an undecided claim expires after 3 minutes', async () => {
    const s = setup();
    const offered = await qr.offer(s.as(COMPUTER, ME), s.overrides);
    const claimed = await qr.claim(s.as(PHONE, null, { code: offered.code, publicKey: ephemeral().publicKey }), s.overrides);
    s.store.clock.now += qr.DECIDE_TTL_MS + 1;
    await expect(qr.decide(s.as(COMPUTER, ME, { code: offered.code, approve: true }), s.overrides)).rejects.toMatchObject({ status: 410 });
    expect((await s.poll(PHONE, { code: offered.code, secret: claimed.secret })).statusCode).toBe(410);
  });

  test('another account cannot allow someone onto mine', async () => {
    const s = setup();
    const offered = await qr.offer(s.as(COMPUTER, ME), s.overrides);
    await qr.claim(s.as(PHONE, null, { code: offered.code, publicKey: ephemeral().publicKey }), s.overrides);
    await expect(qr.decide(s.as('evil-device-001', 'u2', { code: offered.code, approve: true }), s.overrides)).rejects.toMatchObject({ status: 409 });
  });
});

describe('message key for the new device', () => {
  test('server-sealed accounts get the key wrapped for the requester\'s ephemeral key', async () => {
    mockCrypto.state = { umekProtectionType: 'SERVER_KEK', umekEnvelope: 'sealed', kekVersion: 1 };
    const key = ephemeral();
    const out = await qr.keysFor(ME, key.publicKey);
    expect(out.keyMode).toBe('SERVER_KEK');
    // Unwrap like the clients do: ECDH → PBKDF2(umek-wrap-v1, 10000) → AES-GCM(iv|tag|data).
    const secret = key.ecdh.computeSecret(Buffer.from(out.keys.serverEphemeralPublicKey, 'base64'));
    const wrapKey = crypto.pbkdf2Sync(secret, 'umek-wrap-v1', 10000, 32, 'sha256');
    const blob = Buffer.from(out.keys.rewrappedUmek, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', wrapKey, blob.subarray(0, 12));
    d.setAuthTag(blob.subarray(12, 28));
    expect(Buffer.concat([d.update(blob.subarray(28)), d.final()])).toEqual(Buffer.alloc(32, 7));
  });

  test('password-protected accounts get no key (the device unlocks once)', async () => {
    mockCrypto.state = { umekProtectionType: 'PASSWORD', umekEnvelope: 'password-derived' };
    expect(await qr.keysFor(ME, ephemeral().publicKey)).toEqual({ keyMode: 'PASSWORD', keys: null });
  });
});
