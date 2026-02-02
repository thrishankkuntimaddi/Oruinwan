// server/routes/internalMessaging.js
// Routes for internal messaging between managers and company admins

const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const internalMessagingController = require('./messaging.controller');

/**
 * @route   POST /api/internal/messages
 * @desc    Send a message (manager to admin or admin to manager)
 * @access  Private (authenticated users)
 */
router.post('/messages', requireAuth, internalMessagingController.sendMessage);

/**
 * @route   GET /api/internal/messages/conversation/:userId
 * @desc    Get conversation between current user and another user
 * @access  Private (authenticated users)
 */
router.get('/messages/conversation/:userId', requireAuth, internalMessagingController.getConversation);

/**
 * @route   GET /api/internal/messages/inbox
 * @desc    Get admin inbox (all conversations with managers)
 * @access  Private (admin only)
 */
router.get('/messages/inbox', requireAuth, internalMessagingController.getAdminInbox);

/**
 * @route   GET /api/internal/messages/manager-inbox
 * @desc    Get manager's inbox (conversations with admins)
 * @access  Private (manager only)
 */
router.get('/messages/manager-inbox', requireAuth, internalMessagingController.getManagerInbox);

/**
 * @route   PATCH /api/internal/messages/:messageId/read
 * @desc    Mark message as read
 * @access  Private (message recipient only)
 */
router.patch('/messages/:messageId/read', requireAuth, internalMessagingController.markAsRead);

/**
 * @route   GET /api/internal/messages/unread-count
 * @desc    Get unread message count for current user
 * @access  Private (authenticated users)
 */
router.get('/messages/unread-count', requireAuth, internalMessagingController.getUnreadCount);

module.exports = router;
