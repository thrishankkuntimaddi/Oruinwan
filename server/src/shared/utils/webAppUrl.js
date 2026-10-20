'use strict';

/**
 * The web app's public address (FRONTEND_URL), with no trailing slash: the start of every link
 * the server puts in an email or a redirect (verify email, reset password, invites, sign-in).
 *
 * A development server falls back to the local web app. A production server never does: it
 * refuses to start without a public FRONTEND_URL (server.js), so no email goes out with a
 * localhost link.
 */
function webAppUrl(env = process.env) {
  const value = String(env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  return value || 'http://localhost:3000';
}

/** Why FRONTEND_URL can't be used by a production server, or null when it's fine. */
function webAppUrlProblem(env = process.env) {
  const value = String(env.FRONTEND_URL || '').trim();
  if (!value) return 'FRONTEND_URL is not set';
  let url;
  try {
    url = new URL(value);
  } catch {
    return `FRONTEND_URL is not an address: ${value}`;
  }
  if (/^(localhost|127\.|0\.0\.0\.0|\[?::1\]?$)/.test(url.hostname)) return `FRONTEND_URL points at this machine (${value})`;
  if (url.protocol !== 'https:') return `FRONTEND_URL must start with https:// (${value})`;
  return null;
}

module.exports = { webAppUrl, webAppUrlProblem };
