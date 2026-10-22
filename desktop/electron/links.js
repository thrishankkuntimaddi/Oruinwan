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

module.exports = { inAppPath, navigateScript };
