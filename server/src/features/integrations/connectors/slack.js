'use strict';

/**
 * Slack bridge.
 *
 * Incoming: Slack Events API → POST /webhook/slack?workspaceId=… signed with
 * the app's signing secret (X-Slack-Signature: v0=HMAC-SHA256("v0:ts:body"),
 * X-Slack-Request-Timestamp within 5 minutes). `message` events in a bridged
 * Slack channel are posted into the mapped Oruinwan channel by the "Slack"
 * bot, marked as bridged (they were not end-to-end encrypted in Slack).
 *
 * Outgoing: Oruinwan messages are end-to-end encrypted, so the server cannot
 * read them. Only for bridges an admin explicitly switched to "out"/"both"
 * (with a warning), the sender's client sends the plaintext it already has to
 * POST /bridge/relay, which forwards it via chat.postMessage (bot token) or
 * the Slack incoming-webhook URL. See docs/integrations.md.
 */

const { request, header, safeEqual, hmacHex, clip, httpError } = require('./http');
const { deny, ok } = require('./common');

const LABEL = 'Slack';
const API = () => (process.env.SLACK_API_URL || 'https://slack.com/api').replace(/\/+$/, '');
const MAX_SKEW_S = 5 * 60;
const SLACK_ID = /^[CGD][A-Z0-9]{2,30}$/;

async function slackApi(ctx, method, data, { get = false } = {}) {
  const token = ctx.secret('botToken');
  if (!token) throw httpError(400, 'Slack needs a bot token for this', 'INTEGRATION_NOT_CONFIGURED');
  const res = await request({
    label: LABEL, code: 'SLACK', method: get ? 'get' : 'post', url: `${API()}/${method}`,
    headers: { Authorization: `Bearer ${token}`, ...(get ? {} : { 'Content-Type': 'application/json; charset=utf-8' }) },
    ...(get ? { params: data } : { data }),
  });
  if (res && res.ok === false) {
    const bad = ['invalid_auth', 'not_authed', 'token_revoked', 'account_inactive'].includes(res.error);
    throw httpError(bad ? 502 : 400, bad ? 'Slack rejected the bot token. Paste a new one in Settings → Integrations.' : `Slack: ${res.error}`, bad ? 'SLACK_BAD_TOKEN' : 'SLACK_ERROR');
  }
  return res;
}

const names = new Map(); // `${team}:${user}` -> { name, at }
async function userName(ctx, team, user) {
  if (!user) return null;
  const key = `${team}:${user}`;
  const hit = names.get(key);
  if (hit && Date.now() - hit.at < 3600_000) return hit.name;
  if (!ctx.secret('botToken')) return null;
  try {
    const r = await slackApi(ctx, 'users.info', { user }, { get: true });
    const name = r.user?.profile?.display_name || r.user?.real_name || r.user?.name || null;
    if (names.size > 5000) names.clear();
    names.set(key, { name, at: Date.now() });
    return name;
  } catch {
    return null;
  }
}

