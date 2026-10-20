'use strict';

/**
 * /api/connections — a person's own agents and tools inside a workspace ("just for me").
 *
 *   GET    /api/connections?workspaceId=…             your connections + the workspace policy (members)
 *   POST   /api/connections/agents/:agentId           { workspaceId, apiKey, model? }  key checked live first
 *   POST   /api/connections/github/token              { workspaceId, token }           checked against GitHub
 *   POST   /api/connections/github/authorize          { workspaceId, returnTo? } → { url }  GitHub OAuth
 *   GET    /api/connections/github/callback           GitHub sends the person back here (no session; signed state)
 *   POST   /api/connections/jira                      { workspaceId, baseUrl, email, apiToken }
 *   DELETE /api/connections/:provider?workspaceId=…   remove your own
 *   PUT    /api/connections/policy                    { workspaceId, membersMayConnect } (admins)
 *
 * Every route acts on the signed-in person's own connection only: there is no way to name
 * somebody else's. Keys and tokens are sealed before saving and never returned.
 */

const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const auth = require('../../shared/middleware/auth');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');
const { isEnabled } = require('../../shared/featureFlags');
const connections = require('./connections.service');
const audit = require('./connections.audit');
const githubOAuth = require('./github.oauth');
const { byId } = require('../agents/agents.catalog');
const logger = require('../../../utils/logger');

const router = express.Router();

const LABEL = { anthropic: 'Claude', openai: 'ChatGPT', gemini: 'Gemini', xai: 'Grok', github: 'GitHub', jira: 'Jira' };

// Each connect makes a live request to the provider: keep people from hammering them through us.
const connectLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.CONNECTIONS_PER_MIN || 20),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?.sub ? `c:${req.user.sub}` : ipKeyGenerator(req.ip)),
  handler: (_req, res) => res.status(429).json({ message: 'Too many attempts. Wait a minute and try again.' }),
});

function webAppUrl(returnTo, workspaceId, params) {
  const { isAllowedOrigin } = require('../../shared/allowedOrigins');
  const fallback = `${require('../../shared/utils/webAppUrl').webAppUrl()}/workspace/${workspaceId}/agents?tab=directory`;
  let target = returnTo && isAllowedOrigin(returnTo) ? returnTo : fallback;
  try {
    const u = new URL(target);
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    target = u.toString();
  } catch { /* fallback is always a URL */ }
  return target;
}

// ── GitHub OAuth callback: arrives from github.com without our session ─────────
router.get('/github/callback', async (req, res) => {
  const state = githubOAuth.readState(req.query.state);
  if (!state) return res.status(400).send('This GitHub sign-in link has expired. Go back to Oruinwan and choose Connect GitHub again.');
  const back = (params) => res.redirect(302, webAppUrl(state.returnTo, state.workspaceId, params));
  if (req.query.error) return back({ connectError: req.query.error === 'access_denied' ? 'You cancelled the GitHub sign-in.' : 'GitHub did not authorize the connection.' });
  if (!isEnabled('integrations') || !githubOAuth.configured()) return back({ connectError: 'GitHub sign-in is not set up on this server.' });
  try {
    const identity = require('../../identity');
    const ws = await identity.workspaces.findById(state.workspaceId, { activeOnly: true });
    const me = connections.membershipOf(ws, state.userId);
    if (!me || me.status !== 'active') return back({ connectError: 'You are no longer a member of this workspace.' });
    if (!connections.mayConnect(ws, me.role)) return back({ connectError: 'Your workspace admins turned off personal connections.' });
    const { token, scopes } = await githubOAuth.exchangeCode(req, req.query.code);
    const user = await require('../integrations/github/github.client').createClient(token).getUser();
    await connections.save({
      workspaceId: state.workspaceId, userId: state.userId, provider: 'github', method: 'oauth', secret: token, scopes,
      account: { id: String(user.id || ''), login: user.login || null, name: user.name || null, avatar: user.avatar_url || null },
    });
    await audit.record({ user: { sub: state.userId }, ip: req.ip, get: (h) => req.get(h) }, state.workspaceId, 'connection.personal_connected', { provider: 'github', method: 'oauth', account: user.login || null });
    return back({ connected: 'github' });
  } catch (err) {
    logger.warn({ err: err.message }, '[connections] GitHub OAuth callback failed');
    return back({ connectError: 'GitHub sign-in did not finish. Try again.' });
  }
});

