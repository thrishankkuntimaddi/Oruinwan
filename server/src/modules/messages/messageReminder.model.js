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
    
    remindAt: {
      type: Date,
      required: true,
      index: true
    },
    
    note: {
      type: String,
      default: ''
    },
    // Someone else set it (/remind @person); null when it's my own.
    setBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    
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

MessageReminderSchema.index({ delivered: 1, remindAt: 1 });

module.exports = mongoose.model('MessageReminder', MessageReminderSchema);
