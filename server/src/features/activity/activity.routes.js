/**
 * server/src/features/activity/activity.routes.js
 *
 * Unified Activity Stream — Routes
 *   GET /api/activity/feed?workspaceId=xxx&limit=20&before=<iso>&type=task&actor=<id>
 *   GET /api/activity/me?limit=20
 *   GET /api/activity/stats?workspaceId=xxx
 */

'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../shared/middleware/auth');
const activityController = require('./activity.controller');

// All activity routes require authentication
router.use(auth);

router.get('/feed',  activityController.getFeed);
router.get('/me',    activityController.getMyActivity);
router.get('/stats', activityController.getStats);

module.exports = router;

