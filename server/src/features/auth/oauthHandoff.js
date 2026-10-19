'use strict';

// Hand-off from a redirect-based sign-in (GitHub, LinkedIn) to the app.
// The provider's callback must not put a session token in the redirect: anyone holding that
// URL would be signed in, and it would skip the checks other sign-ins make (two-factor,
// suspension, deactivation, lockout) and create no refresh session. Instead the callback
// stores a one-time code for two minutes and redirects with it; the app exchanges the code
// at POST /api/auth/oauth/exchange, which runs the same checks as password and Google sign-in.

const crypto = require('crypto');
const otpStore = require('../../shared/services/otpStore');
const { isAllowedOrigin, originOf } = require('../../shared/allowedOrigins');

const HANDOFF_TTL_MS = 2 * 60 * 1000;
const RETURN_COOKIE = 'oauth_return';

const keyFor = (code) => `oauth-handoff:${crypto.createHash('sha256').update(String(code)).digest('hex')}`;

async function createHandoff(userId, provider) {
  const code = crypto.randomBytes(32).toString('base64url');
  await otpStore.set(keyFor(code), { userId: String(userId), provider }, HANDOFF_TTL_MS);
  return code;
}

/** The pending hand-off for a code, or null when it is unknown, used or expired. */
async function peekHandoff(code) {
  if (typeof code !== 'string' || code.length < 20 || code.length > 200) return null;
  return otpStore.get(keyFor(code));
}

async function consumeHandoff(code) {
  await otpStore.delete(keyFor(code));
}

/**
 * Where the app that started the sign-in wants to land: a trusted origin (FRONTEND_URL,
 * CORS_EXTRA_ORIGINS, dev servers outside production). Anything else falls back to
 * FRONTEND_URL, so a crafted link can't send the code to another site.
 */
function returnOrigin(requested, env = process.env) {
  if (requested && isAllowedOrigin(requested, env)) return originOf(requested);
  return originOf(env.FRONTEND_URL) || 'http://localhost:3000';
}

/** Express middleware for the sign-in start routes: remembers ?return=<origin> for the callback. */
function rememberReturn(req, res, next) {
  const requested = req.query?.return;
  if (requested && isAllowedOrigin(requested)) {
    res.cookie(RETURN_COOKIE, originOf(requested), {
      httpOnly: true,
      sameSite: 'Lax',
      maxAge: 10 * 60 * 1000,
      secure: process.env.NODE_ENV === 'production',
    });
  } else {
    res.clearCookie(RETURN_COOKIE);
  }
  next();
}

/** Callback end: store a hand-off code and send the browser back to the app with it. */
async function redirectWithHandoff(req, res, user, provider) {
  const code = await createHandoff(user._id, provider);
  const target = returnOrigin(req.cookies?.[RETURN_COOKIE]);
  res.clearCookie(RETURN_COOKIE);
  // In the fragment: never sent to servers, not logged, not leaked through Referer.
  res.redirect(`${target}/oauth-success#code=${encodeURIComponent(code)}`);
}

module.exports = { createHandoff, peekHandoff, consumeHandoff, returnOrigin, rememberReturn, redirectWithHandoff, HANDOFF_TTL_MS, RETURN_COOKIE };
