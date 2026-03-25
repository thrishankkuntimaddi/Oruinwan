// server/src/features/messages/bookmark.routes.js
// Phase 1 — Message Bookmarks
// POST /api/messages/:id/bookmark  — toggle bookmark (add/remove)
// GET  /api/messages/bookmarks     — list all messages bookmarked by me

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const Message = require('./message.model');

// ─── Toggle bookmark ────────────────────────────────────────────────────────
router.post('/:id/bookmark', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const messageId = req.params.id;

    const message = await Message.findById(messageId).select('bookmarkedBy');
    if (!message) return res.status(404).json({ message: 'Message not found' });

    const isBookmarked = message.bookmarkedBy.some(id => id.toString() === userId.toString());

    if (isBookmarked) {
      // Remove bookmark
      await Message.findByIdAndUpdate(messageId, {
        $pull: { bookmarkedBy: userId }
      });
      return res.json({ bookmarked: false });
    } else {
      // Add bookmark
      await Message.findByIdAndUpdate(messageId, {
        $addToSet: { bookmarkedBy: userId }
      });
      return res.json({ bookmarked: true });
    }
  } catch (err) {
    console.error('Bookmark toggle error:', err);
    res.status(500).json({ message: 'Failed to toggle bookmark' });
  }
});

// ─── List my bookmarked messages ─────────────────────────────────────────────
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
      .skip(Number(skip))
      .limit(Number(limit))
      .populate('sender', 'username profilePicture')
      .populate('channel', 'name')
      .lean();

    res.json({ messages });
  } catch (err) {
    console.error('Get bookmarks error:', err);
    res.status(500).json({ message: 'Failed to fetch bookmarks' });
  }
});

module.exports = router;
