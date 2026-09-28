
async function verify(config) {
  if (!config.apiKey || !config.apiSecret) {
    throw Object.assign(new Error('Zoom: apiKey and apiSecret required'), { statusCode: 400 });
  }
  return config;
}

// Real meetings are created by zoom/zoom.client.js (Server-to-Server OAuth); see
// POST /api/v2/integrations/zoom/meeting. Kept for the legacy handler interface.
async function createMeeting({ topic, startTime, duration, config }) {
  const { readSecret } = require('../integration.config');
  const m = await require('../zoom/zoom.client').createMeeting(
    { accountId: config?.accountId, clientId: config?.clientId, clientSecret: readSecret(config, 'clientSecret') },
    { topic, start: startTime, durationMinutes: duration }
  );
  return { source: 'zoom', meetingId: m.id, topic: m.topic, startTime: m.start, duration: m.durationMinutes, joinUrl: m.joinUrl, hostUrl: m.startUrl };
}

async function handleWebhook(payload, headers, integration) {
  const event = payload.event || '';
  const results = [];

  if (event === 'meeting.ended') {
    results.push({
      action: 'meeting.completed',
      data: {
        source: 'zoom',
        meetingId: payload.payload?.object?.id,
        topic: payload.payload?.object?.topic,
        duration: payload.payload?.object?.duration
      }
    });
  }

  return { handled: true, event, results };
}

module.exports = { verify, createMeeting, handleWebhook };
