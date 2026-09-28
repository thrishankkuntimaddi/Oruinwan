'use strict';

/**
 * Zoom Server-to-Server OAuth: account credentials → access token (cached
 * until shortly before it expires) → meetings API.
 */

const axios = require('axios');

const TOKEN_URL = process.env.ZOOM_OAUTH_URL || 'https://zoom.us/oauth/token';
const API_URL = (process.env.ZOOM_API_URL || 'https://api.zoom.us/v2').replace(/\/+$/, '');

const tokens = new Map(); // `${accountId}:${clientId}` -> { token, exp }

function httpError(status, message, code) {
  return Object.assign(new Error(message), { statusCode: status, status, ...(code && { code }) });
}

async function getAccessToken({ accountId, clientId, clientSecret }) {
  if (!accountId || !clientId || !clientSecret) throw httpError(400, 'Zoom needs accountId, clientId and clientSecret', 'INTEGRATION_NOT_CONFIGURED');
  const key = `${accountId}:${clientId}`;
  const hit = tokens.get(key);
  if (hit && hit.exp > Date.now() + 60_000) return hit.token;
  try {
    const res = await axios.post(TOKEN_URL, null, {
      params: { grant_type: 'account_credentials', account_id: accountId },
      auth: { username: clientId, password: clientSecret },
      timeout: 10_000,
    });
    const token = res.data?.access_token;
    if (!token) throw new Error('no access_token in response');
    tokens.set(key, { token, exp: Date.now() + (Number(res.data.expires_in) || 3600) * 1000 });
    return token;
  } catch (err) {
    if (err.statusCode) throw err;
    const reason = err.response?.data?.reason || err.response?.data?.error || err.message;
    throw httpError(502, `Zoom authentication failed: ${reason}`, 'ZOOM_AUTH_FAILED');
  }
}

/**
 * @returns {Promise<{ id, joinUrl, startUrl, password, topic, start, durationMinutes }>}
 */
async function createMeeting(creds, { topic, start, durationMinutes }) {
  const token = await getAccessToken(creds);
  const scheduled = !!start;
  const body = {
    topic: String(topic || 'Oruinwan meeting').slice(0, 200),
    type: scheduled ? 2 : 1,
    ...(scheduled && { start_time: new Date(start).toISOString() }),
    duration: Math.min(Math.max(parseInt(durationMinutes, 10) || 30, 1), 24 * 60),
    settings: { join_before_host: true, waiting_room: false },
  };
  try {
    const res = await axios.post(`${API_URL}/users/me/meetings`, body, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 10_000,
    });
    const m = res.data || {};
    return { id: m.id, joinUrl: m.join_url, startUrl: m.start_url || null, password: m.password || null, topic: m.topic, start: m.start_time || null, durationMinutes: m.duration };
  } catch (err) {
    if (err.response?.status === 401) tokens.delete(`${creds.accountId}:${creds.clientId}`);
    throw httpError(502, `Zoom meeting creation failed: ${err.response?.data?.message || err.message}`, 'ZOOM_ERROR');
  }
}

function clearTokens() {
  tokens.clear();
}

module.exports = { getAccessToken, createMeeting, clearTokens };
