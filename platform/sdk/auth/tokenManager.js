/**
 * platform/sdk/auth/tokenManager.js
 *
 * Chttrix Platform SDK — Token Manager
 *
 * Centralized, framework-agnostic token management utilities.
 * Designed for use across web (localStorage), desktop (electron-store),
 * and mobile (AsyncStorage) by swapping the storage adapter.
 *
 * Phase: A2 — Foundation only. Storage adapter is localStorage by default.
 * Integration with client/ and server/ happens in a later phase.
 */

// ─── Storage Adapter ──────────────────────────────────────────────────────────
// Default: localStorage (browser / Electron renderer).
// Replace this object with a compatible adapter for React Native or Node contexts.

const storage = {
  get: (key) => {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  },
  set: (key, value) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  },
  remove: (key) => {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  },
};

// ─── Token Keys ───────────────────────────────────────────────────────────────

const TOKEN_KEYS = {
  ACCESS: 'accessToken',
  REFRESH: 'refreshToken',
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Retrieve the current access token.
 * @returns {string|null}
 */
export function getAccessToken() {
  return storage.get(TOKEN_KEYS.ACCESS);
}

/**
 * Retrieve the current refresh token.
 * @returns {string|null}
 */
export function getRefreshToken() {
  return storage.get(TOKEN_KEYS.REFRESH);
}

/**
 * Persist both tokens.
 * @param {Object} params
 * @param {string} params.accessToken
 * @param {string} [params.refreshToken]
 */
export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) storage.set(TOKEN_KEYS.ACCESS, accessToken);
  if (refreshToken) storage.set(TOKEN_KEYS.REFRESH, refreshToken);
}

/**
 * Remove all stored tokens (logout / session clear).
 */
export function clearTokens() {
  storage.remove(TOKEN_KEYS.ACCESS);
  storage.remove(TOKEN_KEYS.REFRESH);
}

/**
 * Check whether an access token is currently present.
 * @returns {boolean}
 */
export function hasAccessToken() {
  return Boolean(storage.get(TOKEN_KEYS.ACCESS));
}

// ─── Default export ───────────────────────────────────────────────────────────

const tokenManager = {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  hasAccessToken,
};

export default tokenManager;
