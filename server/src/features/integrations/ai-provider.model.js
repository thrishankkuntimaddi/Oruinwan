const mongoose = require('mongoose');

const aiProviderSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  provider: {
    type: String,
    required: true,
    enum: ['openai', 'gemini', 'claude', 'local_llm']
  },
  
  apiKey: {
    type: String,
    required: true
  },
  
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error'],
    default: 'inactive'
  },
  
  isDefault: {
    type: Boolean,
    default: false
  },
  connectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

aiProviderSchema.index({ workspaceId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('AIProvider', aiProviderSchema);
