// server/src/features/integrations/providers/confluence.handler.js
async function verify(config) {
  if (!config.token || !config.baseUrl) throw Object.assign(new Error('Confluence: token and baseUrl required'), { statusCode: 400 });
  return config;
}
function attachPage({ pageId, pageTitle, pageUrl }) {
  return { source: 'confluence', externalId: pageId, name: pageTitle, url: pageUrl, attachedAt: new Date().toISOString() };
}
async function handleWebhook(payload, headers, integration) {
  return { handled: true, source: 'confluence', results: [] };
}
module.exports = { verify, attachPage, handleWebhook };
