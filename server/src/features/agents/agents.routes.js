'use strict';

/**
 * /api/agents — Agents & tools.
 *
 *   GET    /api/agents?workspaceId=…             directory + what's installed, for the workspace and for you (members)
 *   POST   /api/agents/install                   { workspaceId, agentId, apiKey, model? } (admins, for everyone)
 *   DELETE /api/agents/:agentId?workspaceId=…    uninstall (admins)
 *   POST   /api/agents/:agentId/dm               { workspaceId } → the DM with that agent (members)
 *
 * Installing verifies the key with a tiny live request first, so a wrong key never gets saved.
 * A member's own connection to an agent ("just for me") lives in /api/connections; when they have
 * one it answers their messages, else the workspace install does.
 * A DM with an agent is an ordinary encrypted DM with the agent's account; the person's app asks
 * the agent to answer each message (POST /api/ai/reply with `assistant`).
 */

const express = require('express');
const mongoose = require('mongoose');
const auth = require('../../shared/middleware/auth');
const { requireAIAccess } = require('../ai/ai.access');
const { AGENTS, TOOLS, PERSONAL_TOOLS, byId } = require('./agents.catalog');
const AIProvider = require('../integrations/ai-provider.model');
const aiProviderService = require('../integrations/ai-provider.service');
const { createProvider, modelsFor } = require('../../../../ai/providers');
const logger = require('../../../utils/logger');

const router = express.Router();
router.use(auth);

const member = requireAIAccess();
const admin = requireAIAccess({ adminOnly: true });

const providerIds = (id) => (id === 'anthropic' ? ['anthropic', 'claude'] : [id]);

function publicAgent(a, installed) {
  const { authorization, ...rest } = a;
  return {
    ...rest,
    installed: Boolean(a.builtIn || installed),
    ...(authorization ? { authorization: { type: authorization.type, label: authorization.label, keysUrl: authorization.keysUrl, keyHint: authorization.keyHint } } : {}),
    icon: a.id === 'default' ? '/icons/oruinwan-128.png' : `/icons/ai/${a.id}.svg`,
  };
}

router.get('/', member, async (req, res) => {
  try {
    const connections = require('../connections/connections.service');
    const identity = require('../../identity');
    const ws = await identity.workspaces.findById(req.aiWorkspace.id);
    const [records, mine] = await Promise.all([
      AIProvider.find({ workspaceId: req.aiWorkspace.id, status: 'active' }).lean(),
      require('../connections/connection.model').find({ workspaceId: req.aiWorkspace.id, userId: req.user.sub }).lean(),
    ]);
    const canConnectOwn = connections.mayConnect(ws, req.aiWorkspace.role);
    const has = (id) => records.find((r) => providerIds(id).includes(r.provider));
    const ownOf = (id) => connections.publicView(mine.find((c) => c.provider === id));
    const agents = AGENTS.map((a) => {
      const r = has(a.id);
      const own = a.builtIn ? null : ownOf(a.id);
      const ownInUse = Boolean(own && canConnectOwn);
      return {
        ...publicAgent(a, Boolean(r) || ownInUse),
        // installed: this person can chat with it. The two sources, and which one answers them:
        installedForWorkspace: Boolean(a.builtIn || r),
        connectedForYou: own,
        inUse: a.builtIn ? 'built-in' : ownInUse ? 'personal' : r ? 'workspace' : null,
        model: (ownInUse && own.model) || r?.config?.model || (a.builtIn ? null : modelsFor(a.id).chat),
        installedAt: r?.updatedAt || null,
      };
    });
    const { isEnabled } = require('../../shared/featureFlags');
    const tools = TOOLS.map((t) => {
      const own = ownOf(t.id);
      const personal = PERSONAL_TOOLS[t.id] && isEnabled('integrations') ? PERSONAL_TOOLS[t.id] : null;
      return {
        ...t,
        ...(personal && { personal: { ...personal, oauth: t.id === 'github' && require('../connections/github.oauth').configured() } }),
        connectedForYou: personal ? own : null,
      };
    });
    return res.json({
      agents,
      tools,
      canManage: req.aiWorkspace.isAdmin,
      policy: { ...connections.policyOf(ws), canConnectOwn },
    });
  } catch (err) {
    logger.error({ err }, '[Agents] list failed');
    return res.status(500).json({ message: 'Could not load agents' });
  }
});

/** A tiny real request with the key: proves it works before it's saved. */
async function verifyKey(agentId, apiKey, model) {
  const models = { ...modelsFor(agentId), ...(model && { chat: model, fast: model }) };
  const provider = createProvider(agentId, { apiKey, defaultModels: models });
  try {
    await provider.generateText({ model: models.fast, prompt: 'Reply with the single word OK.', generationConfig: { maxOutputTokens: 5, temperature: 0 } });
    return null;
  } catch (err) {
    const status = err?.status || err?.response?.status;
    if (status === 401 || status === 403 || /api.?key|unauthori[sz]ed|permission/i.test(err?.message || '')) return 'That key was not accepted. Check it and try again.';
    if (status === 404 || /model/i.test(err?.message || '')) return `The model "${models.fast}" wasn't found for this key. Leave Model empty to use the default.`;
    if (status === 429) return 'The key works but has no quota left (rate limited or out of credit).';
    return `Couldn't reach ${byId(agentId)?.maker || 'the provider'} to check the key. Try again in a moment.`;
  }
}

