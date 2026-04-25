'use strict';

const _store = new Map();

function _pruneExpired() {
  const now = Date.now();
  for (const [key, entry] of _store) {
    if (now >= entry.expiresAt) {
      _store.delete(key);
    }
  }
}

const otpStore = {
  
  set(key, value, ttlMs = 5 * 60 * 1000) {
    _store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  },

  
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

  
  delete(key) {
    _store.delete(key);
  },
};

module.exports = otpStore;
