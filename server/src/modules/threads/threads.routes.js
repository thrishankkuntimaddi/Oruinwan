// server/src/modules/threads/threads.routes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const threadController = require('./threads.controller');

// Get all threads for a channel (parent messages with replyCount > 0)
router.get('/channels/:channelId/threads', requireAuth, threadController.getChannelThreads);

// Get thread (parent message + all replies) — also returns followStatus
router.get('/:messageId', requireAuth, threadController.getThread);

// Post reply to thread
router.post('/:messageId', requireAuth, threadController.postThreadReply);

// Get thread reply count
router.get('/:messageId/count', requireAuth, threadController.getThreadCount);

// ── Thread Follow Endpoints ──────────────────────────────────────────
// Follow a thread (manual follow)
router.post('/:messageId/follow', requireAuth, threadController.followThread);

// Unfollow a thread
router.delete('/:messageId/follow', requireAuth, threadController.unfollowThread);

// Get current user's follow status for a thread
router.get('/:messageId/follow', requireAuth, threadController.getFollowStatus);

module.exports = router;
