// server/src/features/integrations/providers/teams.handler.js
async function verify(config) {
  if (!config.webhookUrl) throw Object.assign(new Error('Teams: webhookUrl required'), { statusCode: 400 });
  return config;
}
async function sendToTeams(webhookUrl, text) {
  const axios = require('axios');
  await axios.post(webhookUrl, { text }, { timeout: 8000 });
}
async function handleWebhook(payload, headers, integration) {
  return { handled: true, source: 'teams', results: [] };
}
module.exports = { verify, sendToTeams, handleWebhook };
