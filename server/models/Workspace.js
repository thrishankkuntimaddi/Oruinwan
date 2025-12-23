const mongoose = require("mongoose");

const WorkspaceSchema = new mongoose.Schema({
  // Parent company (null for personal workspaces)
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

  // Workspace type
  type: {
    type: String,
    enum: ["company", "personal"],
    default: "company"
  },

  name: { type: String, required: true },
  description: { type: String, default: "" },
  icon: { type: String, default: "📁" }, // emoji or icon identifier
  color: { type: String, default: "#2563eb" }, // workspace brand color

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Members with roles
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    joinedAt: { type: Date, default: Date.now }
  }],

  // Default channels created with workspace
  defaultChannels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Channel" }],

  // Workspace settings
  settings: {
    isPrivate: { type: Boolean, default: false },
    allowMemberInvite: { type: Boolean, default: true },
    allowMemberChannelCreation: { type: Boolean, default: true },
    requireAdminApproval: { type: Boolean, default: false },
    isDiscoverable: { type: Boolean, default: false },
    autoArchiveInactiveDays: { type: Number, default: 90 }
  },

  // Activity tracking
  lastActivityAt: { type: Date, default: Date.now },

  // Status
  isActive: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },

  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

// Indexes
WorkspaceSchema.index({ company: 1, name: 1 });
WorkspaceSchema.index({ "members.user": 1 });
WorkspaceSchema.index({ type: 1, isActive: 1 });

// Helper to check if user is member
WorkspaceSchema.methods.isMember = function (userId) {
  return this.members.some(m => m.user.toString() === userId.toString());
};

// Helper to check if user is admin/owner
WorkspaceSchema.methods.isAdminOrOwner = function (userId) {
  const member = this.members.find(m => m.user.toString() === userId.toString());
  return member && (member.role === "admin" || member.role === "owner");
};

module.exports = mongoose.model("Workspace", WorkspaceSchema);
