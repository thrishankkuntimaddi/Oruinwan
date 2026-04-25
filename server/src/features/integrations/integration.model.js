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
      
      'github', 'gitlab', 'bitbucket', 'linear', 'jira', 'cicd',
      
      'google_drive', 'onedrive', 'dropbox', 'notion', 'confluence',
      
      'slack', 'zoom', 'google_meet', 'teams',
      
      'zapier', 'make', 'n8n', 'webhook'
    ]
  },
  
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ['connected', 'disconnected', 'error'],
    default: 'disconnected'
  },
  
  lastEventAt: {
    type: Date
  },
  
  label: {
    type: String,
    default: ''
  },
  connectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  isPublic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

integrationSchema.index({ workspaceId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Integration', integrationSchema);
