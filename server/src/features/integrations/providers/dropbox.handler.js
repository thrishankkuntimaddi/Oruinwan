async function verify(config) {
  if (!config.accessToken) throw Object.assign(new Error('Dropbox: accessToken required'), { statusCode: 400 });
  return config;
}
function attachFile({ fileId, fileName, link }) {
  return { source: 'dropbox', externalId: fileId, name: fileName, url: link, attachedAt: new Date().toISOString() };
}
async function handleWebhook(payload, headers, integration) {
  return { handled: true, source: 'dropbox', results: [] };
}
module.exports = { verify, attachFile, handleWebhook };
