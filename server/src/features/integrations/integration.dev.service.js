'use strict';

/**
 * Developer integrations (GitHub, Jira, Zoom): configuration, credential
 * tests and the actions behind the /jira and /zoom slash commands.
 */

const Integration = require('./integration.model');
const webhookTrigger = require('./webhook.trigger');
const cfg = require('./integration.config');
const { createClient: githubClient } = require('./github/github.client');
const { createClient: jiraClient } = require('./jira/jira.client');
const zoom = require('./zoom/zoom.client');

const LABELS = { github: 'GitHub', jira: 'Jira', zoom: 'Zoom' };

function httpError(status, message, code) {
  return Object.assign(new Error(message), { statusCode: status, status, ...(code && { code }) });
}

function assertDevType(type) {
  if (!cfg.isDevType(type)) throw httpError(404, `Unknown integration type: ${type}`);
}

/** Response shape for GET/PUT config. */
function view(type, integration, { req, isAdmin, revealed = null } = {}) {
  const config = integration?.config || {};
  const connected = integration?.status === 'connected';
  const out = {
    type,
    connected,
    status: integration?.status || 'disconnected',
    configured: cfg.isConfigured(type, config),
    config: cfg.redactConfig(type, config, { isAdmin }),
    webhookUrl: null,
    lastEventAt: integration?.lastEventAt || null,
  };
  if (connected && type === 'github') out.webhookUrl = cfg.webhookUrlFor('github', integration.workspaceId, req);
  if (connected && type === 'jira' && isAdmin) out.webhookUrl = cfg.webhookUrlFor('jira', integration.workspaceId, req, { token: revealed?.webhookToken || null });
  if (revealed) {
    const secret = revealed.webhookSecret || revealed.webhookToken;
    if (secret) out.webhookSecret = secret;
  }
  return out;
}

async function getConfig({ workspaceId, type, req, isAdmin }) {
  assertDevType(type);
  const integration = await Integration.findOne({ workspaceId, type }).lean();
  return view(type, integration, { req, isAdmin });
}

