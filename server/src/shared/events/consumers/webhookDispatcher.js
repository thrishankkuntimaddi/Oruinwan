'use strict';

/**
 * Delivers outgoing webhooks from the bus. Only runs when Redis is present:
 * without Redis, webhook.trigger.fire() still delivers directly from the
 * producing process, so starting this there would double-send.
 */

const logger = require('../../../../utils/logger');
const bus = require('../bus');

const GROUP = 'webhooks';

function supportedEvents() {
    const Webhook = require('../../../features/integrations/webhook.model');
    return Webhook.SUPPORTED_EVENT_NAMES || [];
}

async function handle(env) {
    if (!env.workspaceId) return; // webhooks are registered per workspace
    const { _dispatch } = require('../../../features/integrations/webhook.trigger');
    await _dispatch(env.workspaceId, env.name, env.payload);
}

/** Resolves to a stop function. */
async function startWebhookDispatcher() {
    if (!bus.hasRedis()) return () => {};
    const events = supportedEvents();
    const stop = await bus.subscribe(GROUP, handle, { events });
    logger.info(`[EVENTS] webhook dispatcher consuming ${events.length} event type(s)`);
    return stop;
}

module.exports = { startWebhookDispatcher, handle, GROUP };
