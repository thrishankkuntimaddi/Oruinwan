'use strict';

/**
 * Token-based connectors (GitLab, Bitbucket, Linear, CI/CD, Slack, Teams,
 * Google Drive, OneDrive, Dropbox, Notion, Confluence, Google Meet, Zapier,
 * Make, n8n): configuration, credential checks, actions, incoming webhooks
 * and the Slack/Teams outgoing bridge.
 *
 * Secrets are sealed under SERVER_KEK (same scheme as GitHub/Jira) and never
 * leave the server; generated webhook secrets are shown once. Saving new
 * credentials verifies them with a real API call first.
 */

const mongoose = require('mongoose');
const Integration = require('./integration.model');
const webhookTrigger = require('./webhook.trigger');
const cfg = require('./integration.config');
const { sealSecret } = require('../../modules/conversations/cryptoUtils');
const { getConnector, isConnectorType, describe, CONNECTORS } = require('./connectors/registry');
const { applyEffects } = require('./integration.apply');
const logger = require('../../../utils/logger');

const MASK = cfg.MASK;

function httpError(status, message, code) {
  return Object.assign(new Error(message), { statusCode: status, status, ...(code && { code }) });
}
const badRequest = (m, code) => httpError(400, m, code);

function connectorOf(type) {
  const c = getConnector(type);
  if (!c) throw httpError(404, `Unknown integration type: ${type}`);
  return c;
}

function ctxOf(integration, config = integration?.config || {}) {
  return { integration, config, secret: (field) => cfg.readSecret(config, field) };
}

function isConfigured(c, config = {}) {
  if (typeof c.isConfigured === 'function') return !!c.isConfigured(config);
  return (c.required || []).every(k => !!config[k]);
}

/* ── Config ─────────────────────────────────────────────────────────── */

async function assertChannels(workspaceId, ids) {
  const uniq = [...new Set(ids.filter(Boolean).map(String))];
  if (!uniq.length) return;
  if (uniq.some(id => !mongoose.Types.ObjectId.isValid(id))) throw badRequest('Invalid channel id');
  const Channel = require('../channels/channel.model');
  const found = await Channel.find({ _id: { $in: uniq }, workspace: workspaceId }).select('_id').lean();
  const okIds = new Set(found.map(ch => String(ch._id)));
  const missing = uniq.filter(id => !okIds.has(id));
  if (missing.length) throw badRequest(`Channel(s) not in this workspace: ${missing.join(', ')}`);
}

