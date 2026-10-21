'use strict';

// Short-lived codes, attempt counters and verification proofs.
// With REDIS_URL set, everything lives in Redis so every server instance sees the same
// codes and limits. Without it, the data stays in this process (correct for one instance).
// If Redis is configured but unreachable, calls throw: sign-in and sign-up fail closed.

const { getRedis } = require('../redis');

const PREFIX = 'otp:';
const _store = new Map(); // fallback: key -> { value, expiresAt }

function pruneLocal() {
  const now = Date.now();
  for (const [key, entry] of _store) {
    if (now >= entry.expiresAt) _store.delete(key);
  }
}

const otpStore = {
  async set(key, value, ttlMs = 5 * 60 * 1000) {
    const redis = getRedis();
    if (redis) {
      await redis.set(PREFIX + key, JSON.stringify(value), 'PX', Math.max(1, Math.round(ttlMs)));
      return;
    }
    _store.set(key, { value, expiresAt: Date.now() + ttlMs });
  },

  async get(key) {
    const redis = getRedis();
    if (redis) {
      const raw = await redis.get(PREFIX + key);
      return raw === null ? null : JSON.parse(raw);
    }
    pruneLocal();
    const entry = _store.get(key);
    if (!entry) return null;
    if (Date.now() >= entry.expiresAt) {
      _store.delete(key);
      return null;
    }
    return entry.value;
  },

  /** Reads and deletes in one step: only one caller ever gets the value (single-use tokens). */
  async take(key) {
    const redis = getRedis();
    if (redis) {
      const k = PREFIX + key;
      const [[getErr, raw], [delErr]] = await redis.multi().get(k).del(k).exec();
      if (getErr) throw getErr;
      if (delErr) throw delErr;
      return raw === null ? null : JSON.parse(raw);
    }
    pruneLocal();
    const entry = _store.get(key);
    _store.delete(key);
    if (!entry || Date.now() >= entry.expiresAt) return null;
    return entry.value;
  },

  async delete(key) {
    const redis = getRedis();
    if (redis) {
      await redis.del(PREFIX + key);
      return;
    }
    _store.delete(key);
  },

  /**
   * Adds 1 to a counter and returns the new value. The counter expires ttlMs after it is
   * first created. The increment is atomic, so parallel requests cannot skip a limit.
   */
  async incr(key, ttlMs) {
    const redis = getRedis();
    if (redis) {
      const k = PREFIX + key;
      const [[err, count]] = await redis.multi().incr(k).pexpire(k, Math.max(1, Math.round(ttlMs)), 'NX').exec();
      if (err) throw err;
      return count;
    }
    pruneLocal();
    const entry = _store.get(key);
    const count = entry && Date.now() < entry.expiresAt ? entry.value + 1 : 1;
    _store.set(key, { value: count, expiresAt: entry && Date.now() < entry.expiresAt ? entry.expiresAt : Date.now() + ttlMs });
    return count;
  },
};

module.exports = otpStore;