router.use(auth);

const validWorkspace = (req, res, next) => {
  const id = req.query.workspaceId || req.body?.workspaceId;
  if (!id || !mongoose.Types.ObjectId.isValid(String(id))) return res.status(400).json({ message: 'workspaceId is required' });
  return next();
};
const member = [validWorkspace, requireWorkspaceMember];
const isAdminReq = (req) => connections.isAdminRole(req.workspaceRole);
const wsId = (req) => String(req.workspace._id);

/** Members may connect their own unless an admin turned it off (admins always may). */
function allowedToConnect(req, res, next) {
  if (connections.mayConnect(req.workspace, req.workspaceRole)) return next();
  return res.status(403).json({ message: 'Your workspace admins turned off personal connections. Ask an admin to install it for the workspace.', code: 'PERSONAL_CONNECTIONS_OFF' });
}

function toolsFlag(req, res, next) {
  if (isEnabled('integrations')) return next();
  return res.status(404).json({ message: 'Integrations are not enabled on this server' });
}

router.get('/', ...member, async (req, res) => {
  try {
    const mine = await connections.listMine(wsId(req), req.user.sub);
    const policy = { ...connections.policyOf(req.workspace), canConnectOwn: connections.mayConnect(req.workspace, req.workspaceRole), isAdmin: isAdminReq(req) };
    return res.json({
      connections: mine,
      policy,
      github: { oauth: isEnabled('integrations') && githubOAuth.configured() },
      // Admins see how many people use their own (no names, no keys).
      ...(policy.isAdmin && { counts: await connections.countsByProvider(wsId(req)) }),
    });
  } catch (err) {
    logger.error({ err }, '[connections] list failed');
    return res.status(500).json({ message: 'Could not load your connections' });
  }
});

router.put('/policy', ...member, async (req, res) => {
  try {
    if (!isAdminReq(req)) return res.status(403).json({ message: 'Only workspace admins can change this', code: 'INSUFFICIENT_WORKSPACE_ROLE' });
    if (typeof req.body?.membersMayConnect !== 'boolean') return res.status(400).json({ message: 'membersMayConnect must be true or false' });
    const policy = await connections.setPolicy(wsId(req), { membersMayConnect: req.body.membersMayConnect });
    await audit.record(req, wsId(req), 'connection.policy_changed', { membersMayConnect: policy.membersMayConnect });
    return res.json({ policy });
  } catch (err) {
    logger.error({ err }, '[connections] policy update failed');
    return res.status(500).json({ message: 'Could not save the setting' });
  }
});

// ── Agents: the person's own API key ──────────────────────────────────────────
router.post('/agents/:agentId', ...member, allowedToConnect, connectLimiter, async (req, res) => {
  try {
    const agent = byId(req.params.agentId);
    if (!agent || agent.builtIn) return res.status(400).json({ message: 'Unknown agent' });
    if (req.workspace.settings?.ai?.enabled === false) return res.status(403).json({ message: 'AI features are turned off for this workspace', code: 'AI_DISABLED' });
    const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
    const model = typeof req.body?.model === 'string' && req.body.model.trim() ? req.body.model.trim().slice(0, 80) : null;
    if (!apiKey || apiKey.length > 500) return res.status(400).json({ message: `Paste your ${agent.authorization.label}` });

    const problem = await require('../agents/agents.routes')._internal.verifyKey(agent.id, apiKey, model);
    if (problem) return res.status(400).json({ message: problem, code: 'AGENT_KEY_REJECTED' });

    const connection = await connections.save({
      workspaceId: wsId(req), userId: req.user.sub, provider: agent.id, method: 'api_key', secret: apiKey, config: model ? { model } : {},
    });
    await audit.record(req, wsId(req), 'connection.personal_connected', { provider: agent.id, method: 'api_key' });
    return res.status(201).json({ connection });
  } catch (err) {
    logger.error({ err }, '[connections] agent connect failed');
    return res.status(500).json({ message: 'Could not connect the agent' });
  }
});

