'use strict';

const express = require('express');
const router = express.Router();
const User = require('../models/User');

const requireAuth = require('../src/shared/middleware/auth');

router.post('/register', requireAuth, async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const userId = req.user._id || req.user.id;

    await User.findByIdAndUpdate(
      userId,
      {
        $addToSet: {
          deviceTokens: { token, platform: platform || 'unknown', registeredAt: new Date() },
        },
      },
      { new: true }
    );

    res.json({ success: true, message: 'Device token registered' });
  } catch (err) {
    console.error('[Push] Register error:', err.message);
    res.status(500).json({ error: 'Failed to register device token' });
  }
});

router.post('/unregister', requireAuth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const userId = req.user._id || req.user.id;

    await User.findByIdAndUpdate(userId, {
      $pull: { deviceTokens: { token } },
    });

    res.json({ success: true, message: 'Device token removed' });
  } catch (err) {
    console.error('[Push] Unregister error:', err.message);
    res.status(500).json({ error: 'Failed to remove device token' });
  }
});

module.exports = router;
