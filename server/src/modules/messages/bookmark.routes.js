const logger = require('../../../utils/logger');
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const Message = require('./message.model');
const { canAccessMessage } = require('./messageAccess');
const mongoose = require('mongoose');

router.post('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const messageId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(messageId)) return res.status(400).json({ message: 'Invalid message id' });
    const message = await Message.findById(messageId).select('bookmarkedBy channel dm');
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (!(await canAccessMessage(message, userId))) {
      return res.status(403).json({ message: 'You do not have access to this message' });
    }

    const isBookmarked = message.bookmarkedBy.some(id => id.toString() === userId.toString());

    if (isBookmarked) {
      
      await Message.findByIdAndUpdate(messageId, {
        $pull: { bookmarkedBy: userId }
      });
      return res.json({ bookmarked: false, messageId });
    } else {
      
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { bookmarkedBy: userId }
      });
      return res.json({ bookmarked: true, messageId });
    }
  } catch (err) {
    logger.error('Bookmark toggle error:', err);
    res.status(500).json({ message: 'Failed to toggle bookmark' });
  }
});

router.get('/bookmarks', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { limit = 50, skip = 0 } = req.query;

    const messages = await Message.find({
      bookmarkedBy: userId,
      isDeletedUniversally: { $ne: true },
      hiddenFor: { $ne: userId }
    })
      .sort({ createdAt: -1 })
      .skip(Math.max(parseInt(skip, 10) || 0, 0))
      .limit(Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100))
      .populate('channel', 'name')
      .lean();
    await require('../../identity/hydrate').hydrate(messages, { sender: { type: 'user', fields: ['username', 'profilePicture'] } });

    res.json({ messages });
  } catch (err) {
    logger.error('Get bookmarks error:', err);
    res.status(500).json({ message: 'Failed to fetch bookmarks' });
  }
});

module.exports = router;
