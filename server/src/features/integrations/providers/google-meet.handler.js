async function verify(config) {
  if (!config.accessToken) throw Object.assign(new Error('Google Meet: accessToken required'), { statusCode: 400 });
  return config;
}
async function createMeeting({ summary, startTime }) {
  return {
    source: 'google_meet',
    summary,
    startTime,
    meetLink: `https://meet.google.com/${Math.random().toString(36).slice(2, 10)}`,
    createdAt: new Date().toISOString()
  };
}
async function handleWebhook(payload, headers, integration) {
  return { handled: true, source: 'google_meet', results: [] };
}
module.exports = { verify, createMeeting, handleWebhook };
