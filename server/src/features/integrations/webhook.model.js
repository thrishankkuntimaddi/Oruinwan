const mongoose = require('mongoose');
const crypto = require('crypto');

const webhookSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  
  event: {
    type: String,
    required: true,
    enum: [
      'task.created', 'task.updated', 'task.completed',
      'message.sent',
      'file.uploaded',
      'meeting.completed', 'meeting.started',
      'integration.connected', 'integration.disconnected',
      '*' 
    ]
  },
  
  url: {
    type: String,
    required: true
  },
  
  secret: {
    type: String,
    default: () => crypto.randomBytes(16).toString('hex')
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
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
