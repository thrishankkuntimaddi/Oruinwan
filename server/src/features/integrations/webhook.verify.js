'use strict';

/**
 * Authentication of incoming provider webhooks (POST /api/v2/integrations/webhook/:type).
 *
 *   github  X-Hub-Signature-256: sha256=<HMAC-SHA256(raw body, webhookSecret)>
 *   gitlab  X-Gitlab-Token: <webhookSecret>
 *   other   ?token=<webhookToken>   (Jira and every other provider)
 *
 * The request must also name a workspace with a connected integration of that
 * type. Secrets are compared in constant time. The HMAC needs the exact bytes
 * GitHub sent, so server.js keeps the raw body for these URLs (captureRawBody).
 */

const crypto = require('crypto');
const { readSecret, safeEqual } = require('./integration.config');

const WEBHOOK_PATH = '/api/v2/integrations/webhook/';

/** `verify` callback for express.json / express.urlencoded: keep the raw bytes of webhook requests. */
function captureRawBody(req, _res, buf) {
  if ((req.originalUrl || req.url || '').startsWith(WEBHOOK_PATH)) req.rawBody = Buffer.from(buf);
}

function githubSignature(secret, rawBody) {
  return `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

/**
 * @returns {{ ok: true } | { ok: false, status: number, message: string }}
 */
function verifyIncoming(type, req, integration) {
  const deny = (message) => ({ ok: false, status: 401, message });
  if (!integration || integration.status !== 'connected') return deny('No active integration for this workspace');
  const config = integration.config || {};

  if (type === 'github') {
    const header = req.get ? req.get('x-hub-signature-256') : req.headers['x-hub-signature-256'];
    if (!header) return deny('Missing X-Hub-Signature-256');
    const secret = readSecret(config, 'webhookSecret');
    if (!secret) return deny('Webhook secret not configured');
    if (!req.rawBody) return deny('Cannot verify signature (raw body unavailable)');
    return safeEqual(String(header), githubSignature(secret, req.rawBody)) ? { ok: true } : deny('Invalid signature');
  }

  if (type === 'gitlab') {
    const header = req.get ? req.get('x-gitlab-token') : req.headers['x-gitlab-token'];
    if (!header) return deny('Missing X-Gitlab-Token');
    const secret = readSecret(config, 'webhookSecret') || readSecret(config, 'webhookToken');
    return safeEqual(String(header), secret) ? { ok: true } : deny('Invalid token');
  }

  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  if (!token) return deny('Missing token');
  return safeEqual(token, readSecret(config, 'webhookToken')) ? { ok: true } : deny('Invalid token');
}

module.exports = { captureRawBody, verifyIncoming, githubSignature, WEBHOOK_PATH };
