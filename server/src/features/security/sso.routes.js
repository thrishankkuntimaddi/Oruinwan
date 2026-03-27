// server/src/features/security/sso.routes.js
// SSO (Single Sign-On) routes for Google, Microsoft, and Okta (generic OAuth2)
// Extends the existing auth system without rebuilding it.

'use strict';

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../../../models/User');
const AuditLog = require('../../../models/AuditLog');

// ── Provider configuration ────────────────────────────────────────────────────
const PROVIDERS = {
  google: {
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    scope: 'openid email profile',
  },
  microsoft: {
    authUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    userInfoUrl: 'https://graph.microsoft.com/v1.0/me',
    clientId: () => process.env.MICROSOFT_CLIENT_ID,
    clientSecret: () => process.env.MICROSOFT_CLIENT_SECRET,
    scope: 'openid email profile User.Read',
  },
  okta: {
    authUrl: () => `${process.env.OKTA_DOMAIN}/oauth2/default/v1/authorize`,
    tokenUrl: () => `${process.env.OKTA_DOMAIN}/oauth2/default/v1/token`,
    userInfoUrl: () => `${process.env.OKTA_DOMAIN}/oauth2/default/v1/userinfo`,
    clientId: () => process.env.OKTA_CLIENT_ID,
    clientSecret: () => process.env.OKTA_CLIENT_SECRET,
    scope: 'openid email profile',
  },
};

const FRONTEND_URL = () => process.env.FRONTEND_URL || 'http://localhost:3000';
const BACKEND_URL = () => process.env.BACKEND_URL || 'http://localhost:8080';

// ── Helper: issue JWT (same signature as existing auth) ──────────────────────
function issueToken(user) {
  return jwt.sign(
    { sub: user._id, username: user.username, role: user.roles?.[0] || 'user' },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN || '15m' }
  );
}

// ── Helper: resolve URL (supports both string and function) ──────────────────
function resolve(val) {
  return typeof val === 'function' ? val() : val;
}

// ── GET /api/auth/sso/:provider ───────────────────────────────────────────────
// Redirects browser to provider's OAuth2 authorization URL.
router.get('/:provider', (req, res) => {
  const { provider } = req.params;
  const cfg = PROVIDERS[provider];
  if (!cfg) return res.status(400).json({ message: `Unknown SSO provider: ${provider}` });

  // Validate that environment vars for this provider are set
  const clientId = cfg.clientId();
  if (!clientId) {
    return res.status(501).json({
      message: `SSO provider '${provider}' is not configured. Set ${provider.toUpperCase()}_CLIENT_ID in environment.`
    });
  }

  // CSRF protection via state cookie (same pattern as existing LinkedIn OAuth)
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie(`sso_state_${provider}`, state, {
    httpOnly: true,
    sameSite: 'Lax',
    maxAge: 5 * 60 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });

  const redirectUri = `${BACKEND_URL()}/api/auth/sso/${provider}/callback`;
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: cfg.scope,
    state,
  });

  res.redirect(`${resolve(cfg.authUrl)}?${params.toString()}`);
});

// ── GET /api/auth/sso/:provider/callback ─────────────────────────────────────
// Receives OAuth2 code, exchanges for tokens, maps to internal user, issues JWT.
router.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const cfg = PROVIDERS[provider];
  if (!cfg) return res.redirect(`${FRONTEND_URL()}/login?error=unknown_provider`);

  const { code, state, error } = req.query;

  if (error) {
    console.error(`[SSO] ${provider} error:`, error);
    return res.redirect(`${FRONTEND_URL()}/login?error=sso_${provider}_failed`);
  }

  // Validate CSRF state
  const storedState = req.cookies?.[`sso_state_${provider}`];
  if (!state || !storedState || state !== storedState) {
    console.error(`[SSO] ${provider}: state mismatch — CSRF attempt?`);
    res.clearCookie(`sso_state_${provider}`);
    return res.redirect(`${FRONTEND_URL()}/login?error=sso_state_mismatch`);
  }
  res.clearCookie(`sso_state_${provider}`);

  try {
    const redirectUri = `${BACKEND_URL()}/api/auth/sso/${provider}/callback`;

    // Exchange code for access token
    const tokenRes = await axios.post(
      resolve(cfg.tokenUrl),
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: cfg.clientId(),
        client_secret: cfg.clientSecret(),
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token: accessToken } = tokenRes.data;

    // Fetch user info from provider
    const userInfoRes = await axios.get(resolve(cfg.userInfoUrl), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = userInfoRes.data;

    // Normalize profile fields across providers
    const externalId = profile.sub || profile.id || profile.oid;
    const email = profile.email || profile.mail || profile.userPrincipalName;
    const name = profile.name || `${profile.givenName || ''} ${profile.surname || ''}`.trim() || profile.displayName;
    const picture = profile.picture || null;

    if (!email) {
      return res.redirect(`${FRONTEND_URL()}/login?error=sso_no_email`);
    }

    // Find or create user — map external identity to internal user
    let user = await User.findOne({ ssoProvider: provider, ssoId: externalId });
    if (!user) {
      user = await User.findOne({ email: email.toLowerCase() });
      if (user) {
        // Link SSO identity to existing account
        user.ssoProvider = provider;
        user.ssoId = externalId;
        if (picture && !user.profilePicture) user.profilePicture = picture;
        await user.save();
      }
    }

    if (!user) {
      // Create new account from SSO identity
      user = await User.create({
        username: name || email.split('@')[0],
        email: email.toLowerCase(),
        profilePicture: picture,
        authProvider: provider === 'google' ? 'google' : 'local',
        ssoProvider: provider,
        ssoId: externalId,
        passwordHash: null,
        verified: true,
        accountStatus: 'active',
      });
    }

    // Record audit event
    try {
      await AuditLog.create({
        userId: user._id,
        action: 'auth.sso_login',
        resource: 'User',
        resourceId: user._id,
        description: `SSO login via ${provider}`,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        category: 'auth',
        severity: 'info',
      });
    } catch (_) { /* non-critical */ }

    const token = issueToken(user);
    // Use fragment (#) to keep token out of server logs / Referer headers
    return res.redirect(`${FRONTEND_URL()}/oauth-success#access=${token}`);
  } catch (err) {
    console.error(`[SSO] ${provider} callback error:`, err.response?.data || err.message);
    return res.redirect(`${FRONTEND_URL()}/login?error=sso_${provider}_failed`);
  }
});

module.exports = router;
