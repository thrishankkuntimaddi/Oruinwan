'use strict';
const logger = require('../../../utils/logger');

// Phone push notifications.
//   Android: Firebase Cloud Messaging (HTTP v1). Set FIREBASE_SERVICE_ACCOUNT to the service
//            account JSON (or FIREBASE_SERVICE_ACCOUNT_FILE to its path).
//   iPhone:  Apple Push Notification service, token auth. Set APNS_KEY (the .p8 contents, or
//            APNS_KEY_FILE), APNS_KEY_ID, APNS_TEAM_ID and APNS_BUNDLE_ID; APNS_PRODUCTION=true
//            for App Store / TestFlight builds.
//   Browsers (the phone app's interface on the website): Web Push with VAPID keys. Set
//            WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY (`npx web-push generate-vapid-keys`)
//            and optionally WEB_PUSH_SUBJECT (mailto: or https: contact for push services).
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

/** The FCM message for one device. A data-only message (calls) wakes the app's own handler. */
function fcmMessage(token, { title, body, data, badge, dataOnly = false, ttlSeconds = null }) {
  if (dataOnly) {
    return {
      token,
      data: stringData(data),
      android: { priority: 'HIGH', ...(ttlSeconds ? { ttl: `${ttlSeconds}s` } : {}) },
    };
  }
  return {
    token,
    notification: { title, body },
    data: stringData(data),
    android: {
      priority: 'HIGH',
      ...(ttlSeconds ? { ttl: `${ttlSeconds}s` } : {}),
      notification: {
        channel_id: 'messages',
        ...(data?.conversationId ? { tag: String(data.conversationId) } : {}),
        ...(typeof badge === 'number' ? { notification_count: badge } : {}),
      },
    },
  };
}

