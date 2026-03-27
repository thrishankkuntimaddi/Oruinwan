// server/src/features/developer/apiKey.model.js
const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  // Store only the hash — never the raw key
  keyHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // First 8 chars of the raw key for display (chx_XXXXXXXX...)
  keyPrefix: {
    type: String,
    required: true
  },
  permissions: {
    type: [String],
    default: ['messages:read', 'tasks:read', 'tasks:write', 'files:read', 'users:read', 'channels:read'],
    enum: [
      'messages:read',
      'tasks:read', 'tasks:write',
      'files:read',
      'users:read',
      'channels:read',
      'webhooks:read', 'webhooks:write',
      '*' // full access
    ]
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastUsedAt: Date,
  usageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

/**
 * Hash a raw API key for storage / lookup.
 */
apiKeySchema.statics.hashKey = function (rawKey) {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
};

/**
 * Generate a new random API key.
 * Returns { rawKey, keyHash, keyPrefix }
 */
apiKeySchema.statics.generateKey = function () {
  const rawKey = 'chx_' + crypto.randomBytes(32).toString('hex');
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12); // "chx_XXXXXXXX"
  return { rawKey, keyHash, keyPrefix };
};

module.exports = mongoose.model('ApiKey', apiKeySchema);
