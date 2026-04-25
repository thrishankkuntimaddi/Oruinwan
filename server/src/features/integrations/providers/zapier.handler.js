async function handleWebhook(payload, headers, integration) {
  
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
