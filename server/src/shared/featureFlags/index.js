'use strict';

/**
 * Release feature flags.
 *
 * Half-built areas stay hidden from normal users until they are real. A flag is
 * off unless it is listed in FEATURES_ENABLED (comma separated, or "all"), e.g.
 *   FEATURES_ENABLED=billing,sso
 *
 * Launched features are on by default (DEFAULT_ON) and can still be switched
 * off with FEATURES_DISABLED (comma separated), e.g. FEATURES_DISABLED=integrations.
 *
 * The client reads the resolved map from GET /api/flags; server routes guard
 * themselves with requireFlag(name) so a hidden feature cannot be reached by URL.
 */

const FLAGS = Object.freeze({
  billing: 'Billing & plan pages, payment methods and upgrades (no payment provider yet)',
  sso: 'Domain & SSO settings and the /api/auth/sso login flow',
  integrations: 'Third-party integrations (Apps → Integrations, settings and channel integration tabs)',
  community: 'Public community page (content is still placeholder)',
});

const FLAG_NAMES = Object.freeze(Object.keys(FLAGS));

// Launched: GitHub, Jira, Zoom and the token-based connectors are real (docs/integrations.md).
// SSO: company sign-in (OIDC/SAML) only starts for companies that configured it; /discover
// answers { enabled: false } for everyone else (docs/api/security.md).
const DEFAULT_ON = Object.freeze(['integrations', 'sso']);

function parseEnabled(raw) {
  const list = String(raw || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.includes('all')) return new Set(FLAG_NAMES);
  return new Set(list.filter((name) => FLAG_NAMES.includes(name)));
}

/** Resolve every flag to a boolean. Reads the env on each call so tests and restarts see changes. */
function getFlags(env = process.env) {
  const enabled = parseEnabled(env.FEATURES_ENABLED);
  const disabled = parseEnabled(env.FEATURES_DISABLED);
  DEFAULT_ON.forEach((name) => enabled.add(name));
  return Object.fromEntries(FLAG_NAMES.map((name) => [name, enabled.has(name) && !disabled.has(name)]));
}

function isEnabled(name, env = process.env) {
  if (!FLAG_NAMES.includes(name)) {
    throw new Error(`Unknown feature flag "${name}"`);
  }
  return getFlags(env)[name];
}

/** Express middleware: respond 404 as if the route did not exist while the flag is off. */
function requireFlag(name) {
  if (!FLAG_NAMES.includes(name)) {
    throw new Error(`Unknown feature flag "${name}"`);
  }
  return function featureFlagGuard(req, res, next) {
    if (isEnabled(name)) return next();
    return res.status(404).json({
      success: false,
      code: 'FEATURE_DISABLED',
      message: 'This feature is not available yet.',
    });
  };
}

module.exports = { FLAGS, FLAG_NAMES, DEFAULT_ON, getFlags, isEnabled, requireFlag };
