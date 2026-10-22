'use strict';

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const logger = require('../../../utils/logger');
const { role } = require('../processRole');
const { getRedis, isRedisConfigured, INSTANCE_ID } = require('../redis');
const { scheduledJobs } = require('../jobs/scheduler');
const { postgresStatus } = require('../postgres');
const { webAppUrl } = require('../utils/webAppUrl');
const jwt = require('jsonwebtoken');

// Instance name, job list, uptime and environment help an outsider map the system, so only a
// signed-in platform admin (the admin dashboards) gets them. Everyone else, including load
// balancers and the public status page, gets the up/down states.
async function isPlatformAdmin(req) {
  const header = req.headers?.authorization || '';
  if (!header.startsWith('Bearer ')) return false;
  try {
    const payload = jwt.verify(header.slice(7), process.env.ACCESS_TOKEN_SECRET);
    const identity = require('../../identity');
    const user = await identity.users.findById(payload.sub);
    return Boolean(user && Array.isArray(user.roles) && user.roles.includes('oruinwan_admin'));
  } catch {
    return false;
  }
}

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

    const details = (await isPlatformAdmin(req))
      ? { role, instance: INSTANCE_ID, jobs: scheduledJobs(), uptime: process.uptime(), environment: process.env.NODE_ENV || 'development' }
      : {};

    if (dbStatus !== 1) {
      return res.status(503).json({
        status: 'unhealthy',
        mongodb: dbStatusMap[dbStatus] || 'unknown',
        ...details,
        timestamp: new Date().toISOString(),
      });
    }

    res.json({
      status: 'healthy',
      mongodb: 'connected',
      redis: redisStatus(),
      postgres: await postgresStatus(),
      // The web app's address (FRONTEND_URL, already public in every email). The phone app
      // opens web pages there, since the API may live on another domain.
      webUrl: webAppUrl() || null,
      ...details,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Health check failed:', err);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  }
});

module.exports = router;
