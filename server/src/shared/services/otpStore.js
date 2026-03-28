/**
 * OTP Store — Abstracted In-Memory Implementation
 *
 * Provides a clean interface for OTP storage with built-in TTL.
 * All OTP operations in the codebase go through this module.
 *
 * Current backend: In-memory Map with TTL (single-instance safe).
 *
 * 🔄 To swap to Redis later — ONLY change this file:
 *   Replace the Map implementation below with Redis calls.
 *   No other file needs to change.
 *
 * Interface contract:
 *   set(key, value, ttlMs) → void
 *   get(key)               → value | null
 *   delete(key)            → void
 *
 * @module shared/services/otpStore
 */

'use strict';

// Internal store: key → { value, expiresAt }
const _store = new Map();

/**
 * Prune expired entries (called lazily on every get).
 * Avoids a separate GC timer while still preventing unbounded growth.
 */
function _pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of _store) {
    if (now >= entry.expiresAt) {
      _store.delete(key);
    }
  }
}

const otpStore = {
  /**
   * Store a value under key with a TTL.
   * @param {string} key    - Unique key (e.g. email or phone)
   * @param {*}      value  - Any serialisable value
   * @param {number} ttlMs  - Time-to-live in milliseconds (default: 5 min)
   */
  set(key, value, ttlMs = 5 * 60 * 1000) {
    _store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  },

  /**
   * Retrieve a stored value. Returns null if missing or expired.
   * @param {string} key
   * @returns {*|null}
   */
  get(key) {
    _pruneExpired();
    const entry = _store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      _store.delete(key);
      return null;
    }
    return entry.value;
  },

  /**
   * Remove a key explicitly (e.g. after successful verification).
   * @param {string} key
   */
  delete(key) {
    _store.delete(key);
  },
};

module.exports = otpStore;
