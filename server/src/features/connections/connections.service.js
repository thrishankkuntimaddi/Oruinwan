'use strict';

/**
 * Personal connections: an agent or tool a member connected for themselves.
 *
 * Rules (enforced here, so every caller gets them):
 *  - a connection belongs to one (workspace, person); every read and delete is filtered by both,
 *    so nobody can see, use or remove anyone else's;
 *  - the secret is sealed before it is stored and only opened for the owner's own requests;
 *  - workspace admins decide whether members may connect their own
 *    (workspace.settings.connections.membersMayConnect, on unless switched off). Admins may always.
 *    When it is off, members' personal connections are not used (they can still remove them).
 */

const UserConnection = require('./connection.model');
const identity = require('../../identity');
const { sealSecret, openSecret } = require('../../modules/conversations/cryptoUtils');
const logger = require('../../../utils/logger');

const AGENT_PROVIDERS = ['anthropic', 'openai', 'gemini', 'xai'];
const TOOL_PROVIDERS = ['github', 'jira'];

const isAdminRole = (role) => role === 'owner' || role === 'admin';

function membershipOf(ws, userId) {
  return (ws?.members || []).find((m) => String(m.user?._id || m.user) === String(userId) && m.status !== 'removed' && m.status !== 'suspended') || null;
}

/** The workspace's policy for personal connections. */
function policyOf(ws) {
  return { membersMayConnect: ws?.settings?.connections?.membersMayConnect !== false };
}

/** Whether this person may connect (and have used) their own agents and tools here. */
function mayConnect(ws, role) {
  return isAdminRole(role) || policyOf(ws).membersMayConnect;
}

/** What a client may see of a connection: never the secret. */
function publicView(c) {
  if (!c) return null;
  return {
    provider: c.provider,
    kind: c.kind,
    method: c.method,
    model: c.config?.model || null,
    site: c.provider === 'jira' ? c.config?.baseUrl || null : null,
    account: c.account && (c.account.login || c.account.name) ? { login: c.account.login || null, name: c.account.name || null, avatar: c.account.avatar || null } : null,
    connectedAt: c.createdAt || null,
    updatedAt: c.updatedAt || null,
    lastUsedAt: c.lastUsedAt || null,
  };
}

/** The caller's own connections in a workspace. */
async function listMine(workspaceId, userId) {
  const rows = await UserConnection.find({ workspaceId, userId }).lean();
  return rows.map(publicView);
}

/** Save (or replace) the caller's own connection. `secret` is plaintext here and sealed before saving. */
async function save({ workspaceId, userId, provider, method, secret, config = {}, account = null, scopes = [] }) {
  const kind = AGENT_PROVIDERS.includes(provider) ? 'agent' : TOOL_PROVIDERS.includes(provider) ? 'tool' : null;
  if (!kind) throw Object.assign(new Error('Unknown provider'), { status: 400 });
  const record = await UserConnection.findOneAndUpdate(
    { workspaceId, userId, provider },
    {
      workspaceId, userId, provider, kind, method,
      secret: sealSecret(String(secret)),
      config,
      account: account || {},
      scopes,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  invalidate(workspaceId);
  return publicView(record);
}

/** Remove the caller's own connection. Returns true when there was one. */
async function remove({ workspaceId, userId, provider }) {
  const r = await UserConnection.deleteOne({ workspaceId, userId, provider });
  invalidate(workspaceId);
  return (r?.deletedCount || 0) > 0;
}

/**
 * The plaintext secret and settings of a person's own connection, for that person's request only.
 * Null when they have none, or when the workspace doesn't allow members' own connections.
 * Pass `ws` when the caller already loaded the workspace.
 */
async function personalFor(workspaceId, userId, provider, { ws } = {}) {
  if (!workspaceId || !userId) return null;
  const record = await UserConnection.findOne({ workspaceId, userId, provider }).lean();
  if (!record) return null;
  const workspace = ws || await identity.workspaces.findById(workspaceId);
  const me = membershipOf(workspace, userId);
  if (!me || !mayConnect(workspace, me.role)) return null;
  let secret = null;
  try { secret = openSecret(record.secret); } catch (err) { logger.warn({ err: err.message, provider }, '[connections] could not open a personal secret'); }
  if (!secret) return null;
  UserConnection.updateOne({ _id: record._id }, { lastUsedAt: new Date() }).catch(() => {});
  return { secret, config: record.config || {}, account: record.account || null, method: record.method };
}

/** The person's own agent connections that are in use for them (policy applied), without secrets. */
async function usableAgents(workspaceId, userId, { ws } = {}) {
  if (!workspaceId || !userId) return [];
  const rows = await UserConnection.find({ workspaceId, userId, kind: 'agent' }).lean();
  if (!rows.length) return [];
  const workspace = ws || await identity.workspaces.findById(workspaceId);
  const me = membershipOf(workspace, userId);
  if (!me || !mayConnect(workspace, me.role)) return [];
  return rows.map(publicView);
}

/** How many members connected their own of each provider (admins see this; no names or keys). */
async function countsByProvider(workspaceId) {
  try {
    const rows = await UserConnection.aggregate([
      { $match: { workspaceId: new (require('mongoose').Types.ObjectId)(String(workspaceId)) } },
      { $group: { _id: '$provider', people: { $sum: 1 } } },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.people]));
  } catch {
    return {};
  }
}

/** Switch members' own connections on or off for a workspace. */
async function setPolicy(workspaceId, { membersMayConnect }) {
  const ws = await identity.workspaces.findById(workspaceId);
  const connections = { ...(ws?.settings?.connections || {}), membersMayConnect: Boolean(membersMayConnect) };
  await identity.workspaces.update(workspaceId, { settings: { $merge: true, connections } });
  invalidate(workspaceId);
  return policyOf({ settings: { connections } });
}

function invalidate(workspaceId) {
  try { require('../ai/ai.provider.resolver').invalidate(workspaceId); } catch { /* resolver not loaded */ }
}

module.exports = {
  AGENT_PROVIDERS, TOOL_PROVIDERS, isAdminRole, membershipOf, policyOf, mayConnect, publicView,
  listMine, save, remove, personalFor, usableAgents, countsByProvider, setPolicy,
};