/** Merge a partial config and mark the integration connected. */
async function saveConfig({ workspaceId, type, patch, userId, req, label }) {
  assertDevType(type);
  const existing = await Integration.findOne({ workspaceId, type }).lean();
  const stored = existing?.status === 'connected' ? existing.config : {};
  const { config, revealed } = await cfg.mergeConfig(type, stored, patch || {}, workspaceId);
  const integration = await Integration.findOneAndUpdate(
    { workspaceId, type },
    {
      config,
      status: 'connected',
      label: label || existing?.label || LABELS[type],
      ...(existing?.status !== 'connected' && { connectedBy: userId }),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  if (existing?.status !== 'connected') {
    webhookTrigger.fire(workspaceId, 'integration.connected', { type, integrationId: integration._id });
  }
  return view(type, integration, { req, isAdmin: true, revealed: Object.keys(revealed).length ? revealed : null });
}

async function rotateSecret({ workspaceId, type, req }) {
  assertDevType(type);
  const existing = await Integration.findOne({ workspaceId, type }).lean();
  if (!existing || existing.status !== 'connected') throw httpError(404, `${LABELS[type]} is not connected for this workspace`, 'INTEGRATION_NOT_CONNECTED');
  const { config, field, secret } = cfg.rotateConfigSecret(type, existing.config || {});
  const integration = await Integration.findOneAndUpdate({ workspaceId, type }, { config }, { new: true }).lean();
  return view(type, integration, { req, isAdmin: true, revealed: { [field]: secret } });
}

/** Check credentials against the provider. `patch` lets the UI test values before saving. */
async function testConnection({ workspaceId, type, patch = {} }) {
  assertDevType(type);
  const existing = await Integration.findOne({ workspaceId, type }).lean();
  const stored = existing?.status === 'connected' ? existing.config : {};
  const { config } = await cfg.mergeConfig(type, stored, patch, workspaceId);
  if (!cfg.isConfigured(type, config)) {
    const need = { github: 'a personal access token', jira: 'baseUrl, email and apiToken', zoom: 'accountId, clientId and clientSecret' }[type];
    throw httpError(400, `${LABELS[type]} needs ${need} before it can be tested`, 'INTEGRATION_NOT_CONFIGURED');
  }
  try {
    if (type === 'github') {
      const gh = githubClient(cfg.readSecret(config, 'token'));
      const user = await gh.getUser();
      const limits = await gh.rateLimit().catch(() => null);
      return { ok: true, account: { login: user.login, name: user.name || null, avatar: user.avatar_url || null }, rateLimit: limits?.resources?.core || null };
    }
    if (type === 'jira') {
      const me = await jiraClient({ baseUrl: config.baseUrl, email: config.email, apiToken: cfg.readSecret(config, 'apiToken') }).myself();
      return { ok: true, account: { name: me.displayName || null, email: me.emailAddress || null, accountId: me.accountId || null } };
    }
    await zoom.getAccessToken({ accountId: config.accountId, clientId: config.clientId, clientSecret: cfg.readSecret(config, 'clientSecret') });
    return { ok: true, account: { accountId: config.accountId } };
  } catch (err) {
    return { ok: false, message: err.message, code: err.code || null };
  }
}

async function requireConnected(workspaceId, type) {
  const integration = await Integration.findOne({ workspaceId, type }).lean();
  if (!integration || integration.status !== 'connected') throw httpError(404, `${LABELS[type]} is not connected for this workspace`, 'INTEGRATION_NOT_CONNECTED');
  if (!cfg.isConfigured(type, integration.config)) throw httpError(400, `${LABELS[type]} is connected but its credentials are incomplete`, 'INTEGRATION_NOT_CONFIGURED');
  return integration;
}

/** POST /jira/issue */
async function createJiraIssue({ workspaceId, projectKey, summary, description, issueType, taskId, user, io }) {
  const key = String(projectKey || '').trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9_]{0,19}$/.test(key)) throw httpError(400, 'projectKey must be a Jira project key, e.g. ABC');
  const s = String(summary || '').trim();
  if (!s) throw httpError(400, 'summary is required');
  let task = null;
  if (taskId) task = await require('./github/github.service').loadVisibleTask(workspaceId, taskId, user.id);
  const integration = await requireConnected(workspaceId, 'jira');
  const c = integration.config;
  const client = jiraClient({ baseUrl: c.baseUrl, email: c.email, apiToken: cfg.readSecret(c, 'apiToken') });
  const footer = user.name ? `\n\nCreated from Oruinwan by ${user.name}` : '';
  const issue = await client.createIssue({
    projectKey: key,
    summary: s.slice(0, 255),
    description: `${String(description || '').slice(0, 30_000)}${footer}`,
    ...(issueType && { issueType: String(issueType).slice(0, 60) }),
  });
  const result = { issue: { key: issue.key, id: issue.id, url: issue.url, summary: s } };
  if (task) {
    await require('../tasks/tasks.service').applyExternalUpdate(String(task._id), {
      actorId: user.id,
      link: { provider: 'jira', kind: 'jira_issue', url: issue.url, key: issue.key, repo: key, title: s, state: 'To Do' },
      note: `Jira issue ${issue.key} created${user.name ? ` by ${user.name}` : ''}`,
    }, io);
    result.task = { id: String(task._id), issueKey: task.issueKey };
  }
  return result;
}

/** POST /zoom/meeting */
async function createZoomMeeting({ workspaceId, topic, start, durationMinutes }) {
  if (start !== undefined && start !== null && start !== '' && Number.isNaN(new Date(start).getTime())) {
    throw httpError(400, 'start must be an ISO date');
  }
  const integration = await requireConnected(workspaceId, 'zoom');
  const c = integration.config;
  return zoom.createMeeting(
    { accountId: c.accountId, clientId: c.clientId, clientSecret: cfg.readSecret(c, 'clientSecret') },
    { topic, start: start || null, durationMinutes }
  );
}

module.exports = { getConfig, saveConfig, rotateSecret, testConnection, createJiraIssue, createZoomMeeting, view };
