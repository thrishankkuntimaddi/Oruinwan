// Email buttons link to https://<web>/open/<page> (server: appOpenLink). Android hands those
// to the app (App Links); the web page can also pass oruinwan://open/<page>. This turns either
// into the plain link the app already understands (https://<web>/<page>), plus the page path.

/** { url, page } for an /open link, else null. `page` is the path with its query, e.g. "/notifications". */
export function unwrapOpenLink(input) {
  if (typeof input !== 'string') return null;
  let u;
  try {
    u = new URL(input);
  } catch {
    return null;
  }
  let page;
  if (u.protocol === 'oruinwan:' && u.host === 'open') page = u.pathname || '/';
  else if ((u.protocol === 'https:' || u.protocol === 'http:') && (u.pathname === '/open' || u.pathname.startsWith('/open/'))) page = u.pathname.slice('/open'.length) || '/';
  else return null;
  if (!page.startsWith('/') || page.startsWith('//')) return null;
  const rest = `${page}${u.search}${u.hash}`;
  // oruinwan://open/<page> becomes oruinwan://<page> (the form the app's link parsers read).
  const url = u.protocol === 'oruinwan:' ? `oruinwan:/${rest}` : `${u.protocol}//${u.host}${rest}`;
  return { url, page: rest };
}

/**
 * The screen for an app page the other link handlers don't cover: [tab] or [tab, screen].
 * null means just open the app where it is.
 */
export function screenForPage(page) {
  const path = String(page || '/').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  if (path === '/notifications' || path.endsWith('/activity')) return ['activity'];
  if (path === '/settings/security') return ['settings.security'];
  if (path === '/settings/notifications') return ['settings.notifications'];
  if (path.startsWith('/settings')) return ['settings'];
  if (path === '/tasks' || /^\/workspace\/[^/]+\/tasks$/.test(path)) return ['tasks'];
  if (path === '/huddles' || /^\/workspace\/[^/]+\/huddles$/.test(path)) return ['huddles'];
  return null;
}
