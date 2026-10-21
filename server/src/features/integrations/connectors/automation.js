'use strict';

/**
 * Zapier, Make and n8n: an inbound webhook URL (token in the URL or the
 * X-Oruinwan-Token header) the tool POSTs JSON to:
 *
 *   {
 *     "text":    "Deploy finished",                 → posted by the bot in a channel
 *     "channel": "deploys",                         → a route name (or omit: default channel)
 *     "title":   "optional bold title", "url": "https://… optional link",
 *     "task":    { "title": "…", "description": "…", "dueDate": "2026-11-01" }  → creates a task
 *     …anything else                                → passed to automations (webhook.received)
 *   }
 *
 * Outbound (Oruinwan → the tool) uses outgoing webhooks: add the tool's
 * "catch hook" URL under Settings → Integrations → Outgoing webhooks.
 */

const { clip, httpError } = require('./http');
const { verifyToken, pickRoute } = require('./common');

function routeFor(config, channel) {
  if (channel) {
    const r = pickRoute({ routes: (config.routes || []).filter(x => x.match !== '*') }, String(channel).replace(/^#/, ''));
    if (r) return r.channelId;
  }
  return config.defaultChannelId || null;
}

function makeParser(type, label) {
  return function parseWebhook({ payload, ctx }) {
    const out = [{ type: 'automation', data: { webhookType: type, ...(payload && typeof payload === 'object' ? payload : {}) } }];
    if (!payload || typeof payload !== 'object') return out;
    const channelId = routeFor(ctx.config, payload.channel);
    const text = clip(payload.text ?? payload.message, 4000);
    if (text && channelId) {
      const url = typeof payload.url === 'string' && /^https:\/\//.test(payload.url) ? payload.url.slice(0, 2000) : null;
      out.push({
        type: 'card', channelId, dedupe: false,
        card: { provider: type, kind: 'message', url, title: clip(payload.title, 200) || null, author: clip(payload.username || label, 80), extra: { bridged: true, notE2EE: true } },
        summary: text,
      });
    }
    const task = payload.task;
    if (task && typeof task === 'object' && clip(task.title, 300)) {
      if (!channelId) throw httpError(400, `${label}: set a default channel in Settings → Integrations before creating tasks`);
      const due = task.dueDate ? new Date(task.dueDate) : null;
      out.push({
        type: 'task.create', explicit: true, channelId,
        title: clip(task.title, 300), description: clip(task.description, 20_000),
        ...(due && !Number.isNaN(due.getTime()) && { dueDate: due }),
        note: `Created by ${label}`,
      });
    }
    return out;
  };
}

function connector(type, label, extraSetup) {
  return {
    type,
    label,
    category: 'automation',
    description: `Let ${label} post messages, create tasks and trigger automations; send Oruinwan events to ${label} with outgoing webhooks.`,
    setup: [
      `Save to get the inbound webhook URL (it contains a secret token — treat it like a password).`,
      `In ${label}, add an HTTP / Webhooks action that POSTs JSON to that URL: {"text": "…", "channel": "<route name>"} posts a message, {"task": {"title": "…"}} creates a task. Everything is also passed to automations ("When a webhook is received").`,
      extraSetup,
      `To send Oruinwan events to ${label}, add the ${label} catch-hook URL under Outgoing webhooks on this page.`,
    ],
    form: [],
    secrets: ['webhookToken'],
    generated: ['webhookToken'],
    fields: {},
    defaults: () => ({ routes: [], defaultChannelId: null }),
    toggles: [],
    routes: { label: 'Channel name used in "channel"', placeholder: 'deploys', hint: 'The name the automation sends in "channel"; without one the default channel is used.', events: null, noWildcard: true },
    defaultChannel: true,
    required: [],
    isConfigured: () => true,
    webhook: { tokenInUrl: true, how: 'Token in the URL or X-Oruinwan-Token' },
    async test() { return { account: { name: 'Webhook ready' } }; },
    verifyWebhook: (req, ctx) => verifyToken(req, ctx, 'webhookToken'),
    parseWebhook: makeParser(type, label),
    actions: {},
  };
}

module.exports = {
  zapier: connector('zapier', 'Zapier', 'Zapier: use "Webhooks by Zapier" → POST, payload type JSON.'),
  make: connector('make', 'Make', 'Make: use the HTTP → "Make a request" module, method POST, body type Raw / JSON.'),
  n8n: connector('n8n', 'n8n', 'n8n: use the HTTP Request node, method POST, body JSON.'),
  routeFor,
};
