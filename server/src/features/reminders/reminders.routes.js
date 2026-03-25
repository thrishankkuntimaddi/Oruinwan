// server/src/features/reminders/reminders.routes.js
// Phase 1 — Message Reminders REST API
// POST /api/messages/:id/remind  — set a reminder for a message
// GET  /api/reminders            — list my active reminders
// DELETE /api/reminders/:id      — cancel a reminder

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const MessageReminder = require('../messages/MessageReminder');
const Message = require('../messages/message.model');

// ─── Create/update a reminder ─────────────────────────────────────────────────
// POST /api/messages/:id/remind
// Body: { remindAt: ISO8601 string, note?: string }
router.post('/messages/:id/remind', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const messageId = req.params.id;
    const { remindAt, note = '' } = req.body;

    if (!remindAt) return res.status(400).json({ message: 'remindAt is required' });

    const remindDate = new Date(remindAt);
    if (isNaN(remindDate.getTime()) || remindDate <= new Date()) {
      return res.status(400).json({ message: 'remindAt must be a valid future date' });
    }

    const message = await Message.findById(messageId).select('_id');
    if (!message) return res.status(404).json({ message: 'Message not found' });

    // Upsert: one reminder per (userId, messageId) — replaces previous
    const reminder = await MessageReminder.findOneAndUpdate(
      { userId, messageId },
      { remindAt: remindDate, note: note.trim(), delivered: false, deliveredAt: null },
      { upsert: true, new: true }
    );

    res.status(201).json({ reminder });
  } catch (err) {
    console.error('Create reminder error:', err);
    res.status(500).json({ message: 'Failed to create reminder' });
  }
});

// ─── List my pending reminders ────────────────────────────────────────────────
// GET /api/reminders
router.get('/reminders', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;

    const reminders = await MessageReminder.find({
      userId,
      delivered: false
    })
      .sort({ remindAt: 1 })
      .populate({
        path: 'messageId',
        populate: { path: 'sender', select: 'username profilePicture' }
      })
      .lean();

    res.json({ reminders });
  } catch (err) {
    console.error('Get reminders error:', err);
    res.status(500).json({ message: 'Failed to fetch reminders' });
  }
});

// ─── Cancel a reminder ────────────────────────────────────────────────────────
// DELETE /api/reminders/:id
router.delete('/reminders/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const reminder = await MessageReminder.findOneAndDelete({
      _id: req.params.id,
      userId // Security: only the owner can cancel
    });

    if (!reminder) return res.status(404).json({ message: 'Reminder not found' });

    res.json({ message: 'Reminder cancelled' });
  } catch (err) {
    console.error('Delete reminder error:', err);
    res.status(500).json({ message: 'Failed to cancel reminder' });
  }
});

module.exports = router;
