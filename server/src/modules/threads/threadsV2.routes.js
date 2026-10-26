const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const Message = require('../messages/message.model');
const logger = require('../../../utils/logger');

const messagesService = require('../messages/messages.service');

router.post('/:messageId/resolve', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { messageId } = req.params;

    // Canonical resolve state is resolvedThreadAt/resolvedBy; access is checked there
    // (messages.service.resolveThread: the central conversation rule, join dates included).
    const io = req.app.get('io');
    const result = await messagesService.resolveThread(messageId, userId, io);
    const msg = await Message.findById(messageId).select('channel dm createdAt').lean();
    if (io) {
      // In a group, only members who can see the thread (not people who joined after it).
      await require('../conversations/conversationRooms').emitAboutMessage(io, msg, 'thread-resolved', {
        messageId,
        isResolved: result.resolved,
        resolvedBy: result.resolved ? userId : null
      });
    }

    res.json({ isResolved: result.resolved, ...result });
  } catch (err) {
    if (err.status && err.status < 500) return res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
    logger.error('Thread resolve error:', err);
    res.status(500).json({ message: 'Failed to resolve thread' });
  }
});


module.exports = router;
