'use strict';
const logger = require('../utils/logger');

const express = require('express');
const router = express.Router();
const identity = require('../src/identity');

const requireAuth = require('../src/shared/middleware/auth');

router.post('/register', requireAuth, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const userId = req.user.sub || req.user._id || req.user.id;

    // One entry per token: drop any existing one, then add it with a fresh registeredAt.
    const user = await identity.users.findById(userId, { withSecrets: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const tokens = (Array.isArray(user.deviceTokens) ? user.deviceTokens : []).filter((t) => t.token !== token);
    tokens.push({ token, platform: platform || 'unknown', registeredAt: new Date() });
    await identity.users.update(userId, { deviceTokens: tokens });

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
