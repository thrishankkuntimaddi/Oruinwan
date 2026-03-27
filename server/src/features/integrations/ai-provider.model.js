// server/src/features/integrations/ai-provider.model.js
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
  // Encrypted API key (store encrypted in production)
  apiKey: {
    type: String,
    required: true
  },
  // Optional extra config (endpoint URL for local LLMs, model name, etc.)
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'error'],
    default: 'inactive'
  },
  // Whether this is the currently active provider for the workspace
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

// One record per provider per workspace
aiProviderSchema.index({ workspaceId: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model('AIProvider', aiProviderSchema);
