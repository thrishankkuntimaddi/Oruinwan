'use strict';

/**
 * SAML 2.0 SSO routes, mounted under /api/auth/sso/saml (behind the `sso` flag).
 *
 *   GET    /config                  company admin: current IdP settings + SP URLs
 *   PUT    /config                  company admin: { entryPoint, cert, issuer, enabled?, jitProvisioning? }
 *   DELETE /config                  company admin: remove SAML for the company
 *   GET    /:companyId/metadata     SP metadata XML (give this to the IdP)
 *   GET    /:companyId/login        start sign-in (redirect to the IdP)
 *   POST   /:companyId/acs          Assertion Consumer Service (IdP posts SAMLResponse here)
 */

const express = require('express');
const logger = require('../../../utils/logger');
const requireAuth = require('../../shared/middleware/auth');
const requireCompanyAdmin = require('../../shared/middleware/requireCompanyAdmin');
const AuditLog = require('../../../models/AuditLog');
const saml = require('./saml.service');

const router = express.Router();

const FRONTEND_URL = () => require('../../shared/utils/webAppUrl').webAppUrl();
const identity = () => require('../../identity');
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

// A full session (refresh cookie + session row + device row), like password/Google sign-in.
const startSsoSession = (...args) => require('../auth/auth.controller').startSsoSession(...args);
const { deviceIdFrom } = require('../devices/devices.service');
const ssoApp = require('./ssoApp');

function audit(fields) {
  return AuditLog.create({ category: 'security', severity: 'info', resource: 'Company', ...fields })
    .catch((err) => logger.warn({ err: err.message }, '[SAML] audit write failed'));
}

async function loadCompanySaml(companyId) {
  if (!ID_RE.test(String(companyId || ''))) return { company: null, config: null };
  const company = await identity().companies.findById(companyId);
  return { company, config: company?.sso?.saml || null };
}

// ── Admin configuration ──────────────────────────────────────────────────

router.get('/config', requireAuth, requireCompanyAdmin, async (req, res) => {
  if (!req.companyId) return res.status(400).json({ message: 'You are not part of a company' });
  const { config } = await loadCompanySaml(req.companyId);
  return res.json(saml.describeConfig(req.companyId, config));
});

router.put('/config', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    if (!req.companyId) return res.status(400).json({ message: 'You are not part of a company' });
    const next = saml.validateConfig(req.body || {});
    const company = await identity().companies.findById(req.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    const stored = { ...next, updatedBy: String(req.user.sub), updatedAt: new Date().toISOString() };
    await identity().companies.update(req.companyId, { sso: { ...(company.sso || {}), saml: stored } });
    await audit({
      userId: req.user.sub, companyId: req.companyId, action: 'security.saml_configured', resourceId: req.companyId,
      description: `SAML SSO ${stored.enabled ? 'enabled' : 'saved (disabled)'} — IdP ${stored.issuer}`,
      ipAddress: req.ip, userAgent: req.headers['user-agent'], severity: 'warning',
    });
    return res.json(saml.describeConfig(req.companyId, stored));
  } catch (err) {
    if (err instanceof saml.SamlError) return res.status(err.status).json({ message: err.message, code: err.code });
    logger.error('[SAML] save config error:', err);
    return res.status(500).json({ message: 'Failed to save SAML settings' });
  }
});

