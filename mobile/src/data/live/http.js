// HTTP client for a self-hosted Oruinwan server.
//
// On Android and iOS, CapacitorHttp performs these requests natively, so the server needs no
// CORS entry for the app. `x-client-platform: android|ios` makes the server return refresh
// tokens in the JSON body (server/utils/cookieHelper.js) instead of a cross-site cookie.
import { secure } from '../../native/storage.js';
import { clientPlatform } from '../../native/index.js';
import { emit } from '../../lib/bus.js';

let base = '';
let tokens = null; // { access, refresh }
let refreshing = null;
// Bumped on sign-out, so a refresh that finishes afterwards can't write tokens back.
let generation = 0;

const HEADERS = { Accept: 'application/json', 'x-client-platform': clientPlatform };
export const NETWORK_MESSAGE = "Can't reach your server. Check your connection and try again.";

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
    this.code = data?.code || data?.error;
    this.network = status === 0;
  }
}

export function configure(server) {
  base = server.replace(/\/+$/, '');
}
export const serverUrl = () => base;
export const accessToken = () => tokens?.access || null;

export async function loadTokens() {
  try {
    tokens = JSON.parse((await secure.get('live.tokens')) || 'null');
  } catch {
    tokens = null;
  }
  return tokens;
}

export async function saveTokens(next) {
  tokens = next;
  await secure.set('live.tokens', next ? JSON.stringify(next) : null);
}

/** Turns a relative upload path from the server into a full URL. */
export function absolute(url) {
  if (!url) return null;
  if (/^(https?:|data:)/.test(url)) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

function messageFrom(data, status) {
  const text = typeof data === 'string' ? '' : data?.message || (typeof data?.error === 'string' && data.error.length > 3 ? data.error : '');
  if (text && !/^[A-Z_]+$/.test(text)) return text;
  if (status === 403) return "You don't have access to that.";
  if (status === 404) return "That couldn't be found. It may have been deleted.";
  if (status === 429) return 'Too many attempts. Wait a moment and try again.';
  if (status >= 500) return 'The server hit a problem. Try again in a moment.';
  return 'Something went wrong. Try again.';
}

async function send(method, url, body, auth) {
  const headers = { ...HEADERS };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && tokens?.access) headers.Authorization = `Bearer ${tokens.access}`;
  let res;
  try {
    res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(NETWORK_MESSAGE, 0, null);
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data };
}

export async function refreshSession() {
  if (!tokens?.refresh) throw new ApiError('Not signed in', 401, null);
  refreshing ||= (async () => {
    const gen = generation;
    const { res, data } = await send('POST', `${base}/api/auth/refresh`, { refreshToken: tokens.refresh }, false);
    if (gen !== generation) throw new ApiError('Signed out', 401, null);
    if (res.status === 401 || res.status === 403) {
      await saveTokens(null);
      emit('auth:expired');
      throw new ApiError('Your session ended. Please sign in again.', 401, data);
    }
    if (!res.ok || !data?.accessToken) throw new ApiError(messageFrom(data, res.status), res.status, data);
    // Refresh tokens rotate on every call; keep the new one.
    await saveTokens({ access: data.accessToken, refresh: data.refreshToken || tokens.refresh });
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/**
 * request('GET', '/workspaces/my') → parsed JSON. Throws ApiError with a readable message.
 * Retries once after refreshing an expired access token.
 */
export async function request(method, path, { body, query, auth = true, retry = true } = {}) {
  const url = new URL(`${base}/api${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const { res, data } = await send(method, url.toString(), body, auth);
  if (res.status === 401 && auth && retry && tokens?.refresh) {
    await refreshSession();
    return request(method, path, { body, query, auth, retry: false });
  }
  if (!res.ok) throw new ApiError(messageFrom(data, res.status), res.status, data);
  return data;
}

/** Waits for a token refresh that is already running, ignoring its outcome. */
export async function settleRefresh() {
  try {
    await refreshing;
  } catch {
    /* the refresh's own caller handles its error */
  }
}

/** Ends the local session: later refreshes are discarded and the tokens are deleted. */
export async function endSession() {
  generation += 1;
  await saveTokens(null);
}

export const api = {
  get: (path, query) => request('GET', path, { query }),
  post: (path, body, query) => request('POST', path, { body: body ?? {}, query }),
  put: (path, body) => request('PUT', path, { body: body ?? {} }),
  patch: (path, body, query) => request('PATCH', path, { body: body ?? {}, query }),
  del: (path, body) => request('DELETE', path, { body }),
};
