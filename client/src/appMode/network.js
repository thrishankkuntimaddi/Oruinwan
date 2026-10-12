// How the web client talks to the user's server from inside an app.
//
// The app's own origin (app://oruinwan on desktop, https://localhost or capacitor://localhost
// on tablets) is never the server's, so the httpOnly refresh cookie the browser client relies
// on can't work. Instead every request to the server says which app it is (x-client-platform),
// which makes the server return the refresh token in the response body
// (server/utils/cookieHelper.js), exactly as for the phone app. The app keeps that token on the
// device and sends it back only to the endpoints that need it.
import axios from 'axios';
import api from '../services/api';

const TOKEN_KEY = 'oruinwan.refreshToken';
const SENDS_TOKEN = /^\/api\/auth\/(refresh|logout|logout-all|sessions\/others)\/?$/;
const ENDS_SESSION = /^\/api\/auth\/(logout|logout-all)\/?$/;

let origin = null;
let prefix = '';
let platform = 'desktop';

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage blocked: the session just won't survive a restart */
  }
}

/** The path under the server ("/api/…"), or null when the URL isn't the user's server. */
function serverPath(url) {
  try {
    const u = new URL(url, `${origin}${prefix}/`);
    if (u.origin !== origin || !u.pathname.startsWith(prefix)) return null;
    return u.pathname.slice(prefix.length) || '/';
  } catch {
    return null;
  }
}

/** Adds the refresh token to a JSON body (a string for fetch, an object for axios). */
function withToken(body) {
  const token = readToken();
  if (!token) return body;
  if (body == null || body === '') return JSON.stringify({ refreshToken: token });
  if (typeof body === 'string') {
    try {
      const data = JSON.parse(body);
      if (data && typeof data === 'object' && !Array.isArray(data) && !data.refreshToken) {
        return JSON.stringify({ ...data, refreshToken: token });
      }
    } catch {
      /* not JSON: leave it alone */
    }
    return body;
  }
  if (Object.getPrototypeOf(body) === Object.prototype && !body.refreshToken) return { ...body, refreshToken: token };
  return body;
}

function remember(path, ok, data) {
  if (ENDS_SESSION.test(path)) {
    if (ok) writeToken(null);
    return;
  }
  if (ok && data && typeof data.refreshToken === 'string') writeToken(data.refreshToken);
}

function patchFetch() {
  const realFetch = window.fetch.bind(window);
  window.fetch = async function oruinwanFetch(input, init) {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
    const path = url ? serverPath(url) : null;
    if (path == null) return realFetch(input, init);

    const options = { ...(init || {}) };
    const headers = new Headers(options.headers || (input instanceof Request ? input.headers : undefined));
    headers.set('x-client-platform', platform);
    const method = String(options.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (SENDS_TOKEN.test(path) && method !== 'GET' && !(input instanceof Request)) {
      options.body = withToken(options.body);
      if (!headers.has('content-type')) headers.set('content-type', 'application/json');
    }
    options.headers = headers;

    const res = await realFetch(input, options);
    if (path.startsWith('/api/auth/')) {
      const json = (res.headers.get('content-type') || '').includes('json');
      (json ? res.clone().json().catch(() => null) : Promise.resolve(null)).then((data) => remember(path, res.ok, data));
    }
    return res;
  };
}

function patchAxios(instance) {
  instance.interceptors.request.use((config) => {
    const path = serverPath(new URL(config.url || '', config.baseURL ? `${config.baseURL}/` : `${origin}${prefix}/`).href);
    if (path == null) return config;
    config.headers.set?.('x-client-platform', platform);
    if (!config.headers.set) config.headers['x-client-platform'] = platform;
    if (SENDS_TOKEN.test(path) && String(config.method || 'get').toLowerCase() !== 'get') {
      config.data = withToken(config.data ?? {});
    }
    config.oruinwanPath = path;
    return config;
  });
  instance.interceptors.response.use(
    (res) => {
      const path = res.config?.oruinwanPath;
      if (path?.startsWith('/api/auth/')) remember(path, true, res.data);
      return res;
    },
    (error) => Promise.reject(error),
  );
}

/** Call once, before anything talks to the server. */
export function installAppNetwork(server, appPlatformName) {
  const u = new URL(server);
  origin = u.origin;
  prefix = u.pathname.replace(/\/+$/, '');
  platform = appPlatformName;
  patchFetch();
  patchAxios(axios);
  patchAxios(api);
  // The session ended without a logout call (refresh rejected, password changed elsewhere).
  window.addEventListener('auth:force-logout', () => writeToken(null));
}

/** Forget the session on this device (used when switching servers). */
export function forgetSession() {
  writeToken(null);
  try {
    localStorage.removeItem('accessToken');
  } catch {
    /* ignore */
  }
}