router.delete('/config', requireAuth, requireCompanyAdmin, async (req, res) => {
  try {
    if (!req.companyId) return res.status(400).json({ message: 'You are not part of a company' });
    const company = await identity().companies.findById(req.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    const sso = { ...(company.sso || {}) };
    delete sso.saml;
    await identity().companies.update(req.companyId, { sso });
    await audit({
      userId: req.user.sub, companyId: req.companyId, action: 'security.saml_removed', resourceId: req.companyId,
      description: 'SAML SSO removed', ipAddress: req.ip, userAgent: req.headers['user-agent'], severity: 'warning',
    });
    return res.json({ message: 'SAML SSO removed', ...saml.describeConfig(req.companyId, null) });
  } catch (err) {
    logger.error('[SAML] delete config error:', err);
    return res.status(500).json({ message: 'Failed to remove SAML settings' });
  }
});

// ── Service Provider endpoints ───────────────────────────────────────────

router.get('/:companyId/metadata', async (req, res) => {
  try {
    const { company, config } = await loadCompanySaml(req.params.companyId);
    if (!company) return res.status(404).json({ message: 'Company not found' });
    res.type('application/samlmetadata+xml');
    return res.send(saml.metadataXml(company._id, config));
  } catch (err) {
    if (err instanceof saml.SamlError) return res.status(err.status).json({ message: err.message, code: err.code });
    logger.error('[SAML] metadata error:', err);
    return res.status(500).json({ message: 'Failed to build metadata' });
  }
});

router.get('/:companyId/login', async (req, res) => {
  // Started by the phone app (client=app&appChallenge=…): it gets sent back to the app (ssoApp.js).
  const appChallenge = ssoApp.appChallengeFrom(req.query);
  const fail = (reason) => res.redirect(appChallenge ? ssoApp.appRedirectWithError(reason) : `${FRONTEND_URL()}/login?error=${reason}`);
  try {
    const { company, config } = await loadCompanySaml(req.params.companyId);
    if (!company || !config?.enabled) return fail('sso_saml_not_configured');
    const relayState = ssoApp.encodeRelayState(deviceIdFrom(req, req.query.deviceId), appChallenge);
    const url = await saml.buildSaml(company._id, config).getAuthorizeUrlAsync(relayState, req.get('host'), {});
    return res.redirect(url);
  } catch (err) {
    logger.error('[SAML] login error:', err.message);
    return fail('sso_saml_failed');
  }
});

router.post('/:companyId/acs', express.urlencoded({ extended: false, limit: '2mb' }), async (req, res) => {
  const companyId = req.params.companyId;
  // RelayState carries the client's device id from /login, and the app's challenge when the app started it.
  const relay = ssoApp.decodeRelayState(req.body?.RelayState);
  const fail = (reason) => res.redirect(relay.challenge ? ssoApp.appRedirectWithError(reason) : `${FRONTEND_URL()}/login?error=${reason}`);
  try {
    const { company, config } = await loadCompanySaml(companyId);
    if (!company || !config?.enabled) return fail('sso_saml_not_configured');
    const SAMLResponse = req.body?.SAMLResponse;
    if (typeof SAMLResponse !== 'string' || !SAMLResponse) return fail('sso_saml_failed');

    const { profile } = await saml.buildSaml(company._id, config).validatePostResponseAsync({ SAMLResponse });
    const who = saml.identityFromProfile(profile, config.issuer);
    const user = await saml.resolveUser({ company, saml: config, identity: who });

    await AuditLog.create({
      userId: user._id, companyId: String(company._id), action: 'auth.sso_login', resource: 'User', resourceId: user._id,
      description: 'SSO login via SAML', ipAddress: req.ip, userAgent: req.headers['user-agent'], category: 'auth', severity: 'info',
    }).catch(() => {});

    if (relay.challenge) {
      // The app makes its own session with the code (POST /api/auth/sso/app/exchange).
      return res.redirect(await ssoApp.appRedirectWithCode({ userId: user._id, deviceId: relay.deviceId, method: 'sso_saml', challenge: relay.challenge }));
    }
    // (see deviceIdFrom for the allowed device id format)
    const { accessToken, pending } = await startSsoSession(req, res, user._id, { method: 'sso_saml', deviceId: relay.deviceId });
    if (pending) return res.redirect(`${FRONTEND_URL()}/oauth-success#pending=${pending.pendingToken}`);
    return res.redirect(`${FRONTEND_URL()}/oauth-success#access=${accessToken}`);
  } catch (err) {
    const code = err instanceof saml.SamlError ? err.code : 'invalid_response';
    logger.warn({ companyId, code, err: err.message }, '[SAML] ACS rejected');
    return fail(`sso_saml_${code}`);
  }
});

module.exports = router;
