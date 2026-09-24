/**
 * Shared axios instance: attaches the bearer token and platform header,
 * honours x-access-token, and transparently refreshes once on 401.
 */
import axios from 'axios';
import { API_URL } from './config';
import { CLIENT_PLATFORM, loadTokens, getAccessTokenSync, setTokens, refreshSession } from './tokens';

const http = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'x-client-platform': CLIENT_PLATFORM },
});

const NO_REFRESH = ['/auth/login', '/auth/signup', '/auth/refresh', '/auth/logout'];

http.interceptors.request.use(async (config) => {
  await loadTokens();
  const token = getAccessTokenSync();
  config.headers = config.headers || {};
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['x-client-platform'] = CLIENT_PLATFORM;
  return config;
});

function captureHeaderToken(res) {
  const t = res?.headers?.['x-access-token'];
  if (t) setTokens({ accessToken: t }).catch(() => {});
}

http.interceptors.response.use(
  (res) => {
    captureHeaderToken(res);
    return res;
  },
  async (err) => {
    const { config, response } = err;
    captureHeaderToken(response);
    const url = config?.url || '';
    if (
      response?.status === 401 &&
      config && !config._retried &&
      !NO_REFRESH.some((p) => url.includes(p))
    ) {
      config._retried = true;
      const token = await refreshSession(); // AuthExpiredError propagates → caller + auth:expired event
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
      return http(config);
    }
    return Promise.reject(err);
  },
);

/** Human-readable message from an axios error. */
export function errorMessage(err, fallback = 'Something went wrong') {
  if (!err) return fallback;
  if (err.response?.data?.message) return err.response.data.message;
  if (err.response?.data?.error && typeof err.response.data.error === 'string') return err.response.data.error;
  if (!err.response && (err.code === 'ECONNABORTED' || err.message === 'Network Error')) {
    return 'Network error — check your connection';
  }
  return err.message || fallback;
}

export function isNetworkError(err) {
  return !!err && !err.response && err.name !== 'AuthExpiredError';
}

export default http;
