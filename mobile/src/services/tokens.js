/**
 * In-memory access/refresh token state backed by SecureStore, plus the
 * single-flight refresh used by the HTTP client and the socket.
 */
import axios from 'axios';
import { Platform } from 'react-native';
import { API_URL } from './config';
import {
  getToken, saveToken, removeToken,
  getRefreshToken, saveRefreshToken, removeRefreshToken,
} from './storage';
import { emit } from './events';

let accessToken = null;
let refreshToken = null;
let loadPromise = null;
let refreshPromise = null;

export const CLIENT_PLATFORM = Platform.OS; // 'ios' | 'android' | 'web'

export function loadTokens() {
  if (!loadPromise) {
    loadPromise = Promise.all([getToken(), getRefreshToken()]).then(([a, r]) => {
      accessToken = a || null;
      refreshToken = r || null;
    });
  }
  return loadPromise;
}

export function getAccessTokenSync() { return accessToken; }
export function getRefreshTokenSync() { return refreshToken; }

export async function setTokens({ accessToken: a, refreshToken: r } = {}) {
  await loadTokens();
  if (a && a !== accessToken) {
    accessToken = a;
    await saveToken(a);
    emit('token', a);
  }
  if (r && r !== refreshToken) {
    refreshToken = r;
    await saveRefreshToken(r);
  }
}

export async function clearTokens() {
  accessToken = null;
  refreshToken = null;
  loadPromise = Promise.resolve();
  await Promise.all([removeToken(), removeRefreshToken()]);
}

export class AuthExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'AuthExpiredError';
  }
}

/**
 * Exchange the refresh token for a new pair. Concurrent callers share one
 * request. Rejects with AuthExpiredError when the server refuses (→ logout);
 * network failures reject with the original error (session kept).
 */
export function refreshSession() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    await loadTokens();
    try {
      const { data } = await axios.post(
        `${API_URL}/auth/refresh`,
        refreshToken ? { refreshToken } : {},
        {
          timeout: 15000,
          withCredentials: true,
          headers: { 'Content-Type': 'application/json', 'x-client-platform': CLIENT_PLATFORM },
        },
      );
      if (!data?.accessToken) throw new AuthExpiredError('Refresh returned no token');
      await setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data.accessToken;
    } catch (err) {
      const status = err?.response?.status;
      if (err instanceof AuthExpiredError || status === 401 || status === 403) {
        emit('auth:expired');
        throw new AuthExpiredError();
      }
      throw err;
    }
  })().finally(() => { refreshPromise = null; });
  return refreshPromise;
}
