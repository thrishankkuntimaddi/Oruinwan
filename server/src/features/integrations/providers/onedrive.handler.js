async function verify(config) {
  if (!config.accessToken) throw Object.assign(new Error('OneDrive: accessToken required'), { statusCode: 400 });
  return config;
}
function attachFile({ fileId, fileName, mimeType, webUrl }) {
  return { source: 'onedrive', externalId: fileId, name: fileName, mimeType, url: webUrl, attachedAt: new Date().toISOString() };
}
async function handleWebhook(payload, headers, integration) {
  return { handled: true, source: 'onedrive', results: [] };
}
module.exports = { verify, attachFile, handleWebhook };
