'use strict';

/**
 * Integration records: list, disconnect and the outgoing-event helper.
 * Connecting goes through integration.dev.service (GitHub, Jira, Zoom) or
 * integration.connectors.service (every token-based connector), which verify
 * credentials with the provider before saving.
 */

const Integration = require('./integration.model');
const webhookTrigger = require('./webhook.trigger');

async function disconnectIntegration({ workspaceId, type }) {
  const integration = await Integration.findOneAndUpdate(
    { workspaceId, type },
    { status: 'disconnected', config: {}, lastEventAt: new Date() },
    { new: true }
  );

  if (!integration) {
    throw Object.assign(new Error('Integration not found'), { statusCode: 404 });
  }

  await webhookTrigger.fire(workspaceId, 'integration.disconnected', { type });

  return integration;
}

async function getIntegrations(workspaceId) {
  return Integration.find({ workspaceId })
    .select('-config')
    .lean();
}

async function triggerIntegrationEvent(workspaceId, event, data) {
  return webhookTrigger.fire(workspaceId, event, data);
}

module.exports = {
  disconnectIntegration,
  getIntegrations,
  triggerIntegrationEvent
};
