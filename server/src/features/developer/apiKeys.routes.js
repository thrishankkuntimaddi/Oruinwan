// server/src/features/developer/apiKeys.routes.js
// Authenticated routes for workspace owners/admins to manage API keys
const express = require('express');
const router = express.Router();
const ApiKey = require('./apiKey.model');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');

router.use(requireAuth);

// GET /api/developer/api-keys — list API keys for the user's workspace
router.get('/api-keys', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId required' });

    const keys = await ApiKey.find({ workspaceId, isActive: true })
      .select('name keyPrefix permissions createdAt lastUsedAt usageCount')
      .populate('createdBy', 'username firstName lastName')
      .lean();

    res.json({ keys });
  } catch (err) {
    logger.error('[APIKeys] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// POST /api/developer/api-keys — create a new API key (raw key returned once)
router.post('/api-keys', async (req, res) => {
  try {
    const { workspaceId, name, permissions } = req.body;
    if (!workspaceId || !name) {
      return res.status(400).json({ error: 'workspaceId and name are required' });
    }

    const { rawKey, keyHash, keyPrefix } = ApiKey.generateKey();

    const apiKey = await ApiKey.create({
      workspaceId,
      name: name.trim(),
      keyHash,
      keyPrefix,
      permissions: permissions || ['messages:read', 'tasks:read', 'tasks:write', 'files:read', 'users:read', 'channels:read'],
      createdBy: req.user.sub
    });

    const keyDoc = await ApiKey.findById(apiKey._id)
      .select('name keyPrefix permissions createdAt')
      .lean();

    // Return rawKey ONLY on creation — never stored again
    res.status(201).json({
      key: keyDoc,
      rawKey, // shown once
      message: 'Store this key securely — it will not be shown again.'
    });
  } catch (err) {
    logger.error('[APIKeys] POST error:', err.message);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// DELETE /api/developer/api-keys/:id — revoke an API key
router.delete('/api-keys/:id', async (req, res) => {
  try {
    const key = await ApiKey.findById(req.params.id);
    if (!key) return res.status(404).json({ error: 'API key not found' });

    // Soft-delete (deactivate)
    key.isActive = false;
    await key.save();

    res.json({ message: 'API key revoked successfully' });
  } catch (err) {
    logger.error('[APIKeys] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

module.exports = router;
