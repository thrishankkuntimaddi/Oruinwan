// server/src/models/WorkspacePermission.js
// Granular permission configuration per workspace
const mongoose = require('mongoose');

const WorkspacePermissionSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },

  // Channel-level permissions — which roles can post/view in each channel
  channelPermissions: [{
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', required: true },
    canPost: { type: [String], default: ['owner', 'admin', 'member'] }, // workspace roles
    canView: { type: [String], default: ['owner', 'admin', 'member'] },
    canManage: { type: [String], default: ['owner', 'admin'] }
  }],

  // Feature toggles — enable/disable per workspace
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

  // Who can invite members to this workspace
  invitePermission: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'admin'
  },

  // Who can create channels
  channelCreationPermission: {
    type: String,
    enum: ['owner', 'admin', 'member'],
    default: 'member'
  },

  // Last updated by
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }

}, { timestamps: true });

WorkspacePermissionSchema.index({ workspace: 1 });
WorkspacePermissionSchema.index({ company: 1 });

module.exports = mongoose.model('WorkspacePermission', WorkspacePermissionSchema);
