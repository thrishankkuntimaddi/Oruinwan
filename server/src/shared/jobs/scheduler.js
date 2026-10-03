'use strict';

/**
 * Background jobs that may run on any number of server instances but must
 * execute at most once per interval across the whole fleet.
 *
 * Every instance keeps its own timer; before each run it takes a Redis lock
 * (`SET job:<name> <instance> NX PX <ttl>`) whose TTL is just under the
 * interval, so whoever wins runs and everyone else skips until the next tick.
 * Without Redis there is no lock, which is right for a single instance.
 *
 * Jobs also respect PROCESS_ROLE (see ../processRole.js): an "api" or
 * "realtime" process never starts them, a "worker" runs only them.
 */

const logger = require('../../../utils/logger');
const { getRedis, INSTANCE_ID } = require('../redis');

const jobs = new Map(); // name -> { handle, stop }

/** Lock TTL: most of the interval, never below 5s, capped so a crashed holder frees a daily job within an hour. */
function lockTtlMs(intervalMs) {
    const MAX = 60 * 60 * 1000;
    return Math.min(Math.max(Math.floor(intervalMs * 0.9), 5000), MAX);
}

async function acquire(name, ttlMs, redis = getRedis()) {
    if (!redis) return true; // single instance: nothing to coordinate
    try {
        const ok = await redis.set(`job:${name}`, INSTANCE_ID, 'PX', ttlMs, 'NX');
        return ok === 'OK';
    } catch (err) {
        // Redis unreachable: better to run than to silently stop reminders fleet-wide.
        logger.warn(`[JOBS] Lock for "${name}" unavailable (${err.message}); running without it`);
        return true;
    }
}

/**
 * Run `run()` now if this instance wins the lock for `name`.
 * @returns {Promise<boolean>} whether the job ran here
 */
async function runExclusive(name, run, { ttlMs = 60_000, redis } = {}) {
    if (!(await acquire(name, ttlMs, redis))) return false;
    try {
        await run();
    } catch (err) {
        logger.error(`[JOBS] "${name}" failed:`, err && err.message ? err.message : err);
    }
    return true;
}

/**
 * Schedule a recurring job.
 * @param {object} opts
 * @param {string} opts.name            unique job id, used for the lock key and logs
 * @param {number} opts.intervalMs      how often to tick
 * @param {() => Promise<void>|void} opts.run
 * @param {number} [opts.initialDelayMs=0]   delay before the first tick
 * @param {number} [opts.lockTtlMs]     override the lock lifetime
 * @param {boolean} [opts.unref=true]   let the process exit while timers are pending
 * @returns {() => void} stop function
 */
function scheduleJob({ name, intervalMs, run, initialDelayMs = 0, lockTtlMs: ttlOverride, unref = true, redis }) {
    if (!name || !intervalMs || typeof run !== 'function') throw new Error('scheduleJob needs name, intervalMs and run');
    if (jobs.has(name)) {
        logger.warn(`[JOBS] "${name}" is already scheduled in this process; ignoring duplicate`);
        return jobs.get(name).stop;
    }
    const ttlMs = ttlOverride || lockTtlMs(intervalMs);
    let interval = null;
    let stopped = false;

    const tick = () => {
        if (stopped) return;
        runExclusive(name, run, { ttlMs, redis }).catch(() => {});
    };

    const first = setTimeout(() => {
        tick();
        interval = setInterval(tick, intervalMs);
        if (unref && interval.unref) interval.unref();
    }, initialDelayMs);
    if (unref && first.unref) first.unref();

    const stop = () => {
        stopped = true;
        clearTimeout(first);
        if (interval) clearInterval(interval);
        jobs.delete(name);
    };
    jobs.set(name, { stop });
    logger.info(`[JOBS] "${name}" scheduled every ${Math.round(intervalMs / 1000)}s (lock ${Math.round(ttlMs / 1000)}s)`);
    return stop;
}

function stopAllJobs() {
    for (const { stop } of [...jobs.values()]) stop();
}

function scheduledJobs() {
    return [...jobs.keys()];
}

module.exports = { scheduleJob, runExclusive, stopAllJobs, scheduledJobs, lockTtlMs };
