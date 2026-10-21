'use strict';

/**
 * Building blocks shared by the connectors: webhook authentication helpers
 * and small card/route helpers.
 *
 * Connector contract (see registry.js):
 *   type, label, category, description, setup[], form[], secrets[], generated[],
 *   fields{key: normalise(value)}, defaults(), toggles[], routes|null, bridge|null,
 *   required[] (or isConfigured(config)), webhook{ tokenInUrl, how } | null,
 *   test(ctx) → { account }, verifyWebhook(req, ctx) → {ok}|{ok:false,status,message},
 *   parseWebhook({ payload, headers, ctx }) → effects[], actions{ name: { method, run(ctx, input, env) } }
 *
 * ctx = { integration, config, secret(field) → plaintext }
 *
 * Effects (applied by integration.apply.js):
 *   { type: 'card', route: { match, event } | null, channelId?, card, summary, dedupe? }
 *   { type: 'task.create', route, link, title, description, status? }   (only with config.createTasks)
 *   { type: 'task.link', link, texts[], note?, status?, onlyFrom? }        (Oruinwan task keys in texts + same link url)
 *   { type: 'task.status', url, status, note }                             (tasks already linked to url)
 *   { type: 'automation', data }                                           (webhook.received payload)
 *   { type: 'response', body }                                             (synchronous reply, e.g. Teams)
 */

const { header, safeEqual, hmacHex } = require('./http');

const ok = { ok: true };
const deny = (message, status = 401) => ({ ok: false, status, message });

/** `?token=` or `X-Oruinwan-Token:` must equal the stored secret `field`. */
function verifyToken(req, ctx, field = 'webhookToken') {
  const expected = ctx.secret(field);
  if (!expected) return deny('Webhook token not configured');
  const given = (typeof req.query?.token === 'string' && req.query.token) || header(req, 'x-oruinwan-token');
  if (!given) return deny('Missing token');
  return safeEqual(given, expected) ? ok : deny('Invalid token');
}

/** `sha256=<hex>`-style HMAC over the raw body (GitHub / Bitbucket). */
function verifyHubSignature(req, secret, headerName = 'x-hub-signature-256') {
  const sig = header(req, headerName);
  if (!sig) return deny(`Missing ${headerName}`);
  if (!req.rawBody) return deny('Cannot verify signature (raw body unavailable)');
  return safeEqual(sig, `sha256=${hmacHex(secret, req.rawBody)}`) ? ok : deny('Invalid signature');
}

/** Lower-case route key match: exact first, then '*'. */
function pickRoute(config, match, event) {
  const routes = Array.isArray(config?.routes) ? config.routes : [];
  const wants = (r) => !event || !Array.isArray(r.events) || !r.events.length || r.events.includes(event);
  const key = String(match || '').toLowerCase();
  return routes.find(r => r.match === key && wants(r)) || routes.find(r => r.match === '*' && wants(r)) || null;
}

/** Normalised CI/build status. */
function buildStatus(raw) {
  const s = String(raw || '').toLowerCase();
  if (['success', 'succeeded', 'successful', 'passed', 'fixed', 'completed_success', 'ok', 'green'].includes(s)) return 'success';
  if (['failure', 'failed', 'error', 'errored', 'broken', 'still_failing', 'timed_out', 'startup_failure', 'unstable', 'infrastructure_fail', 'red'].includes(s)) return 'failure';
  if (['cancelled', 'canceled', 'aborted', 'stopped', 'skipped', 'not_run', 'neutral', 'action_required'].includes(s)) return 'cancelled';
  if (['running', 'in_progress', 'pending', 'queued', 'started', 'created', 'waiting', 'waiting_for_resource', 'preparing', 'scheduled', 'requested', 'on_hold', 'inprogress'].includes(s)) return 'running';
  return 'unknown';
}

/** Card `checks` object from a normalised status. */
function checksOf(status, { name = null, url = null } = {}) {
  if (status === 'running') return { status: 'in_progress', conclusion: null, name, url };
  const conclusion = { success: 'success', failure: 'failure', cancelled: 'cancelled' }[status] || 'neutral';
  return { status: 'completed', conclusion, name, url };
}

/** Plain text from simple HTML (Teams messages, Confluence excerpts). */
function stripHtml(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

module.exports = { ok, deny, verifyToken, verifyHubSignature, pickRoute, buildStatus, checksOf, stripHtml };
