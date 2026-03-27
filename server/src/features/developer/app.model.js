// server/src/features/developer/app.model.js
const mongoose = require('mongoose');

const appSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['productivity', 'communication', 'developer', 'automation', 'analytics'],
    default: 'productivity'
  },
  iconUrl: {
    type: String,
    default: null
  },
  // Configurable parameters for this app
  config: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Workspaces that have installed this app
  installedIn: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace'
  }],
  isPublished: {
    type: Boolean,
    default: true
  },
  developer: {
    type: String,
    default: 'Chttrix'
  },
  version: {
    type: String,
    default: '1.0.0'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('App', appSchema);