/** Returns 'sent', 'gone' (token no longer valid) or 'failed'. */
async function sendFcm(token, message) {
  const credentials = fcmConfig();
  if (!credentials) return 'failed';
  try {
    const accessToken = await fcmAccessToken(credentials);
    await axios.post(
      `https://fcm.googleapis.com/v1/projects/${credentials.project_id}/messages:send`,
      { message: fcmMessage(token, message) },
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

function sendApns(deviceToken, { title, body, data, badge, ttlSeconds = null }) {
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
        ...(isMessagePush(data) ? { category: MESSAGE_CATEGORY } : {}),
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
      ...(ttlSeconds ? { 'apns-expiration': String(Math.floor(Date.now() / 1000) + ttlSeconds) } : {}),
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

// ── Message pushes (quick reply) ────────────────────────────────────────────

// The phone app registers the notification category 'oru.message' with "Reply" (text input)
// and "Mark as read" actions (mobile/src/native/push.js). iOS shows them on pushes whose
// aps.category matches; Android re-posts message pushes with the same actions while the app
// runs. Only notifications about a message in a conversation get it: a reply needs somewhere to go.
const MESSAGE_CATEGORY = 'oru.message';
const MESSAGE_PUSH_TYPES = new Set(['mention', 'dm', 'direct_message', 'thread_reply', 'message', 'channel_message']);

function isMessagePush(data) {
  return Boolean(data && MESSAGE_PUSH_TYPES.has(data.type) && (data.channelId || data.dmSessionId || data.conversationId));
}

// ── Web Push (browsers) ─────────────────────────────────────────────────────

function webPushConfig(env = process.env) {
  const publicKey = String(env.WEB_PUSH_PUBLIC_KEY || '').trim();
  const privateKey = String(env.WEB_PUSH_PRIVATE_KEY || '').trim();
  if (!publicKey || !privateKey) return null;
  const subject = String(env.WEB_PUSH_SUBJECT || '').trim() || 'mailto:admin@poelys.com';
  return { publicKey, privateKey, subject };
}

/**
 * The browser's subscription is stored as the token (its JSON). The service worker (mobile/public/
 * sw.js) shows `{ title, body, data, tag }`: one notification per conversation or call (tag).
 * -> 'sent' | 'gone' (the browser unsubscribed) | 'failed'
 */
async function sendWebPush(token, { title, body, data = {}, tag, ttlSeconds = null, urgency = 'normal' }) {
  const cfg = webPushConfig();
  if (!cfg) return 'failed';
  let subscription;
  try {
    subscription = JSON.parse(token);
  } catch {
    return 'gone';
  }
  if (!subscription?.endpoint) return 'gone';
  try {
    const webpush = require('web-push');
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, data, tag }), {
      vapidDetails: { subject: cfg.subject, publicKey: cfg.publicKey, privateKey: cfg.privateKey },
      TTL: ttlSeconds ?? 24 * 60 * 60,
      urgency,
    });
    return 'sent';
  } catch (err) {
    if (err?.statusCode === 404 || err?.statusCode === 410) return 'gone';
    logger.warn({ status: err?.statusCode, err: err?.body || err?.message }, '[Push] Web push failed');
    return 'failed';
  }
}

// ── Sending ─────────────────────────────────────────────────────────────────

function isConfigured() {
  const web = webPushConfig();
  return { android: Boolean(fcmConfig()), ios: Boolean(apnsConfig()), web: Boolean(web), webKey: web?.publicKey || null };
}

/** Which service a registered device token goes through. */
function serviceFor(entry) {
  if (entry.platform === 'ios') return 'apns';
  if (entry.platform === 'android') return 'fcm';
  if (entry.platform === 'web') return 'webpush';
  return null; // old Expo tokens and unknown platforms are no longer delivered
}

/**
 * Send to every registered device of a user. `send(service, entry)` returns the push result;
 * tokens the services reject as gone are removed.
 */
async function deliver(userId, send) {
  const user = await identity.users.findById(userId, { withSecrets: true });
  const tokens = Array.isArray(user?.deviceTokens) ? user.deviceTokens : [];
  if (!tokens.length) return;
  const results = await Promise.all(
    tokens.map(async (entry) => [entry.token, await send(serviceFor(entry), entry)]),
  );
  const gone = new Set(results.filter(([, r]) => r === 'gone').map(([t]) => t));
  if (gone.size) {
    await identity.users.update(userId, { deviceTokens: tokens.filter((t) => !gone.has(t.token)) });
    logger.info({ userId, removed: gone.size }, '[Push] Removed device tokens the push service no longer accepts');
  }
}

async function sendToUser(userId, title, body, data = {}) {
  try {
    const conversationId = data.channelId || data.dmSessionId || undefined;
    const full = { ...data, conversationId };
    // `category` in the data tells the Android app which pushes to re-post with the reply actions.
    const message = { title, body, data: isMessagePush(full) ? { ...full, category: MESSAGE_CATEGORY } : full };
    await deliver(userId, async (service, entry) => {
      if (service === 'fcm') return sendFcm(entry.token, message);
      if (service === 'apns') return sendApns(entry.token, message);
      if (service === 'webpush') return sendWebPush(entry.token, { ...message, tag: conversationId ? String(conversationId) : undefined });
      return 'gone';
    });
  } catch (err) {
    logger.error({ userId, err: err.message }, '[Push] sendToUser error');
  }
}

// ── Calls ───────────────────────────────────────────────────────────────────

const CALL_TTL_SECONDS = 45;

/**
 * A ringing call (`type: 'call'`, payload in `call`) or the end of one (`type: 'call_cancel'`).
 * Android gets a high-priority data-only message, so the app shows its own incoming-call screen
 * (with Accept / Decline) even when it was closed; it expires with the ring. iPhone gets an alert
 * that expires the same way (no VoIP push yet), and nothing for a cancel.
 */
async function sendCallToUser(userId, type, payload = {}) {
  try {
    const isCall = type === 'call';
    const data = {
      type,
      huddleId: payload.huddleId,
      call: payload,
      ...(payload.reason ? { reason: payload.reason } : {}),
      // Also at the top level, so the notification's Decline button finds it without parsing `call`.
      ...(payload.declineUrl ? { declineUrl: payload.declineUrl } : {}),
    };
    const who = payload.from?.name || 'Someone';
    const title = payload.kind === 'group_dm' && payload.title ? payload.title : who;
    const body = `${payload.kind === 'group_dm' ? `${who} · ` : ''}Incoming ${payload.video ? 'video' : 'voice'} call`;
    await deliver(userId, async (service, entry) => {
      if (service === 'fcm') return sendFcm(entry.token, { data, dataOnly: true, ttlSeconds: CALL_TTL_SECONDS });
      if (service === 'apns') {
        if (!isCall) return 'sent';
        return sendApns(entry.token, { title, body, data, ttlSeconds: CALL_TTL_SECONDS });
      }
      // Browsers: a ringing call shows until answered; its end replaces it (same tag) and closes it.
      if (service === 'webpush') {
        return sendWebPush(entry.token, { title, body, data, tag: `call:${payload.huddleId}`, ttlSeconds: CALL_TTL_SECONDS, urgency: 'high' });
      }
      return 'gone';
    });
  } catch (err) {
    logger.error({ userId, err: err.message }, '[Push] sendCallToUser error');
  }
}

module.exports = { sendToUser, sendCallToUser, isConfigured, _internal: { isMessagePush, MESSAGE_CATEGORY, fcmConfig, fcmMessage, apnsConfig, webPushConfig, stringData, serviceFor, sendFcm, sendApns, sendWebPush } };
