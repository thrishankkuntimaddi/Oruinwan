'use strict';

/**
 * Generic incoming webhooks (Slack-compatible JSON) that post into a channel.
 *
 *   POST /api/v2/integrations/hooks/:id/:token
 *   { "text": "Deployed v2.3", "username": "Deploy bot", "attachments": [{ "title", "title_link", "text", "fallback" }], "blocks": [...] }
 *
 * Messages are posted by the "Incoming webhook" bot as integration cards of
 * kind 'message', flagged notE2EE: the sender wrote them outside Oruinwan's
 * end-to-end encryption, and the UI says so.
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const IncomingWebhook = require('./incomingWebhook.model');
const cfg = require('./integration.config');
const bot = require('./integration.bot');
const { sealSecret } = require('../../modules/conversations/cryptoUtils');
const { safeEqual } = require('./connectors/http');

function httpError(status, message, code) {
  return Object.assign(new Error(message), { statusCode: status, status, ...(code && { code }) });
}

const urlFor = (hook, token, req) => `${cfg.publicBaseUrl(req)}/api/v2/integrations/hooks/${hook._id}/${token}`;

function shape(hook, { req, token = null, reveal = false } = {}) {
  const plain = token || (reveal ? cfg.readSecret(hook, 'token') : null);
  return {
    id: String(hook._id),
    name: hook.name,
    channelId: String(hook.channelId),
    isActive: hook.isActive !== false,
    lastUsedAt: hook.lastUsedAt || null,
    useCount: hook.useCount || 0,
    createdAt: hook.createdAt || null,
    url: plain ? urlFor(hook, plain, req) : null,
  };
}

async function assertChannel(workspaceId, channelId) {
  if (!mongoose.Types.ObjectId.isValid(String(channelId || ''))) throw httpError(400, 'channelId is required');
  const channel = await bot.loadPostableChannel(workspaceId, channelId);
  if (!channel) throw httpError(400, 'That channel is not in this workspace (or is archived)');
}

async function list(workspaceId, { req, isAdmin }) {
  const hooks = await IncomingWebhook.find({ workspaceId }).sort({ createdAt: -1 }).lean();
  return hooks.map(h => shape(h, { req, reveal: isAdmin }));
}

async function create({ workspaceId, channelId, name, userId, req }) {
  const n = String(name || '').trim().slice(0, 80);
  if (!n) throw httpError(400, 'name is required');
  await assertChannel(workspaceId, channelId);
  if (await IncomingWebhook.countDocuments({ workspaceId }) >= 50) throw httpError(400, 'At most 50 incoming webhooks per workspace');
  const token = crypto.randomBytes(24).toString('hex');
  const hook = await IncomingWebhook.create({ workspaceId, channelId, name: n, token: sealSecret(token), createdBy: userId });
  return shape(hook.toObject(), { req, token });
}

async function loadInWorkspace(id, workspaceId) {
  if (!mongoose.Types.ObjectId.isValid(String(id))) throw httpError(400, 'Invalid webhook id');
  const hook = await IncomingWebhook.findOne({ _id: id, workspaceId }).lean();
  if (!hook) throw httpError(404, 'Webhook not found');
  return hook;
}

async function update({ id, workspaceId, patch, req }) {
  const hook = await loadInWorkspace(id, workspaceId);
  const set = {};
  if (patch.name !== undefined) {
    set.name = String(patch.name || '').trim().slice(0, 80);
    if (!set.name) throw httpError(400, 'name is required');
  }
  if (patch.channelId !== undefined) { await assertChannel(workspaceId, patch.channelId); set.channelId = patch.channelId; }
  if (patch.isActive !== undefined) set.isActive = !!patch.isActive;
  const updated = await IncomingWebhook.findByIdAndUpdate(hook._id, set, { new: true }).lean();
  return shape(updated, { req, reveal: true });
}

async function rotate({ id, workspaceId, req }) {
  const hook = await loadInWorkspace(id, workspaceId);
  const token = crypto.randomBytes(24).toString('hex');
  const updated = await IncomingWebhook.findByIdAndUpdate(hook._id, { token: sealSecret(token) }, { new: true }).lean();
  return shape(updated, { req, token });
}

async function remove({ id, workspaceId }) {
  const hook = await loadInWorkspace(id, workspaceId);
  await IncomingWebhook.deleteOne({ _id: hook._id });
}

/** Slack-style payload → one text block (text, attachments, section blocks). */
function textOf(body) {
  if (!body || typeof body !== 'object') return '';
  const parts = [];
  if (typeof body.text === 'string') parts.push(body.text);
  for (const b of Array.isArray(body.blocks) ? body.blocks.slice(0, 20) : []) {
    if (b?.text?.text) parts.push(String(b.text.text));
    for (const f of Array.isArray(b?.fields) ? b.fields.slice(0, 10) : []) if (f?.text) parts.push(String(f.text));
  }
  for (const a of Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : []) {
    const head = a?.title ? (a.title_link ? `${a.title} (${a.title_link})` : a.title) : null;
    const t = [a?.pretext, head, a?.text || (!head ? a?.fallback : null)].filter(Boolean).join('\n');
    if (t) parts.push(t);
  }
  return parts.join('\n')
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2 ($1)').replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .trim()
    .slice(0, 4000);
}

/** Public endpoint: post one message. Returns 'ok' like Slack does. */
async function deliver({ id, token, body, io }) {
  if (!mongoose.Types.ObjectId.isValid(String(id)) || typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) throw httpError(404, 'no_service');
  const hook = await IncomingWebhook.findById(id).lean();
  if (!hook || !safeEqual(token, cfg.readSecret(hook, 'token'))) throw httpError(404, 'no_service');
  if (hook.isActive === false) throw httpError(410, 'webhook_disabled');
  const text = textOf(body);
  if (!text) throw httpError(400, 'no_text');
  const username = typeof body.username === 'string' && body.username.trim() ? body.username.trim().slice(0, 80) : hook.name;
  const posted = await bot.upsertCard({
    workspaceId: hook.workspaceId,
    channelId: hook.channelId,
    provider: 'webhook',
    card: { provider: 'webhook', kind: 'message', url: null, author: username, title: null, extra: { bridged: true, notE2EE: true, hookId: String(hook._id) } },
    summary: text,
    dedupe: false,
    io,
  });
  if (!posted) throw httpError(409, 'channel_not_ready');
  await IncomingWebhook.updateOne({ _id: hook._id }, { lastUsedAt: new Date(), $inc: { useCount: 1 } }).catch(() => {});
  return { messageId: String(posted.message._id) };
}

module.exports = { list, create, update, rotate, remove, deliver, textOf };
