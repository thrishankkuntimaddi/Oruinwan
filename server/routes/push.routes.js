'use strict';
const logger = require('../utils/logger');

const express = require('express');
const router = express.Router();
const identity = require('../src/identity');

const requireAuth = require('../src/shared/middleware/auth');

// Whether this server can deliver push notifications, per platform (the app hides the option otherwise).
router.get('/status', requireAuth, (req, res) => {
  res.json(require('../src/features/push/push.service').isConfigured());
});

const PLATFORMS = ['android', 'ios'];
const MAX_TOKENS_PER_USER = 10;

router.post('/register', requireAuth, async (req, res) => {
  try {
    const { token, platform } = req.body || {};
    if (typeof token !== 'string' || token.length < 20 || token.length > 4096) return res.status(400).json({ error: 'token is required' });
    if (!PLATFORMS.includes(platform)) return res.status(400).json({ error: `platform must be one of: ${PLATFORMS.join(', ')}` });

    const userId = req.user.sub || req.user._id || req.user.id;

    // One entry per token: drop any existing one, then add it with a fresh registeredAt.
    const user = await identity.users.findById(userId, { withSecrets: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const tokens = (Array.isArray(user.deviceTokens) ? user.deviceTokens : []).filter((t) => t.token !== token);
    // deviceId ties the token to a device session so revoking the device removes it (/api/v2/devices).
    const rawDeviceId = req.headers['x-device-id'] || req.body?.deviceId;
    const deviceId = typeof rawDeviceId === 'string' && rawDeviceId.length <= 256 ? rawDeviceId : undefined;
    tokens.push({ token, platform, registeredAt: new Date(), ...(deviceId ? { deviceId } : {}) });
    // Keep the newest few: old phones that never unregistered shouldn't pile up.
    await identity.users.update(userId, { deviceTokens: tokens.slice(-MAX_TOKENS_PER_USER) });

    res.json({ success: true, message: 'Device token registered' });
  } catch (err) {
    logger.error('[Push] Register error:', err.message);
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

router.post('/unregister', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const userId = req.user.sub || req.user._id || req.user.id;

    const user = await identity.users.findById(userId, { withSecrets: true });
    if (user) {
      const tokens = (Array.isArray(user.deviceTokens) ? user.deviceTokens : []).filter((t) => t.token !== token);
      await identity.users.update(userId, { deviceTokens: tokens });
    }

    res.json({ success: true, message: 'Device token removed' });
  } catch (err) {
    logger.error('[Push] Unregister error:', err.message);
    res.status(500).json({ error: 'Failed to remove device token' });
  }
});

module.exports = router;
