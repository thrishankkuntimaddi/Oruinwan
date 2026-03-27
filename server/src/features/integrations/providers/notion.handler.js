// server/src/features/integrations/providers/notion.handler.js
async function verify(config) {
  if (!config.token) throw Object.assign(new Error('Notion: integration token required'), { statusCode: 400 });
  return config;
}
function attachPage({ pageId, pageTitle, pageUrl }) {
  return { source: 'notion', externalId: pageId, name: pageTitle, url: pageUrl, attachedAt: new Date().toISOString() };
}
async function handleWebhook(payload, headers, integration) {
  return { handled: true, source: 'notion', results: [] };
}
module.exports = { verify, attachPage, handleWebhook };
