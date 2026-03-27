// server/src/features/integrations/providers/zoom.handler.js
const axios = require('axios');

async function verify(config) {
  if (!config.apiKey || !config.apiSecret) {
    throw Object.assign(new Error('Zoom: apiKey and apiSecret required'), { statusCode: 400 });
  }
  return config;
}

/**
 * Create a Zoom meeting and return the join URL.
 * Uses Zoom server-to-server OAuth in real usage.
 * Here we return a placeholder that works without deep SDK.
 */
async function createMeeting({ topic, startTime, duration, config }) {
  // In real impl: POST https://api.zoom.us/v2/users/me/meetings with Bearer token
  // Returning structured data to show the pattern
  return {
    source: 'zoom',
    meetingId: `zoom-${Date.now()}`,
    topic,
    startTime,
    duration,
    joinUrl: `https://zoom.us/j/${Date.now()}`, // placeholder
    hostUrl: `https://zoom.us/s/${Date.now()}`
  };
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
