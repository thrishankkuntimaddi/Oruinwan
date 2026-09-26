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

router.get('/webhooks', ...member, async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

    const webhooks = await Webhook.find({ workspaceId })
      .select('-secret') 
      .lean();
    res.json({ webhooks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/webhooks', ...admin, async (req, res) => {
  try {
    const { workspaceId, event, url } = req.body;
    if (!workspaceId || !event || !url) {
      return res.status(400).json({ message: 'workspaceId, event, and url required' });
    }

    
    let parsed;
    try { parsed = new URL(url); } catch { return res.status(400).json({ message: 'Invalid URL' }); }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ message: 'Webhook URL must use http or https' });
    }

    const webhook = await Webhook.create({
      workspaceId,
      event,
      url,
      createdBy: req.user.sub
    });

    res.status(201).json({ webhook: { ...webhook.toObject(), secret: webhook.secret } }); 
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/webhooks/:id', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Webhook not found' });
    }
    const webhook = await Webhook.findById(req.params.id).select('workspaceId').lean();
    // Only an owner/admin of the webhook's own workspace may delete it; anyone
    // else gets the same 404 as for a missing id, so ids cannot be probed.
    const userId = String(req.user.sub || req.user._id);
    const workspace = webhook && await Workspace.findOne(
      { _id: webhook.workspaceId, members: { $elemMatch: { user: userId, status: 'active', role: { $in: ADMIN_ROLES } } } }
    ).select('_id').lean();
    if (!webhook || !workspace) return res.status(404).json({ message: 'Webhook not found' });
    await Webhook.deleteOne({ _id: webhook._id });
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
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
    const { workspaceId, provider, apiKey, config } = req.body;
    if (!workspaceId || !provider || !apiKey) {
      return res.status(400).json({ message: 'workspaceId, provider, and apiKey required' });
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
