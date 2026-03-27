// server/src/features/integrations/integration.model.js
const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      // Developer
      'github', 'gitlab', 'bitbucket', 'linear', 'jira', 'cicd',
      // Productivity
      'google_drive', 'onedrive', 'dropbox', 'notion', 'confluence',
      // Communication
      'slack', 'zoom', 'google_meet', 'teams',
      // Automation
      'zapier', 'make', 'n8n', 'webhook'
    ]
  },
  // Encrypted config (tokens, keys, URLs) – store as opaque object
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'error'],
    default: 'disconnected'
  },
  // Last event activity
  lastEventAt: {
    type: Date
  },
  // Human-readable label for the connected account/org
  label: {
    type: String,
    default: ''
  },
  connectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// One integration per type per workspace
integrationSchema.index({ workspaceId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Integration', integrationSchema);