/** Slack mrkdwn → plain text. */
function slackToText(text, resolved = {}) {
  return String(text || '')
    .replace(/<@([A-Z0-9]+)(?:\|([^>]+))?>/g, (_, id, label) => `@${label || resolved[id] || 'someone'}`)
    .replace(/<#[A-Z0-9]+\|([^>]*)>/g, (_, name) => `#${name}`)
    .replace(/<!(here|channel|everyone)>/g, '@$1')
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2 ($1)')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .slice(0, 4000);
}

/** Bridges an incoming message may use. */
const inbound = (config, remote) => (config.bridges || []).find(b => b.remote === remote && ['in', 'both'].includes(b.direction))
  || (config.bridges || []).find(b => b.remote === '*' && ['in', 'both'].includes(b.direction)) || null;

async function parseWebhook({ payload, headers, ctx }) {
  if (payload.type !== 'event_callback') return [];
  // Slack retries when we are slow; the first delivery was already handled (cards dedupe by url too).
  if (headers['x-slack-retry-num']) return [];
  const e = payload.event || {};
  if (e.type !== 'message' || e.bot_id || e.app_id || (e.subtype && !['file_share', 'thread_broadcast', 'me_message'].includes(e.subtype))) return [];
  const bridge = inbound(ctx.config, e.channel);
  if (!bridge) return [];
  const ids = [...new Set([...(String(e.text || '').matchAll(/<@([A-Z0-9]+)>/g))].map(m => m[1]))].slice(0, 5);
  const resolved = {};
  for (const id of ids) resolved[id] = await userName(ctx, payload.team_id, id);
  const author = (await userName(ctx, payload.team_id, e.user)) || e.user_profile?.display_name || e.user_profile?.real_name || 'Slack user';
  const files = (e.files || []).map(f => f.name).filter(Boolean);
  const text = slackToText(e.text, resolved) + (files.length ? `\n📎 ${files.join(', ')}` : '');
  if (!text.trim()) return [];
  const url = `slack://${payload.team_id || 'team'}/${e.channel}/${e.ts}`;
  return [{
    type: 'card', channelId: bridge.channelId,
    card: { provider: 'slack', kind: 'message', url, author, title: null, extra: { bridged: true, notE2EE: true, remote: e.channel, thread: e.thread_ts || null } },
    summary: text,
  }];
}

module.exports = {
  type: 'slack',
  label: LABEL,
  category: 'communication',
  description: 'Bridge Slack channels and Oruinwan channels. Bridged messages are not end-to-end encrypted.',
  setup: [
    'Create a Slack app (api.slack.com/apps) in your Slack workspace. Under OAuth & Permissions add the bot scopes channels:history, groups:history, users:read and chat:write (plus chat:write.customize to show the sender’s name), install it and copy the Bot User OAuth Token (xoxb-…).',
    'From Basic Information copy the Signing Secret.',
    'Or, for outgoing only, create an Incoming Webhook and paste its URL instead of a bot token.',
    'Save, then under Event Subscriptions enable events, paste the request URL shown here and subscribe to the bot events message.channels and message.groups. Invite the app to each Slack channel you bridge (/invite @YourApp).',
    'Add bridges below: Slack channel ID (e.g. C0123ABCD, or * for every channel the app is in) → Oruinwan channel, and the direction.',
  ],
  form: [
    { key: 'botToken', label: 'Bot token', kind: 'secret', placeholder: 'xoxb-…', hint: 'Needed to receive messages with names and to post to a specific channel.' },
    { key: 'signingSecret', label: 'Signing secret', kind: 'secret', hint: 'Needed to receive Slack messages.' },
    { key: 'webhookUrl', label: 'Incoming webhook URL (outgoing only)', kind: 'secret', placeholder: 'https://hooks.slack.com/services/…' },
  ],
  secrets: ['botToken', 'signingSecret', 'webhookUrl'],
  generated: [],
  secretChecks: {
    webhookUrl: (v) => {
      if (!/^https:\/\/hooks\.slack\.com\/(services|workflows|triggers)\//.test(v)) throw httpError(400, 'The Slack webhook URL must start with https://hooks.slack.com/');
    },
  },
  fields: {},
  defaults: () => ({ bridges: [] }),
  toggles: [],
  routes: null,
  bridge: { remoteLabel: 'Slack channel ID', remotePlaceholder: 'C0123ABCD or *', remotePattern: SLACK_ID, remoteRequired: true },
  isConfigured: (config) => !!(config.botToken || config.webhookUrl),
  webhook: { how: 'Slack Events API request URL (signed with the signing secret)' },

  async test(ctx) {
    if (ctx.secret('botToken')) {
      const r = await slackApi(ctx, 'auth.test', {});
      return { account: { name: r.user || null, team: r.team || null, url: r.url || null } };
    }
    // A webhook URL answers 400 "no_text" to an empty message when it is valid, without posting anything.
    const url = ctx.secret('webhookUrl');
    const axios = require('axios');
    let res;
    try {
      res = await axios.post(url, {}, { timeout: 10_000, validateStatus: () => true, maxRedirects: 0 });
    } catch (err) {
      throw httpError(502, `Slack did not answer: ${err.message}`, 'SLACK_ERROR');
    }
    const body = typeof res.data === 'string' ? res.data : JSON.stringify(res.data || '');
    if (res.status === 400 && /no_text|missing_text|invalid_payload/.test(body)) return { account: { name: 'Incoming webhook' } };
    if (res.status >= 200 && res.status < 300) return { account: { name: 'Incoming webhook' } };
    throw httpError(400, `Slack rejected the webhook URL (${res.status} ${body.slice(0, 60)})`, 'SLACK_BAD_TOKEN');
  },

  verifyWebhook(req, ctx) {
    const secret = ctx.secret('signingSecret');
    if (!secret) return deny('Paste the Slack signing secret in Settings → Integrations first');
    const ts = header(req, 'x-slack-request-timestamp');
    const sig = header(req, 'x-slack-signature');
    if (!ts || !sig) return deny('Missing Slack signature');
    if (Math.abs(Date.now() / 1000 - Number(ts)) > MAX_SKEW_S) return deny('Stale request');
    if (!req.rawBody) return deny('Cannot verify signature (raw body unavailable)');
    return safeEqual(sig, `v0=${hmacHex(secret, `v0:${ts}:${req.rawBody.toString('utf8')}`)}`) ? ok : deny('Invalid signature');
  },

  parseWebhook,

  /** Forward one Oruinwan message (plaintext from the sender's client). */
  async relay(ctx, bridge, { text, senderName, channelName }) {
    const body = clip(text, 3500);
    const remote = bridge.remote && bridge.remote !== '*' ? bridge.remote : null;
    if (ctx.secret('botToken') && remote) {
      await slackApi(ctx, 'chat.postMessage', { channel: remote, text: body, username: `${senderName || 'Someone'} (Oruinwan)`, unfurl_links: false });
      return { via: 'bot' };
    }
    const url = ctx.secret('webhookUrl');
    if (!url) throw httpError(400, 'Slack needs a bot token with a channel ID, or an incoming webhook URL, to send messages', 'INTEGRATION_NOT_CONFIGURED');
    await request({ label: LABEL, code: 'SLACK', method: 'post', url, data: { text: `*${senderName || 'Someone'}* in #${channelName || 'oruinwan'}: ${body}` } });
    return { via: 'webhook' };
  },

  actions: {
    channels: {
      method: 'GET',
      admin: true,
      async run(ctx) {
        const r = await slackApi(ctx, 'conversations.list', { limit: 200, exclude_archived: true, types: 'public_channel,private_channel' }, { get: true });
        return { channels: (r.channels || []).map(c => ({ id: c.id, name: c.name, isPrivate: !!c.is_private, isMember: !!c.is_member })) };
      },
    },
  },
  slackToText,
};
