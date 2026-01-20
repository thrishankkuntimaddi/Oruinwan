const mongoose = require('mongoose');

/**
 * System Broadcasts
 * - Platform → Companies
 * - NOT chat
 * - NOT E2EE
 */
const broadcastSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
      trim: true
    },

    body: {                     // 🔧 renamed from "message"
      type: String,
      required: true
    },

    targetType: {
      type: String,
      enum: ['all', 'active', 'pending', 'specific'],
      required: true
    },

    targetCompanies: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company'
    }],

    recipientCount: {
      type: Number,
      default: 0
    },

    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    sentAt: {
      type: Date,
      default: Date.now
    },

    scheduledAt: {
      type: Date,
      default: null
    },

    status: {
      type: String,
      enum: ['sent', 'scheduled', 'failed'],
      default: 'sent'
    }
  },
  { timestamps: true }
);

/* Indexes */
broadcastSchema.index({ sentAt: -1 });
broadcastSchema.index({ sentBy: 1 });

/* Validation */
broadcastSchema.pre('save', function () {
  if (this.targetType === 'specific' && (!this.targetCompanies || this.targetCompanies.length === 0)) {
    throw new Error('targetCompanies required when targetType is specific');
  }
});

module.exports = mongoose.model('Broadcast', broadcastSchema);
