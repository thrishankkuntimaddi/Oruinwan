'use strict';

/**
 * Google credentials for Drive and Meet: either a pasted OAuth access token
 * (e.g. from the OAuth 2.0 Playground; they expire after about an hour) or a
 * service-account JSON key (Drive only — the account sees files shared with
 * its e-mail). A plain API key cannot read private files, so it is rejected.
 */

const crypto = require('crypto');
const axios = require('axios');
const { httpError } = require('./http');

const TOKEN_URL = process.env.GOOGLE_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token';
const cache = new Map(); // client_email|scope -> { token, exp }

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Parse and sanity-check a service-account key. */
function parseServiceAccount(raw) {
  let key;
  try { key = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { throw httpError(400, 'The service account key must be the JSON file Google gave you'); }
  if (!key || key.type !== 'service_account' || !key.client_email || !key.private_key) {
    throw httpError(400, 'That is not a service account key (it needs type "service_account", client_email and private_key)');
  }
  return key;
}

function signedJwt(key, scope, now = Math.floor(Date.now() / 1000)) {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({ iss: key.client_email, scope, aud: key.token_uri || TOKEN_URL, iat: now, exp: now + 3600 }));
  let sig;
  try {
    sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(key.private_key);
  } catch {
    throw httpError(400, 'The service account private key could not be read');
  }
  return `${head}.${claim}.${b64url(sig)}`;
}

async function serviceAccountToken(raw, scope) {
  const key = parseServiceAccount(raw);
  const id = `${key.client_email}|${scope}`;
  const hit = cache.get(id);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  try {
    const res = await axios.post(key.token_uri || TOKEN_URL, new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: signedJwt(key, scope),
    }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000 });
    const token = res.data?.access_token;
    if (!token) throw new Error('no access_token');
    cache.set(id, { token, exp: Date.now() + (Number(res.data.expires_in) || 3600) * 1000 });
    return token;
  } catch (err) {
    if (err.statusCode) throw err;
    throw httpError(502, `Google rejected the service account: ${err.response?.data?.error_description || err.response?.data?.error || err.message}`, 'GOOGLE_BAD_TOKEN');
  }
}

/** Bearer token for a connector ctx with `accessToken` and/or `serviceAccount` secrets. */
async function bearer(ctx, scope) {
  const token = ctx.secret('accessToken');
  if (token) return token;
  const sa = ctx.secret('serviceAccount');
  if (sa) return serviceAccountToken(sa, scope);
  throw httpError(400, 'Google needs an OAuth access token or a service account key', 'INTEGRATION_NOT_CONFIGURED');
}

/** Reject API keys (AIza…), which cannot read private files. */
function checkAccessToken(v) {
  if (/^AIza[0-9A-Za-z_-]{20,}$/.test(v)) throw httpError(400, 'That is an API key. API keys cannot read private files — paste an OAuth access token (ya29.…) or a service account key instead.');
}

module.exports = { bearer, parseServiceAccount, signedJwt, checkAccessToken, clearCache: () => cache.clear() };
