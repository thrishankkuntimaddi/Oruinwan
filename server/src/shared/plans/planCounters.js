'use strict';

/**
 * Atomic counters and one-shot claims shared by every server instance.
 *
 *   Redis (REDIS_URL)     INCRBY / SET NX with an expiry
 *   MongoDB (connected)   findOneAndUpdate upsert $inc on `plancounters` (TTL index)
 *   neither               this process's memory (single-instance dev and tests)
 *
 * Used for the daily AI counters and for the huddle time-limit warnings, which
 * must fire once per call however many instances see it.
 */

const mongoose = require('mongoose');
const { getRedis } = require('../redis');

const counterSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    count: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
}, { versionKey: false });
counterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PlanCounter = mongoose.models.PlanCounter || mongoose.model('PlanCounter', counterSchema);

const memory = new Map(); // key -> { count, expiresAt }
let backendOverride = null;

function memoryGet(key) {
    const e = memory.get(key);
    if (!e) return 0;
    if (e.expiresAt <= Date.now()) { memory.delete(key); return 0; }
    return e.count;
}

function backend() {
    if (backendOverride) return backendOverride;
    const redis = getRedis();
    if (redis) return 'redis';
    if (mongoose.connection.readyState === 1) return 'mongo';
    return 'memory';
}

/** Add `by` to `key` (created with a `ttlSec` lifetime). Resolves to the new value. */
async function incr(key, by = 1, ttlSec = 86400) {
    const b = backend();
    if (b === 'redis') {
        const redis = getRedis();
        const n = await redis.incrby(key, by);
        if (n === by) await redis.expire(key, ttlSec);
        return Number(n);
    }
    if (b === 'mongo') {
        const doc = await PlanCounter.findOneAndUpdate(
            { key },
            { $inc: { count: by }, $setOnInsert: { expiresAt: new Date(Date.now() + ttlSec * 1000) } },
            { upsert: true, new: true, lean: true },
        );
        return Number(doc.count);
    }
    const n = memoryGet(key) + by;
    const prev = memory.get(key);
    memory.set(key, { count: n, expiresAt: prev && prev.expiresAt > Date.now() ? prev.expiresAt : Date.now() + ttlSec * 1000 });
    return n;
}

/** Current values of several keys (0 when unset). */
async function getMany(keys) {
    const b = backend();
    if (!keys.length) return [];
    if (b === 'redis') {
        const vals = await getRedis().mget(...keys);
        return vals.map((v) => Number(v) || 0);
    }
    if (b === 'mongo') {
        const docs = await PlanCounter.find({ key: { $in: keys }, expiresAt: { $gt: new Date() } }).lean();
        const byKey = new Map(docs.map((d) => [d.key, d.count]));
        return keys.map((k) => Number(byKey.get(k)) || 0);
    }
    return keys.map(memoryGet);
}

/** true when this caller is the first to claim `key` within `ttlSec`. */
async function claim(key, ttlSec = 3600) {
    const b = backend();
    if (b === 'redis') {
        const ok = await getRedis().set(`claim:${key}`, '1', 'EX', ttlSec, 'NX');
        return ok === 'OK';
    }
    if (b === 'mongo') {
        const n = await incr(`claim:${key}`, 1, ttlSec);
        return n === 1;
    }
    return (await incr(`claim:${key}`, 1, ttlSec)) === 1;
}

/** Tests: force a backend ('memory' | 'mongo' | 'redis') and clear memory. */
function _setBackendForTests(b) { backendOverride = b; }
function _resetMemory() { memory.clear(); }

module.exports = { incr, getMany, claim, PlanCounter, _setBackendForTests, _resetMemory };
