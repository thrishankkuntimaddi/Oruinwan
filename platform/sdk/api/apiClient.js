/**
 * platform/sdk/api/apiClient.js
 *
 * Chttrix Platform SDK — API Client
 *
 * Minimal, framework-agnostic HTTP client built on native fetch.
 * No axios dependency — compatible with web, Electron, and React Native.
 *
 * Phase: A2 — Foundation only. Full interceptor / retry logic is added
 * in a later phase when this client is integrated with the web and desktop apps.
 */

import { getAccessToken } from '../auth/tokenManager.js';

// ─── Default Headers ──────────────────────────────────────────────────────────

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

// ─── Core Request Function ────────────────────────────────────────────────────

/**
 * Send an HTTP request with automatic Authorization header injection.
 *
 * @param {string} method  - HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param {string} url     - Absolute or relative URL
 * @param {Object} [body]  - Request body (will be JSON-serialized)
 * @param {Object} [opts]  - Additional fetch options (headers, credentials, etc.)
 * @returns {Promise<Response>}
 */
export async function request(method, url, body = null, opts = {}) {
  const token = getAccessToken();

  const headers = {
    ...DEFAULT_HEADERS,
    ...opts.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const fetchOptions = {
    method: method.toUpperCase(),
    headers,
    credentials: opts.credentials ?? 'include',
    ...opts,
  };

  if (body !== null) {
    fetchOptions.body = JSON.stringify(body);
  }

  return fetch(url, fetchOptions);
}

// ─── Convenience Methods ──────────────────────────────────────────────────────

/** GET request */
export const get = (url, opts) => request('GET', url, null, opts);

/** POST request */
export const post = (url, body, opts) => request('POST', url, body, opts);

/** PUT request */
export const put = (url, body, opts) => request('PUT', url, body, opts);

/** PATCH request */
export const patch = (url, body, opts) => request('PATCH', url, body, opts);

/** DELETE request */
export const del = (url, opts) => request('DELETE', url, null, opts);

// ─── Default export ───────────────────────────────────────────────────────────

const apiClient = {
  request,
  get,
  post,
  put,
  patch,
  delete: del,
};

export default apiClient;