function normalizeRoutes(c, routes) {
  if (!c.routes) throw badRequest(`${c.label} has no routes`);
  if (!Array.isArray(routes)) throw badRequest('routes must be an array');
  if (routes.length > 50) throw badRequest('At most 50 routes');
  const allowed = (c.routes.events || []).map(e => e.id);
  return routes.map((r) => {
    if (!r || typeof r !== 'object') throw badRequest('Each route must be an object');
    const match = String(r.match ?? r.repo ?? r.project ?? '').trim().toLowerCase().replace(/^#/, '');
    if (!match || match.length > 200) throw badRequest(`Each route needs a ${c.routes.label.toLowerCase()}`);
    if (match === '*' && c.routes.noWildcard) throw badRequest('Use a name, not *');
    const channelId = String(r.channelId || '');
    if (!mongoose.Types.ObjectId.isValid(channelId)) throw badRequest('Each route needs a valid channelId');
    const out = { match, channelId };
    if (allowed.length) {
      const events = r.events === undefined || r.events === null ? allowed : r.events;
      if (!Array.isArray(events) || events.some(e => !allowed.includes(e))) throw badRequest(`events must be a subset of: ${allowed.join(', ')}`);
      out.events = [...new Set(events)];
    }
    return out;
  });
}

/**
 * Bridges: { remote, channelId, direction: 'in'|'out'|'both' }. Turning on the
 * outgoing direction for a channel needs `acknowledgeOutgoing: true` (the UI
 * shows the "messages leave end-to-end encryption" warning); who and when is
 * recorded.
 */
function normalizeBridges(c, bridges, stored = [], userId) {
  if (!c.bridge) throw badRequest(`${c.label} has no bridges`);
  if (!Array.isArray(bridges)) throw badRequest('bridges must be an array');
  if (bridges.length > 50) throw badRequest('At most 50 bridges');
  const seen = new Set();
  return bridges.map((b) => {
    if (!b || typeof b !== 'object') throw badRequest('Each bridge must be an object');
    const remote = String(b.remote || '').trim();
    if (c.bridge.remoteRequired && !remote) throw badRequest(`Each bridge needs a ${c.bridge.remoteLabel}`);
    if (remote && remote !== '*' && !c.bridge.remotePattern.test(remote)) throw badRequest(`Invalid ${c.bridge.remoteLabel} "${remote.slice(0, 40)}"`);
    const channelId = String(b.channelId || '');
    if (!mongoose.Types.ObjectId.isValid(channelId)) throw badRequest('Each bridge needs a valid channelId');
    const direction = ['in', 'out', 'both'].includes(b.direction) ? b.direction : 'in';
    const key = `${remote}|${channelId}`;
    if (seen.has(key)) throw badRequest('Duplicate bridge');
    seen.add(key);
    const out = { remote: remote || '*', channelId, direction };
    if (direction !== 'in') {
      const prev = stored.find(s => String(s.channelId) === channelId && s.remote === out.remote && s.direction !== 'in' && s.outEnabledAt);
      if (prev) Object.assign(out, { outEnabledAt: prev.outEnabledAt, outEnabledBy: prev.outEnabledBy });
      else if (b.acknowledgeOutgoing === true) Object.assign(out, { outEnabledAt: new Date(), outEnabledBy: userId ? String(userId) : null });
      else throw badRequest('Sending messages out of Oruinwan takes them out of end-to-end encryption. Confirm this for the channel (acknowledgeOutgoing: true).', 'BRIDGE_ACK_REQUIRED');
    }
    return out;
  });
}

/**
 * Merge a partial config from the client into the stored one.
 * @returns {{ config, revealed, credentialsChanged }}
 */
async function mergeConfig(c, stored = {}, patch = {}, { workspaceId, userId } = {}) {
  const config = { ...c.defaults(), ...(stored || {}) };
  const revealed = {};
  let credentialsChanged = false;

  for (const field of c.secrets) {
    if (!(field in patch) || (c.generated || []).includes(field)) continue;
    const v = patch[field];
    if (v === MASK || v === undefined) continue;
    if (v === null || v === '') {
      if (config[field]) credentialsChanged = true;
      delete config[field];
    } else if (typeof v === 'string' && v.length <= 16_384) {
      const value = v.trim();
      c.secretChecks?.[field]?.(value);
      config[field] = sealSecret(value);
      credentialsChanged = true;
    } else {
      throw badRequest(`${field} must be a string`);
    }
  }
  for (const [field, normalise] of Object.entries(c.fields || {})) {
    if (patch[field] === undefined) continue;
    const next = normalise(patch[field]);
    if (next !== config[field]) credentialsChanged = credentialsChanged || (c.required || []).includes(field) || ['baseUrl', 'username', 'email'].includes(field);
    config[field] = next;
  }
  for (const t of c.toggles || []) {
    if (patch[t.key] !== undefined) config[t.key] = !!patch[t.key];
  }
  const channelIds = [];
  if (patch.routes !== undefined) {
    config.routes = normalizeRoutes(c, patch.routes);
    channelIds.push(...config.routes.map(r => r.channelId));
  }
  if (patch.defaultChannelId !== undefined && c.defaultChannel) {
    config.defaultChannelId = patch.defaultChannelId ? String(patch.defaultChannelId) : null;
    if (config.defaultChannelId) channelIds.push(config.defaultChannelId);
  }
  if (patch.bridges !== undefined) {
    config.bridges = normalizeBridges(c, patch.bridges, stored?.bridges || [], userId);
    channelIds.push(...config.bridges.map(b => b.channelId));
  }
  if (channelIds.length) await assertChannels(workspaceId, channelIds);

  for (const field of c.generated || []) {
    if (!config[field]) {
      const secret = cfg.generateSecret();
      config[field] = sealSecret(secret);
      revealed[field] = secret;
    }
  }
  return { config, revealed, credentialsChanged };
}

function redact(c, stored = {}, { isAdmin }) {
  const out = { ...c.defaults(), ...(stored || {}) };
  for (const field of c.secrets) {
    const set = !!stored?.[field];
    out[field] = set ? MASK : '';
    out[`has${field.charAt(0).toUpperCase()}${field.slice(1)}`] = set;
  }
  if (!isAdmin) {
    for (const field of c.memberHidden || []) out[field] = out[field] ? MASK : '';
    delete out.routes;
    if (Array.isArray(out.bridges)) out.bridges = out.bridges.map(({ outEnabledBy: _b, ...b }) => b);
  }
  return out;
}

function webhookUrl(c, workspaceId, req, token) {
  if (!c.webhook) return null;
  const base = `${cfg.publicBaseUrl(req)}/api/v2/integrations/webhook/${c.type}?workspaceId=${workspaceId}`;
  return c.webhook.tokenInUrl ? `${base}&token=${token ? encodeURIComponent(token) : MASK}` : base;
}

function view(c, integration, { req, isAdmin, revealed = null } = {}) {
  const config = integration?.config || {};
  const connected = integration?.status === 'connected';
  const out = {
    type: c.type,
    label: c.label,
    connected,
    status: integration?.status || 'disconnected',
    configured: isConfigured(c, config),
    config: redact(c, config, { isAdmin }),
    webhookUrl: null,
    lastEventAt: integration?.lastEventAt || null,
  };
  if (connected && isAdmin) out.webhookUrl = webhookUrl(c, integration.workspaceId, req, revealed?.webhookToken);
  if (revealed) {
    const secret = Object.values(revealed)[0];
    if (secret) out.webhookSecret = secret;
  }
  return out;
}

async function getConfig({ workspaceId, type, req, isAdmin }) {
  const c = connectorOf(type);
  const integration = await Integration.findOne({ workspaceId, type }).lean();
  return view(c, integration, { req, isAdmin });
}

async function verifyCredentials(c, config) {
  try {
    return await c.test(ctxOf(null, config));
  } catch (err) {
    throw httpError(err.statusCode === 429 ? 429 : 400, `${c.label}: could not verify — ${err.message}`, err.code || 'INTEGRATION_VERIFY_FAILED');
  }
}

/** Merge a partial config, verify new credentials with the provider, mark connected. */
async function saveConfig({ workspaceId, type, patch, userId, req, label }) {
  const c = connectorOf(type);
  const existing = await Integration.findOne({ workspaceId, type }).lean();
  const stored = existing?.status === 'connected' ? existing.config : {};
  const { config, revealed, credentialsChanged } = await mergeConfig(c, stored, patch || {}, { workspaceId, userId });
  if (!isConfigured(c, config)) {
    const need = c.form.filter(f => f.required).map(f => f.label).join(', ') || 'credentials';
    throw badRequest(`${c.label} needs ${need}`, 'INTEGRATION_NOT_CONFIGURED');
  }
  if (credentialsChanged || existing?.status !== 'connected') {
    const r = await verifyCredentials(c, config);
    config.account = r?.account || null;
    config.verifiedAt = new Date();
  }
  const integration = await Integration.findOneAndUpdate(
    { workspaceId, type },
    {
      config,
      status: 'connected',
      label: label || existing?.label || c.label,
      ...(existing?.status !== 'connected' && { connectedBy: userId }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  if (existing?.status !== 'connected') webhookTrigger.fire(workspaceId, 'integration.connected', { type, integrationId: integration._id });
  return view(c, integration, { req, isAdmin: true, revealed: Object.keys(revealed).length ? revealed : null });
}

async function testConnection({ workspaceId, type, patch = {}, userId }) {
  const c = connectorOf(type);
  const existing = await Integration.findOne({ workspaceId, type }).lean();
  const stored = existing?.status === 'connected' ? existing.config : {};
  let config;
  try {
    ({ config } = await mergeConfig(c, stored, patch, { workspaceId, userId }));
  } catch (err) {
    return { ok: false, message: err.message, code: err.code || null };
  }
  if (!isConfigured(c, config)) return { ok: false, message: `${c.label} needs its credentials before it can be tested`, code: 'INTEGRATION_NOT_CONFIGURED' };
  try {
    const r = await c.test(ctxOf(existing, config));
    return { ok: true, account: r?.account || null };
  } catch (err) {
    return { ok: false, message: err.message, code: err.code || null };
  }
}

async function rotateSecret({ workspaceId, type, req }) {
  const c = connectorOf(type);
  const field = (c.generated || [])[0];
  if (!field) throw badRequest(`${c.label} has no generated webhook secret to rotate`);
  const existing = await Integration.findOne({ workspaceId, type }).lean();
  if (!existing || existing.status !== 'connected') throw httpError(404, `${c.label} is not connected for this workspace`, 'INTEGRATION_NOT_CONNECTED');
  const secret = cfg.generateSecret();
  const config = { ...(existing.config || {}), [field]: sealSecret(secret) };
  const integration = await Integration.findOneAndUpdate({ workspaceId, type }, { config }, { new: true }).lean();
  return view(c, integration, { req, isAdmin: true, revealed: { [field]: secret } });
}

async function requireConnected(c, workspaceId) {
  const integration = await Integration.findOne({ workspaceId, type: c.type }).lean();
  if (!integration || integration.status !== 'connected') throw httpError(404, `${c.label} is not connected for this workspace`, 'INTEGRATION_NOT_CONNECTED');
  if (!isConfigured(c, integration.config || {})) throw badRequest(`${c.label} is connected but its credentials are incomplete`, 'INTEGRATION_NOT_CONFIGURED');
  return integration;
}

/* ── Actions ────────────────────────────────────────────────────────── */

/**
 * Run a connector action (list / search / create …). Actions flagged
 * `linksTask` link the created object to `input.taskId` when given (the task
 * must be visible to the caller).
 */
async function runAction({ workspaceId, type, action, input = {}, user, isAdmin, io }) {
  const c = connectorOf(type);
  const a = c.actions?.[action];
  if (!a) throw httpError(404, `${c.label} has no action "${action}"`);
  if (a.admin && !isAdmin) throw httpError(403, 'Only workspace owners and admins can do that');
  const integration = a.allowDisconnected
    ? await Integration.findOne({ workspaceId, type }).lean()
    : await requireConnected(c, workspaceId);
  let task = null;
  if (a.linksTask && input.taskId) task = await require('./github/github.service').loadVisibleTask(workspaceId, input.taskId, user.id);
  const result = await a.run(ctxOf(integration, integration?.config || {}), input, { workspaceId, user, io });
  if (a.linksTask) {
    const { link, note, ...rest } = result || {};
    if (task && link?.url) {
      await require('../tasks/tasks.service').applyExternalUpdate(String(task._id), {
        actorId: user.id, link, note: `${note || `${c.label} item linked`}${user.name ? ` by ${user.name}` : ''}`,
      }, io);
      rest.task = { id: String(task._id), issueKey: task.issueKey };
    }
    return rest;
  }
  return result;
}

const LINK_KIND = { file: 'file', folder: 'file', page: 'page', database: 'page', blogpost: 'page' };

/** Attach a file/page (fetched again by id, so the link is real) to a task. */
async function attachToTask({ workspaceId, type, itemId, taskId, user, io }) {
  const c = connectorOf(type);
  if (!c.actions?.item) throw badRequest(`${c.label} items cannot be attached`);
  if (!taskId) throw badRequest('taskId is required');
  const task = await require('./github/github.service').loadVisibleTask(workspaceId, taskId, user.id);
  const integration = await requireConnected(c, workspaceId);
  const { item } = await c.actions.item.run(ctxOf(integration), { id: itemId }, { workspaceId, user, io });
  if (!item?.url) throw httpError(502, `${c.label} returned no link for that item`);
  await require('../tasks/tasks.service').applyExternalUpdate(String(task._id), {
    actorId: user.id,
    link: { provider: type, kind: LINK_KIND[item.kind] || 'file', url: item.url, key: String(item.id).slice(0, 300), title: String(item.title || '').slice(0, 300), state: null },
    note: `${c.label}: “${String(item.title || 'item').slice(0, 120)}” attached${user.name ? ` by ${user.name}` : ''}`,
  }, io);
  return { item, task: { id: String(task._id), issueKey: task.issueKey } };
}

/** Copy a Notion / Confluence page into Knowledge (as the caller). */
async function importPage({ workspaceId, type, id, parentId, categoryId, user }) {
  const c = connectorOf(type);
  if (!c.actions?.import) throw badRequest(`${c.label} pages cannot be imported`);
  const integration = await requireConnected(c, workspaceId);
  const r = await c.actions.import.run(ctxOf(integration), { id }, { workspaceId, user });
  const footer = r.item?.url ? `\n\n---\n_Imported from [${c.label}](${r.item.url}) on ${new Date().toISOString().slice(0, 10)}._` : '';
  const knowledge = require('../knowledge/knowledge.service');
  const { page } = await knowledge.createPage(user.id, workspaceId, {
    title: String(r.title || 'Untitled').slice(0, 300),
    content: `${String(r.content || '').slice(0, 500_000)}${footer}`,
    parentId: parentId || null,
    categoryId: categoryId || null,
    tags: [r.source || type],
    icon: r.icon || '📄',
  });
  return { page: { id: String(page._id), title: page.title }, source: r.item || null };
}

/* ── Incoming webhooks ──────────────────────────────────────────────── */

/**
 * Verify, parse and apply one delivery. Throws 401 when unauthenticated.
 * @returns {Promise<{ body: object, automation: object|null }>}
 */
async function processWebhook({ type, integration, req, payload, io }) {
  const c = connectorOf(type);
  if (!integration || integration.status !== 'connected') throw httpError(401, 'No active integration for this workspace');
  const ctx = ctxOf(integration);
  const check = c.verifyWebhook ? c.verifyWebhook(req, ctx) : { ok: false, status: 401, message: `${c.label} does not accept webhooks` };
  if (!check.ok) throw httpError(check.status || 401, check.message);
  const headers = Object.fromEntries(Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const effects = await c.parseWebhook({ payload, headers, ctx });
  const applied = await applyEffects({ integration, connector: c, effects: effects || [], io });
  const body = applied.response || { ok: true, posted: applied.posted.length, tasks: applied.tasks, createdTasks: applied.createdTasks };
  return { body, automation: applied.automation };
}

/* ── Slack / Teams bridge ───────────────────────────────────────────── */

const BRIDGE_TYPES = Object.values(CONNECTORS).filter(c => c.bridge && typeof c.relay === 'function').map(c => c.type);
const relayed = new Map(); // messageId -> at (avoid double relays from several tabs)

/** Channels of the workspace that are bridged, and in which direction (members see this). */
async function bridgedChannels(workspaceId) {
  const list = await Integration.find({ workspaceId, type: { $in: BRIDGE_TYPES }, status: 'connected' }).select('type config.bridges').lean();
  const byChannel = new Map();
  for (const it of list) {
    for (const b of it.config?.bridges || []) {
      const key = String(b.channelId);
      if (!byChannel.has(key)) byChannel.set(key, { channelId: key, outgoing: false, providers: [] });
      const entry = byChannel.get(key);
      entry.providers.push({ type: it.type, label: getConnector(it.type).label, direction: b.direction });
      if (b.direction !== 'in') entry.outgoing = true;
    }
  }
  return [...byChannel.values()];
}

/**
 * Forward a message the caller just sent to the Slack/Teams channels bridged
 * "out" for that Oruinwan channel. The plaintext comes from the sender's own
 * client (the server cannot decrypt messages); only the sender of a recent
 * message in a channel they belong to may relay it, once.
 */
async function relayMessage({ workspaceId, channelId, messageId, text, user }) {
  if (!mongoose.Types.ObjectId.isValid(String(channelId)) || !mongoose.Types.ObjectId.isValid(String(messageId))) throw badRequest('Invalid channelId or messageId');
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body || body.length > 8000) throw badRequest('text must be 1–8000 characters');
  const integrations = await Integration.find({ workspaceId, type: { $in: BRIDGE_TYPES }, status: 'connected' }).lean();
  const targets = [];
  for (const it of integrations) {
    for (const b of it.config?.bridges || []) {
      if (String(b.channelId) === String(channelId) && b.direction !== 'in' && b.outEnabledAt) targets.push({ integration: it, bridge: b });
    }
  }
  if (!targets.length) return { relayed: [], failed: [] };

  const Channel = require('../channels/channel.model');
  const channel = await Channel.findOne({ _id: channelId, workspace: workspaceId, 'members.user': user.id }).select('_id name').lean();
  if (!channel) throw httpError(404, 'Channel not found');
  const Message = require('../../modules/messages/message.model.js');
  const msg = await Message.findOne({ _id: messageId, channel: channelId, sender: user.id, isDeleted: { $ne: true } }).select('_id createdAt').lean();
  if (!msg) throw httpError(404, 'Message not found');
  if (Date.now() - new Date(msg.createdAt).getTime() > 10 * 60_000) throw badRequest('Only messages from the last 10 minutes can be relayed');
  const key = String(messageId);
  if (relayed.has(key)) return { relayed: [], failed: [], duplicate: true };
  relayed.set(key, Date.now());
  if (relayed.size > 10_000) relayed.delete(relayed.keys().next().value);

  const out = { relayed: [], failed: [] };
  for (const { integration, bridge } of targets) {
    const c = getConnector(integration.type);
    try {
      const r = await c.relay(ctxOf(integration), bridge, { text: body, senderName: user.name, channelName: channel.name });
      out.relayed.push({ type: integration.type, via: r?.via || null });
    } catch (err) {
      logger.warn({ err: err.message, type: integration.type }, '[integrations] bridge relay failed');
      out.failed.push({ type: integration.type, message: err.message });
    }
  }
  return out;
}

function catalog() {
  return Object.values(CONNECTORS).map(describe);
}

module.exports = {
  isConnectorType,
  catalog,
  getConfig,
  saveConfig,
  testConnection,
  rotateSecret,
  runAction,
  attachToTask,
  importPage,
  processWebhook,
  bridgedChannels,
  relayMessage,
  mergeConfig,
  view,
  BRIDGE_TYPES,
  _relayed: relayed,
};