router.post('/install', admin, async (req, res) => {
  try {
    const { agentId } = req.body || {};
    const agent = byId(agentId);
    if (!agent || agent.builtIn) return res.status(400).json({ message: 'Unknown agent' });
    const apiKey = typeof req.body.apiKey === 'string' ? req.body.apiKey.trim() : '';
    const model = typeof req.body.model === 'string' && req.body.model.trim() ? req.body.model.trim().slice(0, 80) : null;
    if (!apiKey || apiKey.length > 500) return res.status(400).json({ message: `Paste your ${agent.authorization.label}` });

    const problem = await verifyKey(agent.id, apiKey, model);
    if (problem) return res.status(400).json({ message: problem, code: 'AGENT_KEY_REJECTED' });

    await aiProviderService.connectProvider({
      workspaceId: req.aiWorkspace.id, provider: agent.id, apiKey, config: model ? { model } : {}, userId: req.user.sub,
    });
    require('../connections/connections.audit').record(req, req.aiWorkspace.id, 'agent.installed_for_workspace', { provider: agent.id, name: agent.name });
    return res.status(201).json({ agent: publicAgent(agent, true) });
  } catch (err) {
    logger.error({ err }, '[Agents] install failed');
    return res.status(500).json({ message: 'Could not install the agent' });
  }
});

router.delete('/:agentId', admin, async (req, res) => {
  try {
    const agent = byId(req.params.agentId);
    if (!agent || agent.builtIn) return res.status(400).json({ message: 'Unknown agent' });
    for (const provider of providerIds(agent.id)) {
      await aiProviderService.disconnectProvider({ workspaceId: req.aiWorkspace.id, provider });
    }
    require('../connections/connections.audit').record(req, req.aiWorkspace.id, 'agent.removed_from_workspace', { provider: agent.id, name: agent.name });
    return res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, '[Agents] uninstall failed');
    return res.status(500).json({ message: 'Could not uninstall the agent' });
  }
});

/** The caller's DM with an agent in this workspace (created on first use). */
router.post('/:agentId/dm', member, async (req, res) => {
  try {
    const agent = byId(req.params.agentId);
    if (!agent) return res.status(404).json({ message: 'Unknown agent' });
    if (!agent.builtIn) {
      // The person's own connection is enough; otherwise the workspace must have it installed.
      const mine = await require('../connections/connections.service').personalFor(req.aiWorkspace.id, req.user.sub, agent.id);
      const record = mine ? null : await AIProvider.findOne({ workspaceId: req.aiWorkspace.id, provider: { $in: providerIds(agent.id) }, status: 'active' }).lean();
      if (!mine && !record) return res.status(400).json({ message: `${agent.name} isn't connected for you or installed in this workspace.`, code: 'AGENT_NOT_INSTALLED' });
    }
    const { getAssistantUser } = require('../ai/ai.conversation.service');
    const bot = await getAssistantUser(agent.id);
    const DMSession = require('../../../models/DMSession');
    const identity = require('../../identity');
    const ws = await identity.workspaces.findById(req.aiWorkspace.id);

    const participants = [new mongoose.Types.ObjectId(String(req.user.sub)), new mongoose.Types.ObjectId(String(bot._id))]
      .sort((a, b) => a.toString().localeCompare(b.toString()));
    // One chat per person and agent (the same unique pair key as people's DMs; the agent's
    // bot user is not a workspace member, so this doesn't go through findOrCreateDMSession).
    const pairKey = DMSession.dmPairKey(req.aiWorkspace.id, req.user.sub, bot._id);
    let dm = await DMSession.findOne({ pairKey })
      || await DMSession.findOne({ workspace: req.aiWorkspace.id, participants: { $all: participants, $size: 2 }, isGroup: { $ne: true } });
    if (dm && !dm.pairKey) await DMSession.updateOne({ _id: dm._id }, { $set: { pairKey } }).catch(() => {});
    if (!dm) {
      try {
        dm = await DMSession.findOneAndUpdate(
          { pairKey },
          { $setOnInsert: { pairKey, workspace: req.aiWorkspace.id, company: ws?.company || null, participants, isGroup: false, lastMessageAt: new Date() } },
          { upsert: true, new: true }
        );
      } catch (err) {
        if (err.code !== 11000) throw err;
        dm = await DMSession.findOne({ pairKey });
      }
    }
    // The person holds the key; the server keeps its escrowed copy to encrypt the agent's answers.
    try {
      await require('../../modules/conversations/conversationKeys.service').ensureDMConversationKey(dm._id);
    } catch (err) {
      logger.warn({ err: err.message }, '[Agents] DM key ensure failed (non-fatal)');
    }
    return res.json({ dmSessionId: String(dm._id), agent: publicAgent(agent, true), botUserId: String(bot._id) });
  } catch (err) {
    logger.error({ err }, '[Agents] open DM failed');
    return res.status(500).json({ message: 'Could not open the conversation' });
  }
});

module.exports = router;
module.exports._internal = { verifyKey };
