'use strict';

/**
 * "Continue with Google" for the desktop app.
 *
 * Google doesn't allow its sign-in inside an app's own window, so this opens the person's normal
 * browser and listens on a one-off local address (http://127.0.0.1:<random port>/callback) for
 * Google to send them back to. This is Google's documented flow for desktop apps, with PKCE so a
 * code caught by anything else is useless.
 *
 * It resolves with { code, codeVerifier, redirectUri }; the page hands those to the server
 * (/api/auth/google/desktop-token), which holds the client secret and swaps the code for an ID token.
 */

const crypto = require('node:crypto');
const http = require('node:http');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TIMEOUT_MS = 5 * 60 * 1000;

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function page(title, message) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0c0c0c;color:#ece6dc;
    font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
  main{max-width:360px;padding:32px;text-align:center}
  h1{font-size:20px;margin:0 0 8px}
  p{margin:0;color:#a59e93}
</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;
}

let active = null;

/**
 * @param {{ clientId: string, openExternal: (url: string) => boolean, focusApp: () => void }} opts
 */
function googleSignIn({ clientId, openExternal, focusApp }) {
  // A second click while the browser is still open starts over.
  if (active) active.cancel('restarted');

  return new Promise((resolve, reject) => {
    const state = base64url(crypto.randomBytes(24));
    const codeVerifier = base64url(crypto.randomBytes(48));
    const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());
    let redirectUri = '';
    let settled = false;

    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/callback') {
        res.writeHead(404).end();
        return;
      }
      const send = (status, title, message) => {
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(page(title, message));
      };
      if (url.searchParams.get('state') !== state) {
        send(400, 'Sign-in link expired', 'Go back to Oruinwan and choose Continue with Google again.');
        return;
      }
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      if (error || !code) {
        send(200, 'Sign-in cancelled', 'You can close this tab and return to Oruinwan.');
        finish(Object.assign(new Error(error === 'access_denied' ? 'Cancelled' : 'Google sign-in failed'), { code: error === 'access_denied' ? 'CANCELLED' : 'FAILED' }));
        return;
      }
      send(200, 'You’re signed in', 'You can close this tab and return to Oruinwan.');
      finish(null, { code, codeVerifier, redirectUri });
    });

    const timer = setTimeout(() => finish(Object.assign(new Error('Google sign-in timed out. Try again.'), { code: 'TIMEOUT' })), TIMEOUT_MS);

    function finish(err, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      active = null;
      // Let the browser receive the page before the server goes away.
      setTimeout(() => server.close(), 1000);
      server.closeAllConnections?.();
      if (!err) focusApp();
      if (err) reject(err);
      else resolve(value);
    }

    active = { cancel: (why) => finish(Object.assign(new Error('Cancelled'), { code: 'CANCELLED', why })) };

    server.on('error', (err) => finish(Object.assign(new Error(`Couldn't start Google sign-in: ${err.message}`), { code: 'FAILED' })));
    server.listen(0, '127.0.0.1', () => {
      redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
      const auth = new URL(AUTH_URL);
      auth.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state,
        prompt: 'select_account',
      }).toString();
      if (!openExternal(auth.toString())) {
        finish(Object.assign(new Error("Couldn't open your browser"), { code: 'FAILED' }));
      }
    });
  });
}

module.exports = { googleSignIn };
