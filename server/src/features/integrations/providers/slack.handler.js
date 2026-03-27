// server/src/features/integrations/providers/slack.handler.js
// Slack bridge — mirrors messages between Slack ↔ Chttrix channels via webhooks
const axios = require('axios');

async function verify(config) {
  if (!config.webhookUrl && !config.botToken) {
    throw Object.assign(new Error('Slack: webhookUrl or botToken required'), { statusCode: 400 });
  }
  return config;
}

/**
 * Send a message to Slack from Chttrix.
 * Uses Slack Incoming Webhook URL.
 */
async function sendToSlack(webhookUrl, text, context = {}) {
  await axios.post(webhookUrl, {
    text,
    username: 'Chttrix',
    icon_emoji: ':speech_balloon:',
    attachments: context.attachments || []
  }, { timeout: 8000 });
}

/**
 * Handle incoming Slack events (URL verification + message events).
 */
async function handleWebhook(payload, headers, integration) {
  const results = [];

  // Slack URL verification challenge
  if (payload.type === 'url_verification') {
    return { handled: true, challenge: payload.challenge, results: [] };
  }

  // Slack event callback
  if (payload.type === 'event_callback') {
    const event = payload.event || {};

    if (event.type === 'message' && !event.subtype && event.text) {
      // Mirror Slack message → Chttrix channel message
      results.push({
        action: 'message.bridge',
        data: {
          source: 'slack',
          channelId: event.channel,
          text: event.text,
          userId: event.user,
          ts: event.ts
        }
      });
    }
  }

  return { handled: true, results };
}

module.exports = { verify, sendToSlack, handleWebhook };
