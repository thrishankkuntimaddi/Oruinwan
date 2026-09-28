const router = require('express').Router();
const requireAuth = require('../../shared/middleware/auth');
const integrationService = require('./integration.service');
const aiProviderService = require('./ai-provider.service');
const { requireAIAccess } = require('../ai/ai.access');
const aiAdmin = requireAIAccess({ adminOnly: true });
const Webhook = require('./webhook.model');
const { requireFlag } = require('../../shared/featureFlags');

// Third-party provider connections stay behind the "integrations" flag until the
// provider handlers are real. Outgoing webhooks and AI providers are live features.
const integrationsFlag = requireFlag('integrations');

const mongoose = require('mongoose');
const Workspace = require('../../../models/Workspace');
const requireWorkspaceMember = require('../../shared/middleware/requireWorkspaceMember');

const ADMIN_ROLES = ['owner', 'admin'];

// A malformed id would otherwise reach Mongo and surface as a 500.
function validWorkspaceId(req, res, next) {
  const id = req.query.workspaceId || req.body?.workspaceId;
  if (id && !mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid workspaceId' });
  }
  next();
}

function requireWorkspaceAdmin(req, res, next) {
  if (!ADMIN_ROLES.includes(req.workspaceRole)) {
    return res.status(403).json({ message: 'Only workspace owners and admins can manage integrations and webhooks' });
  }
  next();
}

const member = [validWorkspaceId, requireWorkspaceMember];
const admin = [...member, requireWorkspaceAdmin];

router.use(requireAuth);

