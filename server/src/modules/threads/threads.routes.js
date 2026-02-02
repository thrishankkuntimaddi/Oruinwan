// server/src/modules/threads/threads.routes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const threadController = require('./threads.controller');

// Get all threads for a channel (parent messages with replyCount > 0)
router.get('/channels/:channelId/threads', requireAuth, threadController.getChannelThreads);

// Get thread (parent message + all replies)
router.get('/:messageId', requireAuth, threadController.getThread);

// Post reply to thread
router.post('/:messageId', requireAuth, threadController.postThreadReply);

// Get thread reply count
router.get('/:messageId/count', requireAuth, threadController.getThreadCount);

module.exports = router;
