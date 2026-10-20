// Workspace invitation links. The server makes links like
//   https://<web>/join-workspace?token=<64 hex>
// (server/src/features/workspaces/workspace.controller.js). The phone app also accepts
//   https://<web>/join/<token>, https://<web>/invite/<token>,
//   oruinwan://join/<token>, oruinwan://join-workspace?token=<token>
// and a bare token (the "code"), so people can paste whatever they were sent.
// Company invitations (/accept-invite?token=…) create a company account; they open in the browser.

const TOKEN = /^[A-Za-z0-9_-]{16,256}$/;

/**
 * { kind: 'workspace', token } | { kind: 'company', url } | null
 * Any host is accepted: the token is checked by this app's own server, so a link copied from
 * a different domain (or a staging copy of the site) still works.
 */
export function parseInvite(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  if (TOKEN.test(raw)) return { kind: 'workspace', token: raw };

  let url;
  try {
    // "app.example.com/join-workspace?token=…" pasted without a scheme.
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  // oruinwan://join/<token>: the "host" is the first path segment.
  const path = `${url.protocol === 'oruinwan:' ? `/${url.host}` : ''}${url.pathname}`.replace(/\/+$/, '');
  const queryToken = url.searchParams.get('token');

  if (/\/accept-invite$/i.test(path) && queryToken) return { kind: 'company', url: url.toString() };
  if (/\/(join-workspace|join|invite)$/i.test(path) && queryToken && TOKEN.test(queryToken)) return { kind: 'workspace', token: queryToken };
  const m = path.match(/\/(?:join-workspace|join|invite)\/([^/]+)$/i);
  if (m) {
    const token = decodeURIComponent(m[1]);
    if (TOKEN.test(token)) return { kind: 'workspace', token };
  }
  return null;
}
