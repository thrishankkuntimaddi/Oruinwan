const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const threadController = require('./threads.controller');

router.get('/channels/:channelId/threads', requireAuth, threadController.getChannelThreads);

// Threads I follow (the Threads view), before /:messageId so "following" is not an id.
router.get('/following', requireAuth, threadController.getFollowedThreads);

router.get('/:messageId', requireAuth, threadController.getThread);

router.post('/:messageId', requireAuth, threadController.postThreadReply);

router.get('/:messageId/count', requireAuth, threadController.getThreadCount);

router.post('/:messageId/follow', requireAuth, threadController.followThread);

router.delete('/:messageId/follow', requireAuth, threadController.unfollowThread);

router.get('/:messageId/follow', requireAuth, threadController.getFollowStatus);

// Followers: list, add people (they are notified), remove (yourself, or anyone as a channel admin).
router.get('/:messageId/followers', requireAuth, threadController.listFollowers);
router.post('/:messageId/followers', requireAuth, threadController.addFollowers);
router.delete('/:messageId/followers/:userId', requireAuth, threadController.removeFollower);

// Lock / unlock: channel admins, workspace admins, or the thread's starter.
router.post('/:messageId/lock', requireAuth, threadController.lockThread);
router.delete('/:messageId/lock', requireAuth, threadController.unlockThread);

module.exports = router;
