'use strict';

/**
 * Links the page opens in a new window (target="_blank", window.open). Addresses of the app
 * itself — "Open meeting page", a shared task link — stay in the app's own window; everything
 * else opens in the default browser.
 */

/** The in-app path (/workspace/…?…#…) when `url` is a page of the app at `pageOrigin`, else null. */
function inAppPath(url, pageOrigin) {
  if (!pageOrigin || typeof url !== 'string') return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!u.host || `${u.protocol}//${u.host}` !== pageOrigin) return null;
  const path = `${u.pathname || '/'}${u.search}${u.hash}`;
  // Same checks as the page's own navigate(): a path on this origin, never protocol-relative.
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  return path;
}

/** JavaScript that moves the page to `path` without a reload (React Router follows popstate). */
function navigateScript(path) {
  return `(() => { const p = ${JSON.stringify(path)}; if (location.pathname + location.search + location.hash !== p) {`
    + ' history.pushState({}, "", p); dispatchEvent(new PopStateEvent("popstate")); } })()';
}

/**
 * oruinwan://open/<page>?… — what the web's /open/<page> sends when someone clicks an email
 * button on a computer that has the app — as the in-app path /<page>?…, else null.
 * (oruinwan://open with no page opens the app's home.)
 */
const APP_LINK_SCHEME = 'oruinwan';
function pathFromAppLink(url) {
  if (typeof url !== 'string') return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== `${APP_LINK_SCHEME}:` || u.host !== 'open') return null;
  const path = `${u.pathname || '/'}${u.search}${u.hash}`;
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null;
  return path;
}

/** The app link in a command line (Windows and Linux pass it as an argument), else null. */
function appLinkInArgs(argv) {
  return (argv || []).find((a) => typeof a === 'string' && a.startsWith(`${APP_LINK_SCHEME}://`)) || null;
}

module.exports = { inAppPath, navigateScript, pathFromAppLink, appLinkInArgs, APP_LINK_SCHEME };
