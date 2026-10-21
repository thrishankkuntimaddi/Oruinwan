// @vitest-environment node
// Sign-in challenges, QR sign-in and approvals in the live adapter (server: docs/api/auth-devices.md).
import { createRequire } from 'module';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const require = createRequire(import.meta.url);
const silent = () => {};
const loggerPath = require.resolve('../../../../server/utils/logger.js');
require.cache[loggerPath] = { id: loggerPath, filename: loggerPath, loaded: true, exports: { info: silent, warn: silent, error: silent, debug: silent } };
const { wrapForDevice } = require('../../../../server/src/features/crypto/umekEnvelope.js');

const http = vi.hoisted(() => ({ request: vi.fn(), api: { get: vi.fn(), post: vi.fn() }, configure: vi.fn() }));
vi.mock('./http.js', () => http);
const sealed = vi.hoisted(() => ({ sealWithPassword: vi.fn(async () => true) }));
vi.mock('./crypto.js', async (orig) => ({ ...(await orig()), sealWithPassword: sealed.sealWithPassword }));

const { challengeError, parseSignInQr, qrMessage, signinAdapter } = await import('./adapter.signin.js');
const { unwrapUmek } = await import('./crypto.js');

const apiError = (status, data) => Object.assign(new Error(data?.message || 'x'), { status, data, code: data?.code });
const CODE = 'A'.repeat(32);

let finish;
let a;
beforeEach(() => {
  vi.clearAllMocks();
  finish = vi.fn(async () => ({ user: { id: 'u1' }, requiresPasswordSetup: false }));
  a = signinAdapter(finish);
});

describe('QR codes', () => {
  it('reads the sign-in code from the QR text', () => {
    expect(parseSignInQr(`oruinwan://signin?c=${CODE}`)).toBe(CODE);
    expect(parseSignInQr(`oruinwan-dev://signin?c=${CODE}&x=1`)).toBe(CODE);
    expect(parseSignInQr(CODE)).toBe(CODE);
    expect(parseSignInQr('https://evil.example/signin?c=' + CODE)).toBeNull();
    expect(parseSignInQr('oruinwan://sso?code=abc')).toBeNull();
    expect(parseSignInQr('')).toBeNull();
  });

  it('claims with a fresh ephemeral key, waits, then signs in with the key wrapped for it', async () => {
    let publicKey;
    http.request.mockImplementation(async (method, path, { body }) => {
      if (path === '/auth/qr/claim') {
        publicKey = body.publicKey;
        return { secret: 's', approver: { deviceName: 'Chrome on macOS' } };
      }
      return null;
    });
    const claim = await a.qrClaim({ server: 'https://x.test', code: CODE });
    expect(claim.approver.deviceName).toBe('Chrome on macOS');
    expect(Buffer.from(publicKey, 'base64')).toHaveLength(65);

    http.request.mockResolvedValueOnce({ status: 'claimed' });
    expect(await a.qrPoll({ code: CODE, secret: 's' })).toEqual({ status: 'claimed', approver: null });
    expect(finish).not.toHaveBeenCalled();

    const umek = crypto.getRandomValues(new Uint8Array(32));
    const keys = wrapForDevice(Buffer.from(umek), publicKey);
    http.request.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r', keys });
    const done = await a.qrPoll({ code: CODE, secret: 's' });
    expect(done.done).toBe(true);
    const [, ctx] = finish.mock.calls[0];
    expect(ctx.kind).toBe('qr');
    expect(ctx.keys).toEqual(keys);
    // The private key kept from the claim opens what the server wrapped.
    const key = await unwrapUmek(ctx.privateKey, keys);
    expect(key.type).toBe('secret');
  });

  it('over the device limit the poll becomes a challenge that still carries the QR key', async () => {
    http.request.mockResolvedValueOnce({ secret: 's' });
    await a.qrClaim({ server: 'https://x.test', code: CODE });
    http.request.mockRejectedValueOnce(apiError(409, { code: 'DEVICE_LIMIT', pendingToken: 'p'.repeat(43), devices: [], limit: 4 }));
    const err = await a.qrPoll({ code: CODE, secret: 's' }).catch((e) => e);
    expect(err.code).toBe('SIGNIN_CHALLENGE');
    expect(err.challenge.code).toBe('DEVICE_LIMIT');
    expect(err.challenge.ctx.privateKey).toBeTruthy();
  });

  it('declined and expired codes come back as readable errors', async () => {
    http.request.mockRejectedValueOnce(apiError(403, { code: 'QR_DENIED' }));
    const err = await a.qrPoll({ code: CODE, secret: 's' }).catch((e) => e);
    expect(qrMessage(err)).toMatch(/declined/);
    expect(qrMessage({ code: 'QR_EXPIRED' })).toMatch(/expired/);
    expect(qrMessage({ code: 'QR_WRONG_SIDE' })).toBeNull();
  });

  it('scan and decide on the signed-in side', async () => {
    http.api.post.mockResolvedValue({ requester: { deviceName: 'Chrome on Windows' } });
    await a.qrScan(CODE);
    await a.qrDecide(CODE, true);
    expect(http.api.post).toHaveBeenNthCalledWith(1, '/auth/qr/scan', { code: CODE });
    expect(http.api.post).toHaveBeenNthCalledWith(2, '/auth/qr/decide', { code: CODE, approve: true });
  });
});

