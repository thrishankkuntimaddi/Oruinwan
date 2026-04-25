const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const internalMessagingController = require('./messaging.controller');

router.post('/messages', requireAuth, internalMessagingController.sendMessage);

router.get('/messages/conversation/:userId', requireAuth, internalMessagingController.getConversation);

router.get('/messages/inbox', requireAuth, internalMessagingController.getAdminInbox);

router.get('/messages/manager-inbox', requireAuth, internalMessagingController.getManagerInbox);

router.patch('/messages/:messageId/read', requireAuth, internalMessagingController.markAsRead);

router.get('/messages/unread-count', requireAuth, internalMessagingController.getUnreadCount);

module.exports = router;
