'use strict';

/**
 * Microsoft Teams bridge.
 *
 * Outgoing: a Teams incoming webhook / Workflows ("Post to a channel when a
 * webhook request is received") URL. As with Slack, only for channels an admin
 * bridged "out"/"both"; the sender's client relays the plaintext.
 *
 * Incoming: a Teams *outgoing webhook* (Teams → Apps → Manage your apps →
 * Create an outgoing webhook) pointing at our webhook URL. People @mention it
 * in Teams; Teams signs each request with Authorization: HMAC <base64
 * HMAC-SHA256(body, base64-decoded security token)> and shows our reply.
 */

const crypto = require('crypto');
const { request, header, safeEqual, clip, httpError } = require('./http');
const { deny, ok, stripHtml } = require('./common');

const LABEL = 'Microsoft Teams';
const TEAMS_HOST = /(^|\.)((webhook\.office\.com)|(logic\.azure\.com)|(environment\.api\.powerplatform\.com)|(api\.powerplatform\.com)|(office\.com))$/i;

function checkWebhookUrl(v) {
  let u;
  try { u = new URL(v); } catch { throw httpError(400, 'The Teams webhook URL is not a valid URL'); }
  if (u.protocol !== 'https:' || !TEAMS_HOST.test(u.hostname)) {
    throw httpError(400, 'Use the Teams incoming webhook or Workflows URL (https://…webhook.office.com/… or a Power Automate / Logic Apps URL)');
  }
}

/** Body accepted by both classic incoming webhooks and Workflows. */
function teamsMessage(text, title) {
  return {
    type: 'message',
    text: title ? `**${title}**\n\n${text}` : text,
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json', type: 'AdaptiveCard', version: '1.4',
        body: [...(title ? [{ type: 'TextBlock', text: title, weight: 'Bolder', wrap: true }] : []), { type: 'TextBlock', text, wrap: true }],
      },
    }],
  };
}

const inbound = (config, remote) => (config.bridges || []).find(b => b.remote === remote && ['in', 'both'].includes(b.direction))
  || (config.bridges || []).find(b => (b.remote === '*' || !b.remote) && ['in', 'both'].includes(b.direction)) || null;

function parseWebhook({ payload, ctx }) {
  if (payload.type !== 'message') return [];
  const remote = payload.channelData?.channel?.id || payload.conversation?.id || '';
  const bridge = inbound(ctx.config, remote);
  if (!bridge) return [{ type: 'response', body: { type: 'message', text: 'This Teams channel is not bridged to Oruinwan yet. Ask an Oruinwan admin to add it in Settings → Integrations → Microsoft Teams.' } }];
  // Drop the "<at>Oruinwan</at>" mention of the outgoing webhook itself.
  const text = stripHtml(String(payload.text || '').replace(/<at>[^<]*<\/at>/gi, '')).slice(0, 4000);
  if (!text) return [{ type: 'response', body: { type: 'message', text: 'Nothing to post.' } }];
  const author = clip(payload.from?.name || 'Teams user', 120);
  return [
    {
      type: 'card', channelId: bridge.channelId,
      card: { provider: 'teams', kind: 'message', url: `teams://${remote}/${payload.id || Date.now()}`, author, extra: { bridged: true, notE2EE: true, remote } },
      summary: text,
    },
    { type: 'response', body: { type: 'message', text: 'Posted to Oruinwan.' } },
  ];
}

module.exports = {
  type: 'teams',
  label: LABEL,
  category: 'communication',
  description: 'Bridge Teams channels and Oruinwan channels. Bridged messages are not end-to-end encrypted.',
  setup: [
    'Outgoing (Oruinwan → Teams): in the Teams channel add the "Incoming Webhook" connector, or a Workflows flow "Post to a channel when a webhook request is received", and paste its URL below.',
    'Incoming (Teams → Oruinwan): in Teams → Apps → Manage your apps → Create an outgoing webhook, use the webhook URL shown here as the callback URL and paste the security token Teams shows below. People then @mention it in Teams to post into Oruinwan.',
    'Add bridges below: Teams channel ID (or * for any) → Oruinwan channel, and the direction.',
  ],
  form: [
    { key: 'webhookUrl', label: 'Teams incoming webhook / Workflows URL', kind: 'secret', placeholder: 'https://…webhook.office.com/…', hint: 'For messages from Oruinwan to Teams.' },
    { key: 'outgoingSecret', label: 'Outgoing webhook security token', kind: 'secret', hint: 'For messages from Teams to Oruinwan. Shown once by Teams when you create the outgoing webhook.' },
  ],
  secrets: ['webhookUrl', 'outgoingSecret'],
  generated: [],
  secretChecks: { webhookUrl: checkWebhookUrl },
  fields: {},
  defaults: () => ({ bridges: [] }),
  toggles: [],
  routes: null,
  bridge: { remoteLabel: 'Teams channel ID', remotePlaceholder: '19:…@thread.tacv2 or *', remotePattern: /^[A-Za-z0-9:@._-]{3,200}$/, remoteRequired: false },
  isConfigured: (config) => !!(config.webhookUrl || config.outgoingSecret),
  webhook: { how: 'Teams outgoing webhook (Authorization: HMAC …)' },

  /** Checks the URL / token shape; sending a visible test message is the explicit "Send test" action. */
  async test(ctx) {
    const url = ctx.secret('webhookUrl');
    if (url) checkWebhookUrl(url);
    const secret = ctx.secret('outgoingSecret');
    if (secret && Buffer.from(secret, 'base64').length < 16) throw httpError(400, 'That does not look like a Teams security token (it is a long base64 string)');
    return { account: { name: [url && 'Outgoing ready', secret && 'Incoming ready'].filter(Boolean).join(' · ') } };
  },

  verifyWebhook(req, ctx) {
    const secret = ctx.secret('outgoingSecret');
    if (!secret) return deny('Paste the Teams outgoing webhook security token in Settings → Integrations first');
    const auth = header(req, 'authorization');
    if (!/^HMAC /i.test(auth)) return deny('Missing HMAC authorization');
    if (!req.rawBody) return deny('Cannot verify signature (raw body unavailable)');
    const expected = crypto.createHmac('sha256', Buffer.from(secret, 'base64')).update(req.rawBody).digest('base64');
    return safeEqual(auth.slice(5).trim(), expected) ? ok : deny('Invalid signature');
  },

  parseWebhook,

  async relay(ctx, _bridge, { text, senderName, channelName }) {
    const url = ctx.secret('webhookUrl');
    if (!url) throw httpError(400, 'Teams needs an incoming webhook URL to send messages', 'INTEGRATION_NOT_CONFIGURED');
    await request({ label: LABEL, code: 'TEAMS', method: 'post', url, data: teamsMessage(clip(text, 3500), `${senderName || 'Someone'} in #${channelName || 'oruinwan'}`) });
    return { via: 'webhook' };
  },

  actions: {
    'send-test': {
      method: 'POST',
      admin: true,
      async run(ctx) {
        const url = ctx.secret('webhookUrl');
        if (!url) throw httpError(400, 'Add the Teams webhook URL first', 'INTEGRATION_NOT_CONFIGURED');
        await request({ label: LABEL, code: 'TEAMS', method: 'post', url, data: teamsMessage('Oruinwan is connected to this channel.', 'Oruinwan') });
        return { ok: true };
      },
    },
  },
  teamsMessage,
};
