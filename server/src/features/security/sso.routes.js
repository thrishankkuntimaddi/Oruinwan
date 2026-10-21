'use strict';
const logger = require('../../../utils/logger');

const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const { users } = require('../../identity');
const { findBySso } = require('../../identity/queries/security');
const AuditLog = require('../../../models/AuditLog');

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

const FRONTEND_URL = () => require('../../shared/utils/webAppUrl').webAppUrl();
const BACKEND_URL = () => process.env.BACKEND_URL || 'http://localhost:8080';

// A full session (refresh cookie + session row + device row), like password/Google sign-in.
const startSsoSession = (...args) => require('../auth/auth.controller').startSsoSession(...args);
const { deviceIdFrom } = require('../devices/devices.service');
const ssoApp = require('./ssoApp');
const { isNativeClient } = require('../../../utils/cookieHelper');

function resolve(val) {
  return typeof val === 'function' ? val() : val;
}

// SAML 2.0 (per-company IdP) lives under /saml; OIDC providers below.
router.use('/saml', require('./saml.routes'));

/**
 * Which SSO sign-in an email's company uses (sign-in screen: "Sign in with your company SSO").
 *   GET /discover?email=ada@acme.com -> { enabled: true, protocol: 'saml'|'oidc', startUrl } | { enabled: false }
 * Only companies with a verified domain and an enabled, configured SSO answer; everything
 * else (unknown domain, misconfigured provider) is { enabled: false }. Rate-limited per IP.
 */
function ssoForCompany(company) {
  if (!company || !company.domainVerified || company.isActive === false) return null;
  const saml = company.sso?.saml;
  if (saml?.enabled && saml.entryPoint && saml.cert) {
    return { protocol: 'saml', startUrl: `${BACKEND_URL()}/api/auth/sso/saml/${encodeURIComponent(company._id)}/login` };
  }
  for (const cfg of [company.sso, company.settings?.sso]) {
    const provider = String(cfg?.provider || '').toLowerCase();
    if (cfg?.enabled && PROVIDERS[provider] && PROVIDERS[provider].clientId()) {
      return { protocol: 'oidc', startUrl: `${BACKEND_URL()}/api/auth/sso/${provider}` };
    }
  }
  return null;
}

const discoverLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 30 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Too many requests, please try again in a minute.' }),
});

router.get('/discover', discoverLimiter, async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    const domain = /^[^\s@]{1,64}@([a-z0-9.-]{1,253})$/.exec(email)?.[1];
    if (!domain) return res.json({ enabled: false });
    const { companies } = require('../../identity');
    const found = ssoForCompany(await companies.findByDomain(domain));
    return res.json(found ? { enabled: true, ...found } : { enabled: false });
  } catch (err) {
    logger.warn('[SSO] discover failed:', err.message);
    return res.json({ enabled: false });
  }
});

const exchangeLimiter = require('express-rate-limit')({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ message: 'Too many requests, please try again in a minute.' }),
});

/**
 * The phone/tablet app finishes an SSO sign-in (see ssoApp.js): it trades the one-time code
 * from oruinwan://sso?code=… plus its PKCE verifier for a session. Native clients get the
 * refresh token in the body, like every other app sign-in.
 */
router.post('/app/exchange', exchangeLimiter, async (req, res) => {
  try {
    const found = await ssoApp.redeemAppCode(req.body?.code, req.body?.verifier);
    if (!found) return res.status(400).json({ message: 'This sign-in has expired. Start it again.', code: 'SSO_CODE_INVALID' });
    const user = await users.findById(found.userId);
    if (!user || user.accountStatus === 'suspended' || user.accountStatus === 'deleted') {
      return res.status(403).json({ message: 'This account cannot sign in.', code: 'SSO_ACCOUNT_DISABLED' });
    }
    const session = await startSsoSession(req, res, found.userId, {
      method: found.method || 'sso',
      deviceId: found.deviceId || deviceIdFrom(req),
    });
    // Over the device limit: the app shows "sign out of one to continue" (POST /api/auth/signin/continue).
    if (session.pending) return res.status(session.status).json(session.pending);
    return res.json({
      message: 'SSO login success',
      accessToken: session.accessToken,
      ...(isNativeClient(req) ? { refreshToken: session.refreshToken } : {}),
      requiresPasswordSetup: false,
      user: { id: String(user._id), username: user.username, email: user.email, profilePicture: user.profilePicture || null },
    });
  } catch (err) {
    logger.error('[SSO] app exchange failed:', err.message);
    return res.status(500).json({ message: 'Sign-in failed. Try again.' });
  }
});

