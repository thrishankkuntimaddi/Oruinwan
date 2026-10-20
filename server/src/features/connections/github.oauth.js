'use strict';

/**
 * "Connect GitHub" with GitHub's own OAuth sign-in (a GitHub OAuth app).
 *
 *   GITHUB_CONNECT_CLIENT_ID / GITHUB_CONNECT_CLIENT_SECRET   the OAuth app (falls back to
 *                                                              GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)
 *   GITHUB_CONNECT_REDIRECT_URI                               optional; default
 *                                                              <BACKEND_URL>/api/connections/github/callback
 *
 * Register that callback URL on the OAuth app. Without an app, the UI offers a personal access
 * token instead (GitHub's other real way to authorize), never a pretend sign-in.
 *
 * `state` is a short-lived signed token naming the person and workspace that started the flow,
 * so the callback (which arrives without our session) knows whose connection it is and can't be
 * pointed at someone else's.
 */

const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const SCOPES = ['repo', 'read:user'];
const STATE_TTL_SECONDS = 10 * 60;

const clientId = () => process.env.GITHUB_CONNECT_CLIENT_ID || process.env.GITHUB_CLIENT_ID || '';
const clientSecret = () => process.env.GITHUB_CONNECT_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || '';
const webBase = () => (process.env.GITHUB_OAUTH_URL || 'https://github.com').replace(/\/+$/, '');

function configured() {
  return Boolean(clientId() && clientSecret());
}

function stateKey() {
  const base = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || '';
  if (!base) throw new Error('ACCESS_TOKEN_SECRET is not set');
  return crypto.createHash('sha256').update(`${base}:oruinwan-connections-github`).digest();
}

function redirectUri(req) {
  if (process.env.GITHUB_CONNECT_REDIRECT_URI) return process.env.GITHUB_CONNECT_REDIRECT_URI;
  const base = (process.env.BACKEND_URL || (req ? `${req.protocol}://${req.get('host')}` : 'http://localhost:8080')).replace(/\/+$/, '');
  return `${base}/api/connections/github/callback`;
}

/** Where to send the person to approve access. `returnTo` is a path in the web app. */
function authorizeUrl(req, { workspaceId, userId, returnTo }) {
  const state = jwt.sign({ ws: String(workspaceId), sub: String(userId), rt: returnTo || null, n: crypto.randomBytes(8).toString('hex') }, stateKey(), {
    expiresIn: STATE_TTL_SECONDS, audience: 'github-connect',
  });
  const u = new URL(`${webBase()}/login/oauth/authorize`);
  u.searchParams.set('client_id', clientId());
  u.searchParams.set('redirect_uri', redirectUri(req));
  u.searchParams.set('scope', SCOPES.join(' '));
  u.searchParams.set('state', state);
  u.searchParams.set('allow_signup', 'false');
  return u.toString();
}

/** The person and workspace a callback belongs to, or null when the state is forged or expired. */
function readState(state) {
  try {
    const p = jwt.verify(String(state || ''), stateKey(), { audience: 'github-connect' });
    if (!p?.ws || !p?.sub) return null;
    return { workspaceId: p.ws, userId: p.sub, returnTo: typeof p.rt === 'string' ? p.rt : null };
  } catch {
    return null;
  }
}

/** Swap the one-time code for an access token. */
async function exchangeCode(req, code) {
  const res = await axios.post(`${webBase()}/login/oauth/access_token`, {
    client_id: clientId(),
    client_secret: clientSecret(),
    code: String(code),
    redirect_uri: redirectUri(req),
  }, { headers: { Accept: 'application/json' }, timeout: 10_000 });
  const data = res.data || {};
  if (!data.access_token) {
    throw Object.assign(new Error(data.error_description || data.error || 'GitHub did not return an access token'), { status: 400 });
  }
  return { token: data.access_token, scopes: String(data.scope || '').split(/[,\s]+/).filter(Boolean) };
}

module.exports = { configured, authorizeUrl, readState, exchangeCode, redirectUri, SCOPES };
