const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const threadController = require('./threads.controller');

router.get('/channels/:channelId/threads', requireAuth, threadController.getChannelThreads);

router.get('/:messageId', requireAuth, threadController.getThread);

router.post('/:messageId', requireAuth, threadController.postThreadReply);

router.get('/:messageId/count', requireAuth, threadController.getThreadCount);

router.post('/:messageId/follow', requireAuth, threadController.followThread);

router.delete('/:messageId/follow', requireAuth, threadController.unfollowThread);

router.get('/:messageId/follow', requireAuth, threadController.getFollowStatus);

module.exports = router;
