const mongoose = require('mongoose');

const WorkspaceTemplateSchema = new mongoose.Schema({
  
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '📁' },
  color: { type: String, default: '#2563eb' },
  category: {
    type: String,
    enum: ['general', 'engineering', 'design', 'marketing', 'sales', 'hr', 'finance', 'support', 'product', 'custom'],
    default: 'general'
  },

  
  defaultChannels: [{
    name: { type: String, required: true },
    description: { type: String, default: '' },
    isPrivate: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false }
  }],

  
  settings: {
    isPrivate: { type: Boolean, default: false },
    allowMemberInvite: { type: Boolean, default: true },
    allowMemberChannelCreation: { type: Boolean, default: true },
    requireAdminApproval: { type: Boolean, default: false },
    isDiscoverable: { type: Boolean, default: false },
    autoArchiveInactiveDays: { type: Number, default: 90 }
  },

  
  featureToggles: {
    tasks: { type: Boolean, default: true },
    notes: { type: Boolean, default: true },
    polls: { type: Boolean, default: true },
    ai: { type: Boolean, default: true },
    huddles: { type: Boolean, default: true }
  },

  
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null }, 
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  
  isPublic: { type: Boolean, default: false },

  
  usageCount: { type: Number, default: 0 },

  
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

WorkspaceTemplateSchema.index({ company: 1, isActive: 1 });
WorkspaceTemplateSchema.index({ category: 1, isPublic: 1 });

module.exports = mongoose.model('WorkspaceTemplate', WorkspaceTemplateSchema);
