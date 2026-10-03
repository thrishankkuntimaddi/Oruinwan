'use strict';

/**
 * Event bus entry point.
 *
 *   const { publish } = require('../shared/events');          // producers
 *   startOutboxRelay(); startEventConsumers();                 // jobs processes only (server.js)
 *
 * New consumers register in CONSUMERS below.
 */

const logger = require('../../../utils/logger');
const { serves } = require('../processRole');
const bus = require('./bus');
const catalog = require('./catalog');
const { startOutboxRelay } = require('./outboxRelay');

const CONSUMERS = [
    () => require('./consumers/webhookDispatcher').startWebhookDispatcher(),
];

/** Start every consumer on a jobs process. Resolves to a stop function. */
async function startEventConsumers() {
    if (!serves.jobs) return async () => {};
    const stops = [];
    for (const start of CONSUMERS) {
        try {
            stops.push(await start());
        } catch (err) {
            logger.error(`[EVENTS] consumer failed to start: ${err.message}`);
        }
    }
    logger.info(`[EVENTS] ${stops.length} consumer(s) started (mode: ${bus.mode()})`);
    return async () => { for (const stop of stops) await stop(); };
}

module.exports = {
    publish: bus.publish,
    subscribe: bus.subscribe,
    hasRedis: bus.hasRedis,
    mode: bus.mode,
    EVENTS: catalog.EVENTS,
    isKnownEvent: catalog.isKnownEvent,
    startOutboxRelay,
    startEventConsumers,
};
