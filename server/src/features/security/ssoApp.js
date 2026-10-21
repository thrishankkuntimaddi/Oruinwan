'use strict';

// SSO sign-in from the phone/tablet app.
//
// The browser flow ends with a refresh cookie and a redirect to the web app, neither of which
// the app can use: SSO runs in the in-app browser, whose cookies the app can't read. So when
// sign-in is started with `client=app&appChallenge=<S256 challenge>`, the callback instead
// redirects to the app's own URL scheme with a one-time code:
//
//   oruinwan://sso?code=<code>          (or oruinwan://sso?error=<code> on failure)
//
// and the app trades the code for a session over its normal API connection:
//
//   POST /api/auth/sso/app/exchange { code, verifier }  (header x-client-platform: ios|android)
//     -> { accessToken, refreshToken, user, requiresPasswordSetup: false }
//
// The code lives 2 minutes, works once, and only with the verifier whose SHA-256 is the
// challenge sent at the start (PKCE, RFC 7636 S256). Another app that registers the same URL
// scheme and catches the redirect can't use the code without the verifier, which never leaves
// the app that started the sign-in.

const crypto = require('crypto');
const otpStore = require('../../shared/services/otpStore');

const CODE_TTL_MS = 2 * 60 * 1000;
const CHALLENGE_RE = /^[A-Za-z0-9_-]{43}$/; // base64url(sha256) without padding
const VERIFIER_RE = /^[A-Za-z0-9._~-]{43,128}$/; // RFC 7636
const CODE_RE = /^[a-f0-9]{64}$/;

/** Where the app is sent back to. Only the app's own scheme (or an override from the environment). */
function appReturnUrl(env = process.env) {
  const configured = String(env.APP_SSO_RETURN_URL || '').trim();
  return /^[a-z][a-z0-9+.-]*:\/\/[^\s]*$/i.test(configured) && !/^(https?|javascript|data|file):/i.test(configured)
    ? configured
    : 'oruinwan://sso';
}

/** The app's PKCE challenge when sign-in was started by the app (`client=app`), else null. */
function appChallengeFrom(query = {}) {
  if (String(query.client || '') !== 'app') return null;
  const challenge = String(query.appChallenge || '');
  return CHALLENGE_RE.test(challenge) ? challenge : null;
}

const isChallenge = (value) => typeof value === 'string' && CHALLENGE_RE.test(value);

function challengeOf(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function withParams(base, params) {
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${new URLSearchParams(params).toString()}`;
}

/** Stores a one-time code for this sign-in and returns the app URL to redirect to. */
async function appRedirectWithCode({ userId, deviceId, method, challenge }) {
  const code = crypto.randomBytes(32).toString('hex');
  await otpStore.set(`sso-app:${code}`, { userId: String(userId), deviceId: deviceId || null, method, challenge }, CODE_TTL_MS);
  return withParams(appReturnUrl(), { code });
}

/** The app URL for a failed sign-in (`error` is a short code like sso_saml_no_account). */
function appRedirectWithError(error) {
  return withParams(appReturnUrl(), { error: String(error || 'sso_failed').slice(0, 64) });
}

/**
 * Takes the code (once) and checks the verifier. Returns { userId, deviceId, method } or null.
 * The code is deleted before the verifier is checked, so a wrong guess burns it.
 */
async function redeemAppCode(code, verifier) {
  if (typeof code !== 'string' || !CODE_RE.test(code) || typeof verifier !== 'string' || !VERIFIER_RE.test(verifier)) return null;
  const key = `sso-app:${code}`;
  const entry = await otpStore.get(key);
  if (!entry) return null;
  await otpStore.delete(key);
  const expected = Buffer.from(String(entry.challenge || ''));
  const actual = Buffer.from(challengeOf(verifier));
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) return null;
  return { userId: entry.userId, deviceId: entry.deviceId, method: entry.method };
}

// SAML carries state in RelayState: plain `<deviceId>` (browser) or `app:<challenge>:<deviceId>` (app).
function encodeRelayState(deviceId, challenge) {
  return challenge ? `app:${challenge}:${deviceId || ''}` : deviceId || '';
}

function decodeRelayState(raw) {
  const value = typeof raw === 'string' ? raw : '';
  if (value.startsWith('app:')) {
    const challenge = value.slice(4, 47);
    if (isChallenge(challenge) && value[47] === ':') return { challenge, deviceId: value.slice(48) || null };
    return { challenge: null, deviceId: null };
  }
  return { challenge: null, deviceId: value || null };
}

module.exports = {
  CODE_TTL_MS,
  appReturnUrl,
  appChallengeFrom,
  isChallenge,
  challengeOf,
  appRedirectWithCode,
  appRedirectWithError,
  redeemAppCode,
  encodeRelayState,
  decodeRelayState,
};
