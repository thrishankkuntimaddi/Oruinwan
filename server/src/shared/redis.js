'use strict';

/**
 * One shared Redis connection for the whole process (presence, huddle state,
 * job locks, and the Socket.IO adapter's publisher). Optional: when REDIS_URL
 * is not set every caller falls back to in-memory behaviour, which is correct
 * for exactly one server instance.
 *
 * Callers never hold the client at require time: they ask `getRedis()` when
 * they need it, so tests and single-instance deployments never open a socket.
 */

const logger = require('../../utils/logger');

let client = null;
let failed = false;

function isRedisConfigured(env = process.env) {
    return !!env.REDIS_URL;
}

/** Each process gets a stable id for locks and replication (hostname + pid + random). */
const INSTANCE_ID = `${require('os').hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 8)}`;

/**
 * The shared ioredis client, or null when Redis is not configured or the
 * connection could not be made. Connects lazily on first use.
 */
function getRedis() {
    if (client || failed || !isRedisConfigured()) return client;
    try {
        const { default: Redis } = require('ioredis');
        client = new Redis(process.env.REDIS_URL, {
            maxRetriesPerRequest: 2,
            enableReadyCheck: false,
            lazyConnect: false,
            enableOfflineQueue: true,
            connectionName: `oruinwan:${INSTANCE_ID}`,
        });
        client.on('error', (err) => logger.error('❌ [REDIS] client error:', err.message));
        client.on('ready', () => logger.info('✅ [REDIS] Shared client ready'));
    } catch (err) {
        failed = true;
        logger.error('⚠️  [REDIS] Could not create client, running in single-instance mode:', err.message);
    }
    return client;
}

/** A second connection for subscriptions (a subscribed ioredis client cannot run commands). */
function createSubscriber() {
    const base = getRedis();
    return base ? base.duplicate() : null;
}

async function closeRedis() {
    if (!client) return;
    const c = client;
    client = null;
    try { await c.quit(); } catch { c.disconnect(); }
}

/** Test hook: inject a fake client. */
function _setClientForTests(fake) {
    client = fake;
    failed = false;
}

module.exports = { getRedis, createSubscriber, closeRedis, isRedisConfigured, INSTANCE_ID, _setClientForTests };
