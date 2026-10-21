// Live adapter part: the steps after the password / Google / SSO step, QR sign-in both ways,
// and approvals from this (signed-in) device. Server: docs/api/auth-devices.md
//
//   /auth/signin/status | continue | email-code   a pending sign-in (two-step verification, device limit)
//   /auth/qr/claim, /auth/qr/poll                 this phone signs in with a QR shown on a signed-in computer
//   /auth/qr/scan, /auth/qr/decide                this phone approves a QR shown on a login screen
//   /auth/approvals                               sign-in requests from the person's other devices
//   /v2/crypto/unlock-requests                    "unlock messages on my other device"
import { api, request, configure } from './http.js';
import { newEphemeralKey, sealWithPassword } from './crypto.js';
import { normalizeServerUrl } from './server.js';

/**
 * A sign-in the server paused: { code: 'MFA_REQUIRED' | 'DEVICE_LIMIT', pendingToken, … } plus
 * what's needed to finish it here (`ctx`: the typed password, or the QR ephemeral key). Returns
 * an Error with code SIGNIN_CHALLENGE, or null when `err` is something else.
 */
export function challengeError(err, ctx = {}) {
  const d = err?.data;
  if (!d || !d.pendingToken || (d.code !== 'MFA_REQUIRED' && d.code !== 'DEVICE_LIMIT')) return null;
  return Object.assign(new Error(d.message || 'One more step to sign in.'), { code: 'SIGNIN_CHALLENGE', challenge: { ...d, ctx } });
}

/** The code inside a sign-in QR (oruinwan://signin?c=<code>), or null. A bare code works too. */
export function parseSignInQr(text) {
  const value = String(text || '').trim();
  if (/^[A-Za-z0-9_-]{32}$/.test(value)) return value;
  const m = value.match(/^oruinwan(?:-[a-z]+)?:\/\/signin\/?\?(?:.*&)?c=([A-Za-z0-9_-]{32})(?:&|$)/i);
  return m ? m[1] : null;
}

/** Readable text for QR errors the server returns. */
export function qrMessage(err) {
  switch (err?.code) {
    case 'QR_WRONG_SIDE':
      return null; // the caller explains which screen to use
    case 'QR_EXPIRED':
      return 'This QR code has expired. Show a new one and scan again.';
    case 'QR_USED':
      return 'This QR code was already used. Show a new one.';
    case 'QR_DENIED':
      return 'Sign-in was declined on your other device.';
    case 'QR_RATE_LIMIT':
      return 'Too many QR codes. Wait a few minutes and try again.';
    default:
      return err?.message || "That didn't work. Try again.";
  }
}

// QR claims in progress: code → { privateKey } (the one-time key the message key is wrapped for).
const claims = new Map();

/**
 * `finish(data, ctx)` turns a session answer into a signed-in user (adapter.js completeSignIn).
 * Kept as a parameter so this file doesn't import the main adapter.
 */
export function signinAdapter(finish) {
  return {
    /** This phone signs in with a code shown on a signed-in computer. → { secret, approver, expiresAt } */
    async qrClaim({ server, code }) {
      configure(normalizeServerUrl(server));
      const eph = await newEphemeralKey();
      const res = await request('POST', '/auth/qr/claim', { body: { code, publicKey: eph.publicKey }, auth: false });
      claims.set(code, { privateKey: eph.privateKey });
      return res;
    },

    /**
     * → { status } while waiting ('claimed'), or { done, user, requiresPasswordSetup } once the
     * computer allowed it. Throws SIGNIN_CHALLENGE (device limit), or ApiError QR_DENIED / QR_EXPIRED.
     */
    async qrPoll({ code, secret }) {
      const ctx = { kind: 'qr', privateKey: claims.get(code)?.privateKey || null };
      let data;
      try {
        data = await request('POST', '/auth/qr/poll', { body: { code, secret }, auth: false });
      } catch (err) {
        if (err.code === 'QR_DENIED' || err.code === 'QR_EXPIRED') claims.delete(code);
        throw challengeError(err, ctx) || err;
      }
      if (!data?.accessToken) return { status: data?.status || 'claimed', approver: data?.approver || null };
      claims.delete(code);
      return { done: true, ...(await finish(data, { ...ctx, keys: data.keys || null })) };
    },

    forgetQrClaim(code) {
      claims.delete(code);
    },

    /** Where a paused sign-in stands (polled while waiting for approval). */
    signinStatus(pendingToken) {
      return request('POST', '/auth/signin/status', { body: { pendingToken }, auth: false });
    },

    /**
     * Tries to finish a paused sign-in. body: { otp } | { emailCode } | { signOutDeviceIds } |
     * { signOutAll: true } | {} (after approval). → { done, user, … } or throws (another
     * SIGNIN_CHALLENGE, a wrong code, SIGNIN_DENIED, SIGNIN_EXPIRED).
     */
    async signinContinue(challenge, body = {}) {
      let data;
      try {
        data = await request('POST', '/auth/signin/continue', { body: { pendingToken: challenge.pendingToken, ...body }, auth: false });
      } catch (err) {
        const next = challengeError(err, challenge.ctx);
        if (next && !err.data?.waiting && !err.data?.invalidCode) throw next;
        throw err;
      }
      if (!data?.accessToken || !data?.refreshToken) throw new Error('The server did not return a mobile session. Update your Oruinwan server.');
      return { done: true, ...(await finish(data, challenge.ctx || {})) };
    },

    signinEmailCode(pendingToken) {
      return request('POST', '/auth/signin/email-code', { body: { pendingToken }, auth: false });
    },

    // ---- this phone approves (signed in)

    /** A QR shown on a login screen → { requester: { deviceName, platform, location, ip } } */
    qrScan(code) {
      return api.post('/auth/qr/scan', { code });
    },
    qrDecide(code, approve) {
      return api.post('/auth/qr/decide', { code, approve: Boolean(approve) });
    },

    async approvals() {
      const d = await api.get('/auth/approvals');
      return Array.isArray(d?.approvals) ? d.approvals : [];
    },
    decideSignInApproval(id, approve) {
      return api.post(`/auth/approvals/${encodeURIComponent(id)}/decision`, { approve: Boolean(approve) });
    },
    /**
     * "Unlock messages on <device>": the key must be sealed on the server first. When it's still
     * password-protected, `password` opens it here once (and moves the account to automatic unlock).
     */
    async decideUnlockApproval(id, approve, password) {
      if (approve) {
        try {
          await api.post(`/v2/crypto/unlock-requests/${encodeURIComponent(id)}/decision`, { approve: true });
          return;
        } catch (err) {
          if (err.code !== 'UMEK_NOT_SEALED') throw err;
          if (!password) throw Object.assign(new Error('Enter your password to unlock your messages there.'), { code: 'PASSWORD_NEEDED' });
        }
        await sealWithPassword(password);
      }
      await api.post(`/v2/crypto/unlock-requests/${encodeURIComponent(id)}/decision`, { approve: Boolean(approve) });
    },

    // ---- this phone asks another device to unlock its messages
    requestUnlock() {
      return api.post('/v2/crypto/unlock-requests', {});
    },
    unlockRequestStatus(id) {
      return api.get(`/v2/crypto/unlock-requests/${encodeURIComponent(id)}`);
    },
  };
}
