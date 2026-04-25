const axios = require('axios');

async function verify(config) {
  if (!config.apiKey || !config.apiSecret) {
    throw Object.assign(new Error('Zoom: apiKey and apiSecret required'), { statusCode: 400 });
  }
  return config;
}

async function createMeeting({ topic, startTime, duration, config }) {
  
  
  return {
    source: 'zoom',
    meetingId: `zoom-${Date.now()}`,
    topic,
    startTime,
    duration,
    joinUrl: `https://zoom.us/j/${Date.now()}`, 
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
