'use strict';
const logger = require('../../../utils/logger');

// Phone push notifications.
//   Android: Firebase Cloud Messaging (HTTP v1). Set FIREBASE_SERVICE_ACCOUNT to the service
//            account JSON (or FIREBASE_SERVICE_ACCOUNT_FILE to its path).
//   iPhone:  Apple Push Notification service, token auth. Set APNS_KEY (the .p8 contents, or
//            APNS_KEY_FILE), APNS_KEY_ID, APNS_TEAM_ID and APNS_BUNDLE_ID; APNS_PRODUCTION=true
//            for App Store / TestFlight builds.
// Without them, nothing is sent and nothing fails. Tokens the services reject as gone are removed.

const fs = require('fs');
const http2 = require('http2');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const identity = require('../../identity');

const readMaybeFile = (value, file) => {
  if (value) return value;
  if (file) {
    try {
      return fs.readFileSync(file, 'utf8');
    } catch (err) {
      logger.error({ err: err.message, file }, '[Push] Could not read key file');
    }
  }
  return null;
};

// ── Firebase (Android) ──────────────────────────────────────────────────────

let fcmAuth = null;
function fcmConfig(env = process.env) {
  const raw = readMaybeFile(env.FIREBASE_SERVICE_ACCOUNT, env.FIREBASE_SERVICE_ACCOUNT_FILE);
  if (!raw) return null;
  try {
    const credentials = JSON.parse(raw);
    if (!credentials.project_id || !credentials.client_email || !credentials.private_key) return null;
    return credentials;
  } catch {
    logger.error('[Push] FIREBASE_SERVICE_ACCOUNT is not valid JSON');
    return null;
  }
}

async function fcmAccessToken(credentials) {
  if (!fcmAuth) {
    const { GoogleAuth } = require('google-auth-library');
    fcmAuth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] });
  }
  const client = await fcmAuth.getClient();
  const { token } = await client.getAccessToken();
  return token;
}

/** Data values must be strings for FCM; drop empty ones. */
function stringData(data) {
  return Object.fromEntries(
    Object.entries(data || {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)]),
  );
}

/** Returns 'sent', 'gone' (token no longer valid) or 'failed'. */
async function sendFcm(token, { title, body, data, badge }) {
  const credentials = fcmConfig();
  if (!credentials) return 'failed';
  try {
    const accessToken = await fcmAccessToken(credentials);
    await axios.post(
      `https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`,
      {
        message: {
          token,
          notification: { title, body },
          data: stringData(data),
          android: {
            priority: 'HIGH',
            notification: {
              channel_id: 'messages',
              ...(data?.conversationId ? { tag: String(data.conversationId) } : {}),
              ...(typeof badge === 'number' ? { notification_count: badge } : {}),
            },
          },
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}` }, timeout: 10000 },
    );
    return 'sent';
  } catch (err) {
    const status = err.response?.status;
    const code = err.response?.data?.error?.details?.find?.((d) => d.errorCode)?.errorCode || err.response?.data?.error?.status;
    if (status === 404 || code === 'UNREGISTERED' || (status === 400 && code === 'INVALID_ARGUMENT')) return 'gone';
    logger.warn({ status, code, err: err.message }, '[Push] Firebase send failed');
    return 'failed';
  }
}

// ── Apple (iPhone) ──────────────────────────────────────────────────────────

function apnsConfig(env = process.env) {
  const key = readMaybeFile(env.APNS_KEY, env.APNS_KEY_FILE);
  if (!key || !env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_BUNDLE_ID) return null;
  return {
    key: key.replace(/\\n/g, '\n'),
    keyId: env.APNS_KEY_ID,
    teamId: env.APNS_TEAM_ID,
    bundleId: env.APNS_BUNDLE_ID,
    host: env.APNS_PRODUCTION === 'true' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com',
  };
}

// Apple wants the same provider token reused for up to an hour.
let apnsJwt = { token: null, at: 0 };
function apnsProviderToken(cfg) {
  if (apnsJwt.token && Date.now() - apnsJwt.at < 50 * 60 * 1000) return apnsJwt.token;
  const token = jwt.sign({ iss: cfg.teamId, iat: Math.floor(Date.now() / 1000) }, cfg.key, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: cfg.keyId },
  });
  apnsJwt = { token, at: Date.now() };
  return token;
}

function sendApns(deviceToken, { title, body, data, badge }) {
  const cfg = apnsConfig();
  if (!cfg) return Promise.resolve('failed');
  return new Promise((resolve) => {
    let session;
    try {
      session = http2.connect(cfg.host);
    } catch (err) {
      logger.warn({ err: err.message }, '[Push] Apple connection failed');
      return resolve('failed');
    }
    session.on('error', (err) => {
      logger.warn({ err: err.message }, '[Push] Apple connection error');
      resolve('failed');
    });
    const payload = JSON.stringify({
      aps: {
        alert: { title, body },
        sound: 'default',
        ...(typeof badge === 'number' ? { badge } : {}),
        ...(data?.conversationId ? { 'thread-id': String(data.conversationId) } : {}),
      },
      ...stringData(data),
    });
    const req = session.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${apnsProviderToken(cfg)}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });
    let status = 0;
    let text = '';
    req.setEncoding('utf8');
    req.on('response', (headers) => { status = headers[':status']; });
    req.on('data', (chunk) => { text += chunk; });
    req.on('end', () => {
      session.close();
      if (status === 200) return resolve('sent');
      let reason = '';
      try { reason = JSON.parse(text).reason; } catch { /* empty body */ }
      if (status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') return resolve('gone');
      logger.warn({ status, reason }, '[Push] Apple send failed');
      return resolve('failed');
    });
    req.on('error', (err) => {
      logger.warn({ err: err.message }, '[Push] Apple request failed');
      session.close();
      resolve('failed');
    });
    req.end(payload);
  });
}

// ── Sending ─────────────────────────────────────────────────────────────────

function isConfigured() {
  return { android: Boolean(fcmConfig()), ios: Boolean(apnsConfig()) };
}

/** Which service a registered device token goes through. */
function serviceFor(entry) {
  if (entry.platform === 'ios') return 'apns';
  if (entry.platform === 'android') return 'fcm';
  return null; // old Expo tokens and unknown platforms are no longer delivered
}

async function sendToUser(userId, title, body, data = {}) {
  try {
    const user = await identity.users.findById(userId, { withSecrets: true });
    const tokens = Array.isArray(user?.deviceTokens) ? user.deviceTokens : [];
    if (!tokens.length) return;

    const message = { title, body, data: { ...data, conversationId: data.channelId || data.dmSessionId || undefined } };
    const results = await Promise.all(
      tokens.map(async (entry) => {
        const service = serviceFor(entry);
        if (service === 'fcm') return [entry.token, await sendFcm(entry.token, message)];
        if (service === 'apns') return [entry.token, await sendApns(entry.token, message)];
        return [entry.token, 'gone'];
      }),
    );

    const gone = new Set(results.filter(([, r]) => r === 'gone').map(([t]) => t));
    if (gone.size) {
      await identity.users.update(userId, { deviceTokens: tokens.filter((t) => !gone.has(t.token)) });
      logger.info({ userId, removed: gone.size }, '[Push] Removed device tokens the push service no longer accepts');
    }
  } catch (err) {
    logger.error({ userId, err: err.message }, '[Push] sendToUser error');
  }
}

module.exports = { sendToUser, isConfigured, _internal: { fcmConfig, apnsConfig, stringData, serviceFor, sendFcm, sendApns } };
