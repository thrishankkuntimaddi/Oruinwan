'use strict';

/**
 * Shares live collaborative documents between server instances.
 *
 *   collab:ops   Redis pub/sub channel; messages { from, type, key, data }
 *                type 'update'        a Yjs update (base64)
 *                type 'awareness'     an awareness update (base64)
 *                type 'state-request' an instance just loaded `key`; holders answer with their full state
 *
 * Without Redis nothing is attached and documents stay process-local (correct
 * for a single instance).
 */

const logger = require('../../../utils/logger');
const { getRedis, createSubscriber, INSTANCE_ID } = require('../../shared/redis');

const CHANNEL = 'collab:ops';

/**
 * Attach replication to a registry. Resolves to a detach function.
 * @param {import('./collab.registry').CollabRegistry} registry
 * @param {{ redis?: object, subscriber?: object, instanceId?: string }} [deps]  test injection
 */
async function attachCollabReplication(registry, deps = {}) {
    const redis = deps.redis !== undefined ? deps.redis : getRedis();
    if (!redis) return () => {};
    const subscriber = deps.subscriber !== undefined ? deps.subscriber : createSubscriber();
    const instanceId = deps.instanceId || INSTANCE_ID;

    registry.publish = (message) => {
        redis.publish(CHANNEL, JSON.stringify({ from: instanceId, ...message }))
            .catch((err) => logger.warn(`[COLLAB] replicate publish failed: ${err.message}`));
    };

    const onMessage = (channel, raw) => {
        if (channel !== CHANNEL) return;
        try {
            const message = JSON.parse(raw);
            if (message.from === instanceId) return;
            registry.applyPeer(message);
        } catch (err) {
            logger.warn(`[COLLAB] bad replication message: ${err.message}`);
        }
    };

    if (subscriber) {
        subscriber.on('message', onMessage);
        await subscriber.subscribe(CHANNEL);
    }
    return async () => {
        registry.publish = null;
        if (subscriber) {
            subscriber.removeListener('message', onMessage);
            await subscriber.unsubscribe(CHANNEL).catch(() => {});
        }
    };
}

module.exports = { attachCollabReplication, CHANNEL };
