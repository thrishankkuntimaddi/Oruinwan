// server/src/features/developer/bot.model.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const botSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80
  },
  description: {
    type: String,
    trim: true,
    maxlength: 300,
    default: ''
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  // Hashed bot token (Bearer auth)
  tokenHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  tokenPrefix: {
    type: String,
    required: true
  },
  permissions: {
    type: [String],
    default: ['messages:read', 'messages:write'],
    enum: ['messages:read', 'messages:write', 'tasks:read', 'tasks:write', '*']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  avatarUrl: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastActiveAt: Date,
  messageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

botSchema.statics.generateToken = function () {
  const rawToken = 'bot_' + crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const tokenPrefix = rawToken.slice(0, 12); // "bot_XXXXXXXX"
  return { rawToken, tokenHash, tokenPrefix };
};

botSchema.statics.hashToken = function (rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

module.exports = mongoose.model('Bot', botSchema);
