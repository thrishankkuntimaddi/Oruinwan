/**
 * platform/sdk/auth/tokenManager.js
 *
 * Oruinwan Platform SDK — Token Manager
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

// Web refresh tokens live only in the server's httpOnly `jwt` cookie; the
// client never stores a refresh token.
const TOKEN_KEYS = {
  ACCESS: 'accessToken',
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
 * Persist the access token.
 * @param {Object} params
 * @param {string} params.accessToken
 */
export function setTokens({ accessToken }) {
  if (accessToken) storage.set(TOKEN_KEYS.ACCESS, accessToken);
}

/**
 * Remove all stored tokens (logout / session clear).
 */
export function clearTokens() {
  storage.remove(TOKEN_KEYS.ACCESS);
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
  setTokens,
  clearTokens,
  hasAccessToken,
};

export default tokenManager;
