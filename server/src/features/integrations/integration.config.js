'use strict';

/**
 * Per-workspace developer integration config (GitHub, Jira, Zoom).
 *
 * Stored on the Integration record (`config`, Mixed). Secret fields are sealed
 * under SERVER_KEK with the same scheme as workspace AI keys (`enc:v1:...`)
 * and never leave the server: API responses carry '••••' plus a
 * `has<Field>` boolean. Webhook secrets are generated server-side and shown
 * once (right after they are created or rotated).
 */

const crypto = require('crypto');
const mongoose = require('mongoose');
const { sealSecret, openSecret } = require('../../modules/conversations/cryptoUtils');

const MASK = '••••';

const GITHUB_EVENTS = ['pull_request', 'pull_request_review', 'issues', 'push', 'check_suite', 'workflow_run'];

const SCHEMAS = {
  github: {
    secrets: ['token', 'webhookSecret'],
    defaults: () => ({ routes: [], linkTasks: true, autoReview: false, statusSync: true }),
    generated: ['webhookSecret'],
    memberHidden: [],
  },
  jira: {
    secrets: ['apiToken', 'webhookToken'],
    defaults: () => ({ baseUrl: '', email: '', routes: [], linkTasks: true, statusSync: true }),
    generated: ['webhookToken'],
    memberHidden: ['email'],
  },
  zoom: {
    secrets: ['clientSecret'],
    defaults: () => ({ accountId: '', clientId: '' }),
    generated: [],
    memberHidden: ['accountId', 'clientId'],
  },
};

const DEV_TYPES = Object.keys(SCHEMAS);

function isDevType(type) {
  return DEV_TYPES.includes(type);
}

function hasKey(field) {
  return `has${field.charAt(0).toUpperCase()}${field.slice(1)}`;
}

function badRequest(message) {
  return Object.assign(new Error(message), { statusCode: 400, status: 400 });
}

function generateSecret() {
  return crypto.randomBytes(24).toString('hex');
}

/** Plaintext of a stored (sealed) secret, or '' when unset/unreadable. */
function readSecret(config, field) {
  const v = config?.[field];
  if (!v) return '';
  try { return openSecret(v) || ''; } catch { return ''; }
}

/** Constant-time string comparison (false on length mismatch or missing values). */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const PROJECT_RE = /^[A-Z][A-Z0-9_]{0,19}$/;

function isRepo(s) {
  return typeof s === 'string' && REPO_RE.test(s);
}

/** Validate route entries; channel ids must be channels of this workspace. */
async function normalizeRoutes(type, routes, workspaceId) {
  if (!Array.isArray(routes)) throw badRequest('routes must be an array');
  if (routes.length > 50) throw badRequest('At most 50 routes');
  const out = [];
  for (const r of routes) {
    if (!r || typeof r !== 'object') throw badRequest('Each route must be an object');
    const channelId = String(r.channelId || '');
    if (!mongoose.Types.ObjectId.isValid(channelId)) throw badRequest('Each route needs a valid channelId');
    if (type === 'github') {
      const repo = String(r.repo || '').trim();
      if (repo !== '*' && !isRepo(repo)) throw badRequest(`Invalid repo "${repo}" (use owner/name or *)`);
      let events = r.events === undefined ? [...GITHUB_EVENTS] : r.events;
      if (!Array.isArray(events) || events.some(e => !GITHUB_EVENTS.includes(e))) {
        throw badRequest(`events must be a subset of: ${GITHUB_EVENTS.join(', ')}`);
      }
      out.push({ repo: repo === '*' ? '*' : repo.toLowerCase(), channelId, events: [...new Set(events)] });
    } else if (type === 'jira') {
      const project = String(r.project || '').trim().toUpperCase();
      if (project !== '*' && !PROJECT_RE.test(project)) throw badRequest(`Invalid Jira project key "${r.project}"`);
      out.push({ project, channelId });
    } else {
      throw badRequest(`${type} has no routes`);
    }
  }
  if (out.length) {
    const Channel = require('../channels/channel.model');
    const ids = [...new Set(out.map(r => r.channelId))];
    const found = await Channel.find({ _id: { $in: ids }, workspace: workspaceId }).select('_id').lean();
    const ok = new Set(found.map(c => String(c._id)));
    const missing = ids.filter(id => !ok.has(id));
    if (missing.length) throw badRequest(`Channel(s) not in this workspace: ${missing.join(', ')}`);
  }
  return out;
}

function normalizeBaseUrl(url) {
  if (url === '' || url === null) return '';
  let u;
  try { u = new URL(String(url)); } catch { throw badRequest('baseUrl must be a valid URL, e.g. https://your-team.atlassian.net'); }
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw badRequest('baseUrl must use https');
  return `${u.protocol}//${u.host}${u.pathname.replace(/\/+$/, '')}`;
}

