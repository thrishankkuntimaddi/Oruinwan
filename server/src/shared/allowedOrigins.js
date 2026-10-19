'use strict';

// The browser origins this server trusts: for CORS with credentials, and as places a
// Google/GitHub sign-in may send people back to. Read from the environment on each call,
// so tests and a changed env take effect without a restart.

// Local dev servers, only outside production: a live server must not accept logged-in
// requests from whatever page happens to run on a visitor's localhost.
const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8081',   // Expo web
  'http://localhost:19006',  // Expo web (classic)
  'http://localhost:19000',  // Expo DevTools
];

function originOf(url) {
  try {
    const u = new URL(String(url).trim());
    return /^https?:$/.test(u.protocol) ? u.origin : null;
  } catch {
    return null;
  }
}

function allowedOrigins(env = process.env) {
  const list = [
    ...(env.NODE_ENV === 'production' ? [] : DEV_ORIGINS),
    env.FRONTEND_URL,
    // Extra origins, comma-separated, e.g. the web app on another machine: http://100.64.0.10:3000
    ...(env.CORS_EXTRA_ORIGINS || '').split(','),
  ].map(originOf).filter(Boolean);
  return [...new Set(list)];
}

/** True when `url` is on a trusted origin (any path). */
function isAllowedOrigin(url, env = process.env) {
  const o = originOf(url);
  return Boolean(o) && allowedOrigins(env).includes(o);
}

module.exports = { allowedOrigins, isAllowedOrigin, originOf, DEV_ORIGINS };
