'use strict';

/**
 * Phones opening the website get the phone app's interface (the same one as the Android app,
 * built into dist/m/ from mobile/), not the web client's small-screen layout. The page they asked
 * for travels along as ?open=<path>, so an invitation or a shared message still opens.
 *
 * Stays on the web client: account pages that finish in the browser (verify email, reset
 * password, company invitations, SSO), and anyone who chose "Use the full website" (?web=1,
 * remembered in a cookie; ?web=0 goes back).
 */

const fs = require('fs');
const path = require('path');

const PHONE_UA = /Android.+Mobile|iPhone|iPod|Windows Phone|Opera Mini|IEMobile/i;
const WEB_ONLY = [
  '/verify-email', '/reset-password', '/forgot-password', '/accept-invite', '/set-password', '/oauth-success',
  '/sso', '/register-company', '/pending-verification', '/reactivate', '/docs', '/pricing', '/privacy', '/terms', '/status',
  '/employee', '/owner', '/admin', '/company',
];
const NEVER = /^\/(api|uploads|socket\.io|m|icons|assets|\.well-known)(\/|$)/;
const COOKIE = 'oru_web';

const isPhone = (ua) => PHONE_UA.test(String(ua || ''));

/** Where a page request should go instead, or null to serve it as it is. */
function phoneRedirect({ method, path: reqPath, query = {}, headers = {}, cookies = '' }) {
  if (method !== 'GET' && method !== 'HEAD') return null;
  if (NEVER.test(reqPath) || path.extname(reqPath)) return null;
  if (!/text\/html|\*\/\*/.test(String(headers.accept || ''))) return null;
  if (!isPhone(headers['user-agent'])) return null;
  if (query.web === '1' || (query.web !== '0' && new RegExp(`(?:^|;\\s*)${COOKIE}=1`).test(String(cookies)))) return null;
  if (WEB_ONLY.some((p) => reqPath === p || reqPath.startsWith(`${p}/`))) return null;
  const params = new URLSearchParams(query);
  params.delete('web');
  const rest = params.toString();
  const page = `${reqPath}${rest ? `?${rest}` : ''}`;
  return page === '/' ? '/m/' : `/m/?open=${encodeURIComponent(page)}`;
}

/** Express middleware: phones → /m/; serves /m/ (the phone app's index) for its pages. */
function phoneWebUi({ distDir }) {
  const phoneIndex = path.join(distDir, 'm', 'index.html');
  return (req, res, next) => {
    // ?web=1 / ?web=0: remember the choice for a year.
    if (req.query?.web === '1') res.cookie?.(COOKIE, '1', { maxAge: 365 * 864e5, sameSite: 'lax', secure: req.secure });
    else if (req.query?.web === '0') res.clearCookie?.(COOKIE);
    if (!fs.existsSync(phoneIndex)) return next();
    const to = phoneRedirect({ method: req.method, path: req.path, query: req.query, headers: req.headers, cookies: req.headers.cookie });
    if (to) {
      res.set('Cache-Control', 'no-store');
      res.set('Vary', 'User-Agent, Cookie');
      return res.redirect(302, to);
    }
    return next();
  };
}

module.exports = { phoneWebUi, phoneRedirect, isPhone };