describe('paused sign-ins', () => {
  it('turns MFA_REQUIRED and DEVICE_LIMIT answers into challenges, nothing else', () => {
    const mfa = challengeError(apiError(401, { code: 'MFA_REQUIRED', requires2FA: true, pendingToken: 't' }), { kind: 'password', password: 'pw' });
    expect(mfa.code).toBe('SIGNIN_CHALLENGE');
    expect(mfa.challenge).toMatchObject({ code: 'MFA_REQUIRED', pendingToken: 't', ctx: { password: 'pw' } });
    expect(challengeError(apiError(401, { requires2FA: true }))).toBeNull(); // older server: inline code
    expect(challengeError(apiError(400, { message: 'Invalid credentials' }))).toBeNull();
  });

  it('continue: a session finishes with the original context; a wrong code stays on the screen', async () => {
    const challenge = { code: 'MFA_REQUIRED', pendingToken: 't', ctx: { kind: 'password', password: 'pw' } };
    http.request.mockRejectedValueOnce(apiError(401, { code: 'MFA_REQUIRED', pendingToken: 't', invalidCode: true, message: 'Nope' }));
    await expect(a.signinContinue(challenge, { otp: '000000' })).rejects.toMatchObject({ status: 401, message: 'Nope' });
    http.request.mockRejectedValueOnce(apiError(409, { code: 'DEVICE_LIMIT', pendingToken: 't', devices: [] }));
    await expect(a.signinContinue(challenge, { otp: '123456' })).rejects.toMatchObject({ code: 'SIGNIN_CHALLENGE' });
    http.request.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r' });
    await a.signinContinue(challenge, { signOutAll: true });
    expect(http.request).toHaveBeenLastCalledWith('POST', '/auth/signin/continue', { body: { pendingToken: 't', signOutAll: true }, auth: false });
    expect(finish).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' }, challenge.ctx);
  });
});

describe('approvals', () => {
  it('sign-in requests are approved or denied', async () => {
    http.api.get.mockResolvedValue({ approvals: [{ id: 'a1', kind: 'signin' }] });
    expect(await a.approvals()).toHaveLength(1);
    await a.decideSignInApproval('a1', false);
    expect(http.api.post).toHaveBeenCalledWith('/auth/approvals/a1/decision', { approve: false });
  });

  it('unlock requests need the password once while the key is still password-protected', async () => {
    http.api.post.mockRejectedValueOnce(apiError(409, { code: 'UMEK_NOT_SEALED' }));
    await expect(a.decideUnlockApproval('u1', true)).rejects.toMatchObject({ code: 'PASSWORD_NEEDED' });
    http.api.post.mockRejectedValueOnce(apiError(409, { code: 'UMEK_NOT_SEALED' })).mockResolvedValueOnce({});
    await a.decideUnlockApproval('u1', true, 'pw');
    expect(sealed.sealWithPassword).toHaveBeenCalledWith('pw');
    expect(http.api.post).toHaveBeenLastCalledWith('/v2/crypto/unlock-requests/u1/decision', { approve: true });
  });
});
