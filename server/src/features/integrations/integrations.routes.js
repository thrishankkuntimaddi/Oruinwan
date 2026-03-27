// server/src/features/integrations/integrations.routes.js
const router = require('express').Router();
const requireAuth = require('../../../middleware/auth');
const integrationService = require('./integration.service');
const aiProviderService = require('./ai-provider.service');
const Webhook = require('./webhook.model');

// ─── All routes require authentication ────────────────────────────────────────
router.use(requireAuth);

// ── Integration CRUD ──────────────────────────────────────────────────────────

// GET /api/v2/integrations?workspaceId=xxx
router.get('/', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

    const integrations = await integrationService.getIntegrations(workspaceId);
    res.json({ integrations });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// POST /api/v2/integrations/connect
router.post('/connect', async (req, res) => {
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

// POST /api/v2/integrations/disconnect
router.post('/disconnect', async (req, res) => {
  try {
    const { workspaceId, type } = req.body;
    if (!workspaceId || !type) return res.status(400).json({ message: 'workspaceId and type required' });

    const integration = await integrationService.disconnectIntegration({ workspaceId, type });
    res.json({ integration });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// POST /api/v2/integrations/webhook/:type (inbound webhook from external providers)
// No auth — external providers POST here. Workspace identified via query param.
router.post('/webhook/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { workspaceId } = req.query;

    // Slack URL verification challenge — must respond immediately
    if (req.body?.type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    const result = await integrationService.handleWebhook({
      type,
      payload: req.body,
      headers: req.headers,
      workspaceId
    });

    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// ── Webhook management ────────────────────────────────────────────────────────

// GET /api/v2/integrations/webhooks?workspaceId=xxx
router.get('/webhooks', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

    const webhooks = await Webhook.find({ workspaceId })
      .select('-secret') // never expose HMAC secret
      .lean();
    res.json({ webhooks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/v2/integrations/webhooks
router.post('/webhooks', async (req, res) => {
  try {
    const { workspaceId, event, url } = req.body;
    if (!workspaceId || !event || !url) {
      return res.status(400).json({ message: 'workspaceId, event, and url required' });
    }

    // Basic URL validation
    try { new URL(url); } catch { return res.status(400).json({ message: 'Invalid URL' }); }

    const webhook = await Webhook.create({
      workspaceId,
      event,
      url,
      createdBy: req.user.sub
    });

    res.status(201).json({ webhook: { ...webhook.toObject(), secret: webhook.secret } }); // expose secret on creation only
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/v2/integrations/webhooks/:id
router.delete('/webhooks/:id', async (req, res) => {
  try {
    const webhook = await Webhook.findByIdAndDelete(req.params.id);
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── AI Provider management ────────────────────────────────────────────────────

// GET /api/v2/integrations/ai-providers?workspaceId=xxx
router.get('/ai-providers', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

    const providers = await aiProviderService.getProviders(workspaceId);
    res.json({ providers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/v2/integrations/ai-providers/connect
router.post('/ai-providers/connect', async (req, res) => {
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

// POST /api/v2/integrations/ai-providers/switch
router.post('/ai-providers/switch', async (req, res) => {
  try {
    const { workspaceId, provider } = req.body;
    if (!workspaceId || !provider) return res.status(400).json({ message: 'workspaceId and provider required' });

    const updated = await aiProviderService.switchProvider({ workspaceId, provider });
    res.json({ provider: { ...updated.toObject(), apiKey: '••••••••' } });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// POST /api/v2/integrations/ai-providers/disconnect
router.post('/ai-providers/disconnect', async (req, res) => {
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
