'use strict';

const express = require('express');
const requireAuth = require('../../shared/middleware/auth');
const { buildIceConfig } = require('./iceServers');

const router = express.Router();

// Per-user ICE/TURN config for huddle peer connections. TURN credentials are
// short-lived and tied to the caller, so this is never cached publicly.
router.get('/ice-servers', requireAuth, async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json(await buildIceConfig(String(req.user.sub || req.user._id || req.user.id)));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
