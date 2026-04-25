const mongoose = require('mongoose');

const WorkspacePermissionSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },

  
  channelPermissions: [{
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    canPost: { type: [String], default: ['owner', 'admin', 'member'] }, 
    canView: { type: [String], default: ['owner', 'admin', 'member'] },
    canManage: { type: [String], default: ['owner', 'admin'] }
  }],

  
  featureToggles: {
    tasks: { type: Boolean, default: true },
    notes: { type: Boolean, default: true },
    polls: { type: Boolean, default: true },
    ai: { type: Boolean, default: true },
    huddles: { type: Boolean, default: true },
    fileUploads: { type: Boolean, default: true },
    reactions: { type: Boolean, default: true },
    threads: { type: Boolean, default: true },
    bookmarks: { type: Boolean, default: true },
    reminders: { type: Boolean, default: true }
  },

  
  invitePermission: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'admin'
  },

  
  channelCreationPermission: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  },

  
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }

}, { timestamps: true });

WorkspacePermissionSchema.index({ workspace: 1 });
WorkspacePermissionSchema.index({ company: 1 });

module.exports = mongoose.model('WorkspacePermission', WorkspacePermissionSchema);
