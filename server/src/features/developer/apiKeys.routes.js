const express = require('express');
const router = express.Router();
const ApiKey = require('./apiKey.model');
const requireAuth = require('../../shared/middleware/auth');
const logger = require('../../../utils/logger');
const {
  requireWorkspaceAccess, assertWorkspaceMember, sendAccessError, isValidId,
} = require('../../shared/utils/workspaceAccess');

// Allowed scopes (mirrors the enum on apiKey.model.js).
const SCOPES = ApiKey.schema.path('permissions').caster?.enumValues
  || ['messages:read', 'tasks:read', 'tasks:write', 'files:read', 'users:read', 'channels:read', 'webhooks:read', 'webhooks:write', '*'];
const DEFAULT_SCOPES = ['messages:read', 'tasks:read', 'tasks:write', 'files:read', 'users:read', 'channels:read'];

router.use('/api-keys', requireAuth);

// API keys are workspace-admin tooling: list/create require owner/admin.
const adminOfQuery = requireWorkspaceAccess({ from: (req) => req.query?.workspaceId, adminOnly: true });
const adminOfBody = requireWorkspaceAccess({ from: (req) => req.body?.workspaceId, adminOnly: true });

router.get('/api-keys', adminOfQuery, async (req, res) => {
  try {
    const keys = await ApiKey.find({ workspaceId: req.workspaceAccess.workspaceId, isActive: true })
      .select('name keyPrefix permissions createdAt lastUsedAt usageCount createdBy')
      .populate('createdBy', 'username firstName lastName')
      .lean();

    res.json({ keys });
  } catch (err) {
    logger.error('[APIKeys] GET error:', err.message);
    res.status(500).json({ message: 'Failed to fetch API keys' });
  }
});

router.post('/api-keys', adminOfBody, async (req, res) => {
  try {
    const { name, permissions } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'name is required' });
    }
    if (name.trim().length > 100) return res.status(400).json({ message: 'name must be at most 100 characters' });
    let scopes = DEFAULT_SCOPES;
    if (permissions !== undefined) {
      if (!Array.isArray(permissions) || permissions.length === 0
        || !permissions.every(p => typeof p === 'string' && SCOPES.includes(p))) {
        return res.status(400).json({ message: `permissions must be a non-empty array of: ${SCOPES.join(', ')}` });
      }
      scopes = [...new Set(permissions)];
    }

    const { rawKey, keyHash, keyPrefix } = ApiKey.generateKey();

    const apiKey = await ApiKey.create({
      workspaceId: req.workspaceAccess.workspaceId,
      name: name.trim(),
      keyHash,
      keyPrefix,
      permissions: scopes,
      createdBy: req.user.sub
    });

    const keyDoc = await ApiKey.findById(apiKey._id)
      .select('name keyPrefix permissions createdAt')
      .lean();

    res.status(201).json({
      key: keyDoc,
      rawKey,
      message: 'Store this key securely — it will not be shown again.'
    });
  } catch (err) {
    logger.error('[APIKeys] POST error:', err.message);
    res.status(500).json({ message: 'Failed to create API key' });
  }
});

// Revoke: the caller must be owner/admin of the key's own workspace. An
// optional ?workspaceId= (or body.workspaceId) must match the key's workspace.
router.delete('/api-keys/:id', async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid API key id' });
    const key = await ApiKey.findById(req.params.id);
    if (!key || !key.isActive) return res.status(404).json({ message: 'API key not found' });

    const claimed = req.query?.workspaceId || req.body?.workspaceId;
    if (claimed && String(claimed) !== String(key.workspaceId)) {
      return res.status(404).json({ message: 'API key not found' });
    }
    await assertWorkspaceMember(key.workspaceId, req.user.sub, { adminOnly: true });

    key.isActive = false;
    await key.save();

    res.json({ message: 'API key revoked successfully' });
  } catch (err) {
    if (err.status) return sendAccessError(res, err);
    logger.error('[APIKeys] DELETE error:', err.message);
    res.status(500).json({ message: 'Failed to revoke API key' });
  }
});

module.exports = router;
