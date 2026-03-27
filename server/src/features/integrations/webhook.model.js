// server/src/features/integrations/webhook.model.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const webhookSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Event type that triggers this webhook
  event: {
    type: String,
    required: true,
    enum: [
      'task.created', 'task.updated', 'task.completed',
      'message.sent',
      'file.uploaded',
      'meeting.completed', 'meeting.started',
      'integration.connected', 'integration.disconnected',
      '*' // wildcard — all events
    ]
  },
  // Destination URL to POST to
  url: {
    type: String,
    required: true
  },
  // Optional shared secret for HMAC signature verification
  secret: {
    type: String,
    default: () => crypto.randomBytes(16).toString('hex')
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Stats
  lastTriggeredAt: Date,
  lastStatusCode: Number,
  failureCount: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Webhook', webhookSchema);