router.get('/', integrationsFlag, ...member, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

    const integrations = await integrationService.getIntegrations(workspaceId);
    res.json({ integrations });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/connect', integrationsFlag, ...admin, async (req, res) => {
  try {
    const { workspaceId, type, config, label } = req.body;
    if (!workspaceId || !type) return res.status(400).json({ message: 'workspaceId and type required' });

    const integration = await integrationService.connectIntegration({
      workspaceId,
      type,
      config: config || {},
      label,
      userId: req.user.sub
    });
    res.status(201).json({ integration });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/disconnect', integrationsFlag, ...admin, async (req, res) => {
  try {
    const { workspaceId, type } = req.body;
    if (!workspaceId || !type) return res.status(400).json({ message: 'workspaceId and type required' });

    const integration = await integrationService.disconnectIntegration({ workspaceId, type });
    res.json({ integration });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/webhook/:type', integrationsFlag, async (req, res) => {
  try {
    const { type } = req.params;
    const { workspaceId } = req.query;

    
    if (req.body?.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    const result = await integrationService.handleWebhook({
      type,
      payload: req.body,
      headers: req.headers,
      workspaceId
    });

    
    if (workspaceId) {
      try {
        const automationService = require('../automations/automation.service');
        const io = req.app.get('io');

        
        const payload = req.body || {};
        const isMergedPR = type === 'github' && payload.action === 'closed' && payload.pull_request?.merged;
        if (isMergedPR) {
          automationService.processEvent('github.pr_merged', {
            workspaceId,
            repo:   payload.repository?.name || '',
            title:  payload.pull_request?.title || '',
            actor:  payload.pull_request?.merged_by?.login || '',
            event:  payload
          }, io);
        }

        
        automationService.processEvent('webhook.received', {
          workspaceId,
          webhookType: type,
          event: payload
        }, io);
      } catch (autoErr) {
        
        require('../../../utils/logger').error('[IntegrationWebhook] Automation processEvent failed:', autoErr.message);
      }
    }

    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ── Outgoing webhooks ────────────────────────────────────────────────────────
// Members may list; create/toggle/test/delete are for workspace owners/admins.
// The signing secret is returned once, on create.

const { assertWorkspaceMember, isValidId, sendAccessError, userIdOf } = require('../../shared/utils/workspaceAccess');
const webhookTrigger = require('./webhook.trigger');

const wsGate = (adminOnly) => (req, res, next) => {
  const workspaceId = req.query.workspaceId || req.body?.workspaceId;
  assertWorkspaceMember(workspaceId, userIdOf(req.user), { adminOnly })
    .then((access) => { req.webhookAccess = access; next(); })
    .catch(err => sendAccessError(res, err, next));
};
const wsMember = wsGate(false);
const wsAdmin = wsGate(true);

function publicWebhook(hook) {
  const { secret: _secret, event: _event, ...rest } = hook;
  return { ...rest, events: Webhook.eventsOf(hook) };
}

/** What a plain member sees: no secret, and the URL reduced to its origin (paths/queries often carry tokens). */
function memberWebhook(hook) {
  const { url, createdBy: _createdBy, lastStatusCode: _s, failureCount: _f, ...rest } = publicWebhook(hook);
  let origin = null;
  try { origin = new URL(url).origin; } catch { /* ignore */ }
  return { ...rest, url: origin };
}

const LOCAL_WEBHOOK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Validate a webhook URL: https, or plain http only for localhost / 127.0.0.1 (local testing). */
function parseWebhookUrl(url) {
  if (typeof url !== 'string' || !url.trim() || url.length > 2048) return null;
  let parsed;
  try { parsed = new URL(url.trim()); } catch { return null; }
  if (parsed.protocol === 'https:') return parsed;
  if (parsed.protocol === 'http:' && LOCAL_WEBHOOK_HOSTS.has(parsed.hostname)) return parsed;
  return null;
}

/** Load a webhook by :id for an admin of its workspace. Non-members get 404 (no id probing), members 403. */
async function loadManagedWebhook(req, { hideFromMembers = false } = {}) {
  const { HttpError } = require('../../shared/utils/workspaceAccess');
  if (!isValidId(req.params.id)) throw new HttpError(400, 'Invalid webhook id');
  const hook = await Webhook.findById(req.params.id).lean();
  if (!hook) throw new HttpError(404, 'Webhook not found');
  try {
    await assertWorkspaceMember(hook.workspaceId, userIdOf(req.user), { adminOnly: true });
  } catch (err) {
    if (err.status === 403 && err.code === 'WORKSPACE_ACCESS_DENIED') throw new HttpError(404, 'Webhook not found');
    if (err.status === 404) throw new HttpError(404, 'Webhook not found');
    if (hideFromMembers && err.status === 403) throw new HttpError(404, 'Webhook not found');
    throw err;
  }
  return hook;
}

router.get('/webhooks/events', (req, res) => {
  res.json({ events: Webhook.SUPPORTED_WEBHOOK_EVENTS, wildcard: '*' });
});

// Members may list (secret never included; non-admins see only the URL origin).
router.get('/webhooks', wsMember, async (req, res) => {
  try {
    const webhooks = await Webhook.find({ workspaceId: req.query.workspaceId })
      .select('-secret')
      .sort({ createdAt: -1 })
      .lean();
    const shape = req.webhookAccess?.isAdmin ? publicWebhook : memberWebhook;
    res.json({ webhooks: webhooks.map(shape) });
  } catch (err) {
    sendAccessError(res, err);
  }
});

router.post('/webhooks', wsAdmin, async (req, res) => {
  try {
    const { workspaceId, url } = req.body || {};
    let events = req.body?.events;
    if (events === undefined && req.body?.event !== undefined) events = [req.body.event];
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ message: 'events must be a non-empty array of event names' });
    }
    if (events.length > 50 || events.some(e => typeof e !== 'string')) {
      return res.status(400).json({ message: 'events must be an array of strings' });
    }
    const allowed = [...Webhook.SUPPORTED_EVENT_NAMES, '*'];
    const unknown = events.filter(e => !allowed.includes(e));
    if (unknown.length) {
      return res.status(400).json({ message: `Unsupported event(s): ${unknown.join(', ')}. Supported: ${allowed.join(', ')}` });
    }
    if (!url) return res.status(400).json({ message: 'url is required' });
    const parsed = parseWebhookUrl(url);
    if (!parsed) return res.status(400).json({ message: 'Webhook URL must be a valid https URL (plain http is allowed only for localhost)' });

    const webhook = await Webhook.create({
      workspaceId,
      events: [...new Set(events)],
      url: parsed.toString(),
      createdBy: req.user.sub
    });
    const obj = webhook.toObject();
    // The signing secret is shown once, here.
    res.status(201).json({ webhook: { ...publicWebhook(obj), secret: webhook.secret } });
  } catch (err) {
    if (err?.name === 'ValidationError') return res.status(400).json({ message: err.message });
    sendAccessError(res, err);
  }
});

router.patch('/webhooks/:id', async (req, res) => {
  try {
    const hook = await loadManagedWebhook(req);
    const active = req.body?.active ?? req.body?.isActive;
    if (typeof active !== 'boolean') return res.status(400).json({ message: 'active must be a boolean' });
    const update = { isActive: active };
    if (active) update.failureCount = 0;
    const updated = await Webhook.findByIdAndUpdate(hook._id, update, { new: true }).select('-secret').lean();
    res.json({ webhook: publicWebhook(updated) });
  } catch (err) {
    sendAccessError(res, err);
  }
});

router.post('/webhooks/:id/test', async (req, res) => {
  try {
    const hook = await loadManagedWebhook(req);
    const result = await webhookTrigger.sendTest(hook, { triggeredBy: req.user.sub });
    res.json(result);
  } catch (err) {
    sendAccessError(res, err);
  }
});

// Delete: anyone but an owner/admin of the webhook's workspace gets 404.
router.delete('/webhooks/:id', async (req, res) => {
  try {
    const hook = await loadManagedWebhook(req, { hideFromMembers: true });
    await Webhook.deleteOne({ _id: hook._id });
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    sendAccessError(res, err);
  }
});

router.get('/ai-providers', requireAIAccess(), async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

    const providers = await aiProviderService.getProviders(workspaceId);
    res.json({ providers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/ai-providers/connect', aiAdmin, async (req, res) => {
  try {
    const { workspaceId, provider, config } = req.body;
    let { apiKey } = req.body;
    // A self-hosted engine (local_llm) usually has no key.
    if (!workspaceId || !provider || (!apiKey && provider !== 'local_llm')) {
      return res.status(400).json({ message: 'workspaceId, provider, and apiKey required' });
    }
    if (provider === 'local_llm') {
      if (!apiKey) apiKey = '';
      const baseUrl = config?.baseUrl;
      if (baseUrl !== undefined && baseUrl !== null && baseUrl !== '') {
        let u = null;
        try { u = new URL(String(baseUrl)); } catch { /* invalid */ }
        if (!u || !['http:', 'https:'].includes(u.protocol)) {
          return res.status(400).json({ message: 'config.baseUrl must be an http(s) URL' });
        }
      }
    }

    const record = await aiProviderService.connectProvider({
      workspaceId, provider, apiKey, config: config || {}, userId: req.user.sub
    });
    res.status(201).json({ provider: { ...record.toObject(), apiKey: '••••••••' } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/ai-providers/switch', aiAdmin, async (req, res) => {
  try {
    const { workspaceId, provider } = req.body;
    if (!workspaceId || !provider) return res.status(400).json({ message: 'workspaceId and provider required' });

    const updated = await aiProviderService.switchProvider({ workspaceId, provider });
    res.json({ provider: { ...updated.toObject(), apiKey: '••••••••' } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

router.post('/ai-providers/disconnect', aiAdmin, async (req, res) => {
  try {
    const { workspaceId, provider } = req.body;
    if (!workspaceId || !provider) return res.status(400).json({ message: 'workspaceId and provider required' });

    const updated = await aiProviderService.disconnectProvider({ workspaceId, provider });
    res.json({ provider: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