// ── GitHub ────────────────────────────────────────────────────────────────────
router.post('/github/authorize', toolsFlag, ...member, allowedToConnect, (req, res) => {
  if (!githubOAuth.configured()) {
    return res.status(400).json({ message: 'GitHub sign-in is not set up on this server. Use a personal access token instead.', code: 'GITHUB_OAUTH_NOT_CONFIGURED' });
  }
  try {
    const returnTo = typeof req.body?.returnTo === 'string' ? req.body.returnTo.slice(0, 2000) : null;
    return res.json({ url: githubOAuth.authorizeUrl(req, { workspaceId: wsId(req), userId: req.user.sub, returnTo }) });
  } catch (err) {
    logger.error({ err }, '[connections] GitHub authorize failed');
    return res.status(500).json({ message: 'Could not start the GitHub sign-in' });
  }
});

router.post('/github/token', toolsFlag, ...member, allowedToConnect, connectLimiter, async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token || token.length > 500) return res.status(400).json({ message: 'Paste a GitHub personal access token' });
    let user;
    try {
      user = await require('../integrations/github/github.client').createClient(token).getUser();
    } catch (err) {
      const message = err.code === 'GITHUB_BAD_TOKEN' ? 'GitHub did not accept that token. Check it and try again.' : `Couldn't check the token with GitHub: ${err.message}`;
      return res.status(400).json({ message, code: 'TOOL_TOKEN_REJECTED' });
    }
    const connection = await connections.save({
      workspaceId: wsId(req), userId: req.user.sub, provider: 'github', method: 'token', secret: token,
      account: { id: String(user.id || ''), login: user.login || null, name: user.name || null, avatar: user.avatar_url || null },
    });
    await audit.record(req, wsId(req), 'connection.personal_connected', { provider: 'github', method: 'token', account: user.login || null });
    return res.status(201).json({ connection });
  } catch (err) {
    logger.error({ err }, '[connections] GitHub token connect failed');
    return res.status(500).json({ message: 'Could not connect GitHub' });
  }
});

// ── Jira Cloud: email + API token ─────────────────────────────────────────────
router.post('/jira', toolsFlag, ...member, allowedToConnect, connectLimiter, async (req, res) => {
  try {
    const { baseUrl, email, apiToken } = req.body || {};
    let site;
    try { site = normalizeJiraUrl(baseUrl); } catch (e) { return res.status(400).json({ message: e.message }); }
    const mail = String(email || '').trim().slice(0, 320);
    const token = String(apiToken || '').trim();
    if (!site || !mail || !token || token.length > 1000) return res.status(400).json({ message: 'Enter your Jira site, your Atlassian email and an API token' });
    let me;
    try {
      me = await require('../integrations/jira/jira.client').createClient({ baseUrl: site, email: mail, apiToken: token }).myself();
    } catch (err) {
      return res.status(400).json({ message: `Jira did not accept those details: ${err.message}`, code: 'TOOL_TOKEN_REJECTED' });
    }
    const connection = await connections.save({
      workspaceId: wsId(req), userId: req.user.sub, provider: 'jira', method: 'token', secret: token, config: { baseUrl: site, email: mail },
      account: { id: me.accountId || null, login: me.emailAddress || mail, name: me.displayName || null, avatar: me.avatarUrls?.['48x48'] || null },
    });
    await audit.record(req, wsId(req), 'connection.personal_connected', { provider: 'jira', method: 'token' });
    return res.status(201).json({ connection });
  } catch (err) {
    logger.error({ err }, '[connections] Jira connect failed');
    return res.status(500).json({ message: 'Could not connect Jira' });
  }
});

function normalizeJiraUrl(url) {
  let u;
  try { u = new URL(String(url || '').trim()); } catch { throw new Error('Enter your Jira site address, e.g. https://your-team.atlassian.net'); }
  const local = ['localhost', '127.0.0.1'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) throw new Error('Your Jira site address must start with https://');
  return `${u.protocol}//${u.host}`;
}

// ── Disconnect your own ───────────────────────────────────────────────────────
router.delete('/:provider', ...member, async (req, res) => {
  try {
    const provider = String(req.params.provider);
    if (!LABEL[provider]) return res.status(400).json({ message: 'Unknown connection' });
    // Filtered by the signed-in person: you can only ever remove your own.
    const removed = await connections.remove({ workspaceId: wsId(req), userId: req.user.sub, provider });
    if (!removed) return res.status(404).json({ message: `You have no ${LABEL[provider]} connection here` });
    await audit.record(req, wsId(req), 'connection.personal_disconnected', { provider });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[connections] disconnect failed');
    return res.status(500).json({ message: 'Could not disconnect' });
  }
});

module.exports = router;
