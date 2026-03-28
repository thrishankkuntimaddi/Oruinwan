'use strict';
// server/src/shared/routes/health.routes.js
//
// Health check endpoint for production monitoring.
// Migrated from server.js inline handler (Phase 4 cleanup).
// NO behavior change — same response shape as before.

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../../../utils/logger');

// GET /api/health
router.get('/', async (req, res) => {
  try {
    // Check MongoDB connection status
    const dbStatus = mongoose.connection.readyState;
    const dbStatusMap = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting',
    };

    if (dbStatus !== 1) {
      return res.status(503).json({
        status: 'unhealthy',
        mongodb: dbStatusMap[dbStatus] || 'unknown',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      status: 'healthy',
      mongodb: 'connected',
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Health check failed:', err);
    res.status(503).json({
      status: 'unhealthy',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
