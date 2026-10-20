'use strict';

/**
 * Rate limits for /api/auth.
 *
 * A company of ~50 people usually reaches the server from one office IP (NAT, VPN), so
 * per-IP limits must leave room for everyone opening the app at 9am. Guessing protection
 * therefore sits on the credential itself:
 *   - authLimiter        per IP, generous: stops floods, never a normal office.
 *   - credentialLimiter  per IP + account (email) on the endpoints that check a password
 *                        or send a code; on top of the 5-strikes account lockout.
 *   - refreshLimiter     per browser session (refresh cookie), not per IP.
 *
 * Before this, production allowed 20 requests a minute per IP across all of /api/auth,
 * and every sign-in costs about five of them (providers, refresh, login, ...): the fifth
 * person in one office to sign in within a minute got "Too many requests".
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

const MINUTE = 60 * 1000;

// Paths (relative to /api/auth) that send a password, a code or an email.
const CREDENTIAL_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/resend-verification',
  '/reactivate/verify-otp',
  '/google-login',
  '/google',
  '/google-signup',
  '/google/desktop-token',
]);

function limits(env = process.env) {
  const prod = env.NODE_ENV === 'production';
  return {
    auth: prod ? 300 : 1000,             // per IP per minute
    credential: prod ? 10 : 60,          // per IP + account per 15 minutes
    refresh: prod ? 30 : 120,            // per session per minute
  };
}

const ipKey = (req) => ipKeyGenerator(req.ip || '');

function accountOf(req) {
  const b = req.body || {};
  const raw = b.email || b.username || b.identifier || '';
  return String(raw).trim().toLowerCase().slice(0, 254);
}

function tooMany(message) {
  return (req, res) => res.status(429).json({ message });
}

function createAuthLimiters(env = process.env) {
  const max = limits(env);

  const authLimiter = rateLimit({
    windowMs: MINUTE,
    limit: max.auth,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKey,
    // /me and /users are read on every page; /refresh has its own per-session limit.
    skip: (req) => req.path === '/me' || req.path.startsWith('/users') || req.path === '/refresh',
    handler: tooMany('Too many requests, please try again in a minute.'),
  });

  const credentialLimiter = rateLimit({
    windowMs: 15 * MINUTE,
    limit: max.credential,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKey(req)}|${accountOf(req)}`,
    skip: (req) => req.method !== 'POST' || !CREDENTIAL_PATHS.has(req.path),
    handler: tooMany('Too many attempts for this account. Please wait a few minutes and try again.'),
  });

  const refreshLimiter = rateLimit({
    windowMs: MINUTE,
    limit: max.refresh,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const token = req.cookies?.refreshToken || req.cookies?.jwt || req.body?.refreshToken || '';
      const session = token ? crypto.createHash('sha256').update(String(token)).digest('hex').slice(0, 24) : 'none';
      return `${ipKey(req)}|${session}`;
    },
    skip: (req) => req.path !== '/refresh',
    handler: tooMany('Too many token refresh requests, please try again later.'),
  });

  return { authLimiter, credentialLimiter, refreshLimiter };
}

module.exports = { createAuthLimiters, limits, CREDENTIAL_PATHS };
