// server/src/features/integrations/providers/zapier.handler.js
// Generic automation webhook handler (Zapier / Make / n8n)
// For outgoing: the webhook.trigger service handles POSTing to registered URLs.
// For incoming: accept arbitrary payloads and map them as activity events.

async function handleWebhook(payload, headers, integration) {
  // Accept any structured payload and surface it as an external event
  const results = [{
    action: 'automation.trigger',
    data: {
      source: headers['x-trigger-source'] || 'automation',
      payload
    }
  }];
  return { handled: true, results };
}

module.exports = { handleWebhook };
