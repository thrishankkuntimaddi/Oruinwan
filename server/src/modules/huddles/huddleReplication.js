'use strict';

/**
 * Keeps every server instance's HuddleRegistry identical.
 *
 *   huddles:ops   Redis pub/sub channel; each local mutation is published as
 *                 { from: INSTANCE_ID, op } and applied by every other instance
 *   huddles:live  Redis hash huddleId -> serialized huddle, written by the
 *                 instance that made the change; a fresh instance restores
 *                 from it at boot (entries older than MAX_AGE are ignored)
 *
 * Without Redis nothing is attached and the registry stays process-local.
 */

const logger = require('../../../utils/logger');
const { getRedis, createSubscriber, INSTANCE_ID } = require('../../shared/redis');

const CHANNEL = 'huddles:ops';
const SNAPSHOT_KEY = 'huddles:live';
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

async function writeSnapshot(redis, registry, huddleId) {
    const huddle = registry.get(huddleId);
    if (huddle) {
        await redis.hset(SNAPSHOT_KEY, huddleId, JSON.stringify({ ...registry._serialize(huddle, true), updatedAt: Date.now() }));
    } else {
        await redis.hdel(SNAPSHOT_KEY, huddleId);
    }
}

async function restoreFromSnapshot(redis, registry) {
    const all = await redis.hgetall(SNAPSHOT_KEY);
    const fresh = [];
    const stale = [];
    for (const [huddleId, json] of Object.entries(all || {})) {
        try {
            const data = JSON.parse(json);
            if (Date.now() - (data.updatedAt || 0) > MAX_AGE_MS) stale.push(huddleId);
            else fresh.push(data);
        } catch {
            stale.push(huddleId);
        }
    }
    if (stale.length) await redis.hdel(SNAPSHOT_KEY, ...stale);
    return registry.restore(fresh);
}

/**
 * Attach replication to a registry. Resolves to a detach function.
 * @param {import('./huddleRegistry').HuddleRegistry} registry
 * @param {{ redis?: object, subscriber?: object, instanceId?: string }} [deps]  test injection
 */
async function attachHuddleReplication(registry, deps = {}) {
    const redis = deps.redis !== undefined ? deps.redis : getRedis();
    if (!redis) return () => {};
    const subscriber = deps.subscriber !== undefined ? deps.subscriber : createSubscriber();
    const instanceId = deps.instanceId || INSTANCE_ID;

    const huddleIdOf = (op) => (op.type === 'ensure' ? op.huddle.huddleId : op.huddleId);

    registry.onMutation = (op) => {
        const message = JSON.stringify({ from: instanceId, op });
        redis.publish(CHANNEL, message).catch((err) => logger.warn(`[HUDDLES] replicate publish failed: ${err.message}`));
        writeSnapshot(redis, registry, huddleIdOf(op)).catch((err) => logger.warn(`[HUDDLES] snapshot write failed: ${err.message}`));
    };

    const onMessage = (channel, message) => {
        if (channel !== CHANNEL) return;
        try {
            const { from, op } = JSON.parse(message);
            if (from === instanceId) return;
            registry.applyRemote(op);
        } catch (err) {
            logger.warn(`[HUDDLES] bad replication message: ${err.message}`);
        }
    };

    if (subscriber) {
        subscriber.on('message', onMessage);
        await subscriber.subscribe(CHANNEL);
    }

    try {
        const n = await restoreFromSnapshot(redis, registry);
        if (n) logger.info(`[HUDDLES] Restored ${n} live huddle(s) from the shared snapshot`);
    } catch (err) {
        logger.warn(`[HUDDLES] snapshot restore failed: ${err.message}`);
    }
    logger.info('✅ [HUDDLES] Replication attached — huddle state is shared across instances');

    return async () => {
        registry.onMutation = null;
        if (subscriber) {
            subscriber.off('message', onMessage);
            try { await subscriber.unsubscribe(CHANNEL); } catch { /* closing anyway */ }
        }
    };
}

module.exports = { attachHuddleReplication, writeSnapshot, restoreFromSnapshot, CHANNEL, SNAPSHOT_KEY };