router.get('/:provider', (req, res) => {
  const { provider } = req.params;
  const cfg = PROVIDERS[provider];
  if (!cfg) return res.status(400).json({ message: `Unknown SSO provider: ${provider}` });

  
  const clientId = cfg.clientId();
  if (!clientId) {
    return res.status(501).json({
      message: `SSO provider '${provider}' is not configured. Set ${provider.toUpperCase()}_CLIENT_ID in environment.`
    });
  }

  
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

  // Started by the phone app: the callback sends it back to the app with a one-time code.
  const appChallenge = ssoApp.appChallengeFrom(req.query);
  if (appChallenge) {
    res.cookie(`sso_app_${provider}`, appChallenge, {
      httpOnly: true, sameSite: 'Lax', maxAge: 5 * 60 * 1000, secure: process.env.NODE_ENV === 'production',
    });
  } else {
    res.clearCookie(`sso_app_${provider}`);
  }

  // The callback is a top-level navigation without X-Device-Id: carry the client's device id in a cookie.
  const deviceId = deviceIdFrom(req, req.query.deviceId);
  if (deviceId) {
    res.cookie(`sso_device_${provider}`, deviceId, {
      httpOnly: true, sameSite: 'Lax', maxAge: 5 * 60 * 1000, secure: process.env.NODE_ENV === 'production',
    });
  }

  res.redirect(`${resolve(cfg.authUrl)}?${params.toString()}`);
});

router.get('/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const cfg = PROVIDERS[provider];
  if (!cfg) return res.redirect(`${FRONTEND_URL()}/login?error=unknown_provider`);

  const { code, state, error } = req.query;
  const appChallenge = req.cookies?.[`sso_app_${provider}`];
  const forApp = ssoApp.isChallenge(appChallenge);
  if (appChallenge) res.clearCookie(`sso_app_${provider}`);
  const fail = (reason) => res.redirect(forApp ? ssoApp.appRedirectWithError(reason) : `${FRONTEND_URL()}/login?error=${reason}`);

  if (error) {
    logger.error(`[SSO] ${provider} error:`, error);
    return fail(`sso_${provider}_failed`);
  }

  
  const storedState = req.cookies?.[`sso_state_${provider}`];
  if (!state || !storedState || state !== storedState) {
    logger.error(`[SSO] ${provider}: state mismatch — CSRF attempt?`);
    res.clearCookie(`sso_state_${provider}`);
    return fail('sso_state_mismatch');
  }
  res.clearCookie(`sso_state_${provider}`);

  try {
    const redirectUri = `${BACKEND_URL()}/api/auth/sso/${provider}/callback`;

    
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

    
    const userInfoRes = await axios.get(resolve(cfg.userInfoUrl), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = userInfoRes.data;

    
    const externalId = profile.sub || profile.id || profile.oid;
    const email = profile.email || profile.mail || profile.userPrincipalName;
    const name = profile.name || `${profile.givenName || ''} ${profile.surname || ''}`.trim() || profile.displayName;
    const picture = profile.picture || null;

    if (!email) {
      return fail('sso_no_email');
    }

    
    let user = await findBySso(provider, externalId);
    if (!user) {
      user = await users.findByEmail(email);
      if (user) {
        // Link the existing account to this SSO identity.
        user = await users.update(user._id, {
          sso: { provider, id: String(externalId) },
          ...(picture && !user.profilePicture ? { profilePicture: picture } : {}),
        });
      }
    }

    if (!user) {
      user = await users.create({
        username: name || email.split('@')[0],
        email: email.toLowerCase(),
        profilePicture: picture,
        authProvider: provider === 'google' ? 'google' : 'local',
        sso: { provider, id: String(externalId) },
        passwordHash: null,
        verified: true,
        accountStatus: 'active',
      });
    }

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
    } catch (_) {  }

    const deviceId = req.cookies?.[`sso_device_${provider}`];
    res.clearCookie(`sso_device_${provider}`);
    if (forApp) {
      // The app makes its own session with the code (POST /app/exchange): no cookie here.
      return res.redirect(await ssoApp.appRedirectWithCode({ userId: user._id, deviceId, method: `sso_${provider}`, challenge: appChallenge }));
    }
    const session = await startSsoSession(req, res, user._id, { method: `sso_${provider}`, deviceId });
    // Over the device limit: the web app finishes with the pending token (fragment only, never sent to a server).
    if (session.pending) return res.redirect(`${FRONTEND_URL()}/oauth-success#pending=${session.pending.pendingToken}`);
    return res.redirect(`${FRONTEND_URL()}/oauth-success#access=${session.accessToken}`);
  } catch (err) {
    logger.error(`[SSO] ${provider} callback error:`, err.response?.data || err.message);
    return fail(`sso_${provider}_failed`);
  }
});

module.exports = router;
module.exports.ssoForCompany = ssoForCompany;
