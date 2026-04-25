'use strict';

const express = require('express');
const router = express.Router();
const auth = require('../../shared/middleware/auth');
const activityController = require('./activity.controller');

router.use(auth);

router.get('/feed',  activityController.getFeed);
router.get('/me',    activityController.getMyActivity);
router.get('/stats', activityController.getStats);

module.exports = router;
