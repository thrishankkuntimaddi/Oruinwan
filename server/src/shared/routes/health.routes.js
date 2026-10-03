'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../../../utils/logger');
const { role } = require('../processRole');
const { getRedis, isRedisConfigured, INSTANCE_ID } = require('../redis');
const { scheduledJobs } = require('../jobs/scheduler');
const { postgresStatus } = require('../postgres');

/** 'disabled' | 'ready' | 'connecting' | 'down' — Redis is optional, so it never fails the check. */
function redisStatus() {
  if (!isRedisConfigured()) return 'disabled';
  const r = getRedis();
  if (!r) return 'down';
  return r.status === 'ready' ? 'ready' : r.status || 'connecting';
}

router.get('/', async (req, res) => {
  try {
    
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
      redis: redisStatus(),
      postgres: await postgresStatus(),
      role,
      instance: INSTANCE_ID,
      jobs: scheduledJobs(),
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
