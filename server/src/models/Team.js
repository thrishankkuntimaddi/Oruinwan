// server/src/models/Team.js
// Teams — sub-groups within a department
const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '👥' },
  color: { type: String, default: '#6366f1' },

  // Org hierarchy
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },

  // Team lead
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  // Members
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['lead', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now }
  }],

  // Optional linked workspace
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },

  // Status
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

TeamSchema.index({ company: 1, isActive: 1 });
TeamSchema.index({ department: 1 });
TeamSchema.index({ 'members.user': 1 });

module.exports = mongoose.model('Team', TeamSchema);
