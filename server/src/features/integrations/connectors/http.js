'use strict';

/**
 * Shared HTTP helper for the token-based connectors: one axios call with a
 * timeout, and provider failures mapped to errors that are safe to show.
 *
 *   401          → 502 <CODE>_BAD_TOKEN   ("rejected the token")
 *   403          → 403 <CODE>_FORBIDDEN
 *   404          → 404 <CODE>_NOT_FOUND
 *   400/409/422  → 400 <CODE>_INVALID
 *   429          → 429 <CODE>_RATE_LIMITED
 *   other        → 502 <CODE>_ERROR
 */

const crypto = require('crypto');
const axios = require('axios');

const TIMEOUT_MS = 10_000;

function httpError(status, message, code) {
  return Object.assign(new Error(message), { statusCode: status, status, ...(code && { code }) });
}

/** Best-effort error text from the many shapes provider APIs use. */
function detailOf(err) {
  const d = err.response?.data;
  if (!d) return err.message;
  if (typeof d === 'string') return d.slice(0, 300);
  if (Array.isArray(d.errors) && d.errors.length) return d.errors.map(e => e.message || (typeof e === 'string' ? e : JSON.stringify(e))).join('; ');
  return d.error_description || d.error?.message || (typeof d.error === 'string' ? d.error : null)
    || d.message || d.error_summary || d.errorMessage || err.message;
}

function mapError(err, label, code) {
  if (err.statusCode) return err;
  const status = err.response?.status;
  const detail = String(detailOf(err) || '').slice(0, 300);
  if (status === 401) return httpError(502, `${label} rejected the token (401). Paste a new one in Settings → Integrations.`, `${code}_BAD_TOKEN`);
  if (status === 403) return httpError(403, `${label} denied access: ${detail || 'forbidden'}`, `${code}_FORBIDDEN`);
  if (status === 404) return httpError(404, `Not found in ${label} (or the token cannot see it)`, `${code}_NOT_FOUND`);
  if (status === 429) return httpError(429, `${label} rate limit reached. Try again later.`, `${code}_RATE_LIMITED`);
  if ([400, 409, 422].includes(status)) return httpError(400, `${label}: ${detail || 'invalid request'}`, `${code}_INVALID`);
  return httpError(502, `${label} request failed: ${detail || 'no response'}`, `${code}_ERROR`);
}

/**
 * @param {object} opts axios options plus { label, code }
 * @returns {Promise<any>} response data
 */
async function request({ label, code, ...opts }) {
  try {
    const res = await axios({ timeout: TIMEOUT_MS, maxRedirects: 3, ...opts });
    return res?.data;
  } catch (err) {
    throw mapError(err, label, code);
  }
}

/** https URL (plain http only for localhost), normalised without a trailing slash. */
function normalizeHttpsUrl(value, { name = 'URL', example = 'https://example.com' } = {}) {
  if (value === '' || value === null || value === undefined) return '';
  let u;
  try { u = new URL(String(value).trim()); } catch { throw httpError(400, `${name} must be a valid URL, e.g. ${example}`); }
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw httpError(400, `${name} must use https`);
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}${u.search}`;
}

function hmacHex(secret, body, algo = 'sha256') {
  return crypto.createHmac(algo, secret).update(body).digest('hex');
}

/** Constant-time comparison of two strings (false on length mismatch / empty). */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const header = (req, name) => {
  const v = typeof req.get === 'function' ? req.get(name) : req.headers?.[name.toLowerCase()];
  return v === undefined || v === null ? '' : String(v);
};

/** Trim and cap free text coming from a provider. */
const clip = (s, n = 500) => (s === undefined || s === null ? '' : String(s)).trim().slice(0, n);

module.exports = { request, mapError, httpError, normalizeHttpsUrl, hmacHex, safeEqual, header, clip, TIMEOUT_MS };