/**
 * Merge a partial config from the client into the stored one.
 * @returns {{ config: object, revealed: object }} `revealed` holds generated secrets (plaintext) to show once.
 */
async function mergeConfig(type, stored = {}, patch = {}, workspaceId) {
  const schema = SCHEMAS[type];
  if (!schema) throw badRequest(`Unsupported integration type: ${type}`);
  const config = { ...schema.defaults(), ...(stored || {}) };
  const revealed = {};

  for (const field of schema.secrets) {
    if (!(field in patch)) continue;
    const v = patch[field];
    if (v === MASK || v === undefined) continue;
    if (v === null || v === '') {
      delete config[field];
    } else if (typeof v === 'string' && v.length <= 4096) {
      config[field] = sealSecret(v.trim());
    } else {
      throw badRequest(`${field} must be a string`);
    }
  }

  if (type === 'github') {
    for (const flag of ['linkTasks', 'autoReview', 'statusSync']) {
      if (patch[flag] !== undefined) config[flag] = !!patch[flag];
    }
    if (patch.routes !== undefined) config.routes = await normalizeRoutes(type, patch.routes, workspaceId);
  } else if (type === 'jira') {
    if (patch.baseUrl !== undefined) config.baseUrl = normalizeBaseUrl(patch.baseUrl);
    if (patch.email !== undefined) config.email = String(patch.email || '').trim().slice(0, 320);
    for (const flag of ['linkTasks', 'statusSync']) {
      if (patch[flag] !== undefined) config[flag] = !!patch[flag];
    }
    if (patch.routes !== undefined) config.routes = await normalizeRoutes(type, patch.routes, workspaceId);
  } else if (type === 'zoom') {
    if (patch.accountId !== undefined) config.accountId = String(patch.accountId || '').trim().slice(0, 200);
    if (patch.clientId !== undefined) config.clientId = String(patch.clientId || '').trim().slice(0, 200);
  }

  for (const field of schema.generated) {
    if (!config[field]) {
      const secret = generateSecret();
      config[field] = sealSecret(secret);
      revealed[field] = secret;
    }
  }
  return { config, revealed };
}

/** Rotate the generated webhook secret/token. */
function rotateConfigSecret(type, stored = {}) {
  const schema = SCHEMAS[type];
  const field = schema?.generated?.[0];
  if (!field) throw badRequest(`${type} has no webhook secret to rotate`);
  const secret = generateSecret();
  return { config: { ...stored, [field]: sealSecret(secret) }, field, secret };
}

/** Config for API responses: secrets masked, `has<Field>` booleans; members see less. */
function redactConfig(type, stored = {}, { isAdmin = false } = {}) {
  const schema = SCHEMAS[type];
  if (!schema) return {};
  const out = { ...schema.defaults(), ...(stored || {}) };
  for (const field of schema.secrets) {
    const set = !!stored?.[field];
    out[field] = set ? MASK : '';
    out[hasKey(field)] = set;
  }
  if (!isAdmin) for (const field of schema.memberHidden) out[field] = out[field] ? MASK : '';
  delete out.rateLimit;
  return out;
}

/** Public base URL for incoming webhooks (a tunnel URL during local development). */
function publicBaseUrl(req) {
  const env = process.env.INTEGRATIONS_PUBLIC_URL || process.env.BACKEND_URL;
  if (env) return env.replace(/\/+$/, '');
  if (req) return `${req.protocol}://${req.get('host')}`;
  return 'http://localhost:8080';
}

/**
 * Incoming webhook URL for a workspace. Jira carries its token in the URL, so
 * the token is only spelled out when `revealToken` is set (right after it was
 * generated / rotated); otherwise it is masked.
 */
function webhookUrlFor(type, workspaceId, req, { token = null } = {}) {
  if (!['github', 'jira', 'gitlab'].includes(type)) return null;
  const base = `${publicBaseUrl(req)}/api/v2/integrations/webhook/${type}?workspaceId=${workspaceId}`;
  if (type === 'jira') return `${base}&token=${token ? encodeURIComponent(token) : MASK}`;
  return base;
}

/** Whether the required credentials are present. */
function isConfigured(type, config = {}) {
  if (type === 'github') return !!config.token;
  if (type === 'jira') return !!(config.baseUrl && config.email && config.apiToken);
  if (type === 'zoom') return !!(config.accountId && config.clientId && config.clientSecret);
  return false;
}

module.exports = {
  MASK,
  GITHUB_EVENTS,
  SCHEMAS,
  DEV_TYPES,
  isDevType,
  isRepo,
  generateSecret,
  readSecret,
  safeEqual,
  mergeConfig,
  rotateConfigSecret,
  redactConfig,
  webhookUrlFor,
  publicBaseUrl,
  isConfigured,
  normalizeRoutes,
};
