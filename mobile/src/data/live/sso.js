// Company SSO sign-in from the app (server: server/src/features/security/ssoApp.js).
//
//   1. GET /api/auth/sso/discover?email=  → { enabled, startUrl }
//   2. open startUrl?client=app&appChallenge=<S256>&deviceId=<id> in the in-app browser
//   3. the identity provider signs the person in; the server redirects to oruinwan://sso?code=…
//   4. POST /api/auth/sso/app/exchange { code, verifier } → access + refresh token
//
// The verifier never leaves the app, so a code caught by another app is useless (PKCE).
import { digest } from 'lib0/hash/sha256';
import { prefs } from '../../native/storage.js';

const PENDING_KEY = 'sso.pending';
const PENDING_TTL_MS = 10 * 60 * 1000;

function base64url(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** S256 challenge for a verifier (RFC 7636). */
export function challengeFor(verifier) {
  return base64url(digest(new TextEncoder().encode(verifier)));
}

/** A fresh { verifier, challenge } pair. */
export function makePkce() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const verifier = base64url(bytes);
  return { verifier, challenge: challengeFor(verifier) };
}

/** The sign-in URL to open: the server's start URL plus the app's challenge and device id. */
export function appStartUrl(startUrl, { challenge, deviceId }) {
  const url = new URL(startUrl);
  url.searchParams.set('client', 'app');
  url.searchParams.set('appChallenge', challenge);
  if (deviceId) url.searchParams.set('deviceId', deviceId);
  return url.toString();
}

/** oruinwan://sso?code=… → { code } | { error } ; anything else → null. */
export function parseSsoReturn(link) {
  if (typeof link !== 'string' || !/^oruinwan(-[a-z]+)?:\/\/sso\b/i.test(link)) return null;
  const query = link.split('?')[1] || '';
  const params = new URLSearchParams(query.split('#')[0]);
  const code = params.get('code');
  if (code && /^[a-f0-9]{64}$/.test(code)) return { code };
  return { error: params.get('error') || 'sso_failed' };
}

const ERRORS = {
  sso_state_mismatch: 'The sign-in took too long or was opened twice. Try again.',
  sso_no_email: "Your company's sign-in didn't share your email address. Ask your admin.",
  sso_saml_not_configured: 'Single sign-on is not set up for your company yet.',
  sso_saml_no_account: "There's no Oruinwan account for you in this company yet. Ask your admin to invite you.",
  sso_saml_wrong_company: 'This account belongs to another company.',
  sso_saml_account_disabled: 'This account is disabled. Ask your admin.',
};

/** A sentence for an error code from oruinwan://sso?error=… */
export function ssoErrorMessage(code) {
  return ERRORS[code] || "Single sign-on didn't finish. Try again, or sign in with your password.";
}

/** Remembers the sign-in in progress (the app may be backgrounded while the browser is open). */
export function savePending(pending, now = Date.now()) {
  prefs.set(PENDING_KEY, { ...pending, at: now });
}

/** The sign-in in progress, if it's recent; it can be taken once. */
export function takePending(now = Date.now()) {
  const p = prefs.get(PENDING_KEY);
  prefs.set(PENDING_KEY, null);
  if (!p || typeof p.verifier !== 'string' || !p.server || now - (p.at || 0) > PENDING_TTL_MS) return null;
  return p;
}
