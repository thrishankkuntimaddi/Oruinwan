// server/models/MessageReminder.js
// Phase 1 — Message Reminders ("Remind me later")

const mongoose = require('mongoose');

const MessageReminderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    messageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      required: true
    },
    // When to fire the reminder
    remindAt: {
      type: Date,
      required: true,
      index: true
    },
    // Optional custom note
    note: {
      type: String,
      default: ''
    },
    // Whether the reminder has been delivered via socket
    delivered: {
      type: Boolean,
      default: false,
      index: true
    },
    deliveredAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

// Compound index for the cron job: find undelivered reminders due now
MessageReminderSchema.index({ delivered: 1, remindAt: 1 });

module.exports = mongoose.model('MessageReminder', MessageReminderSchema);
