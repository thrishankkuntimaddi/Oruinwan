const mongoose = require("mongoose");

const WorkspaceSchema = new mongoose.Schema({
  // Parent company (null for personal workspaces)
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

  // Workspace type
  // ARCH-FIX: expanded enum — team (persistent hub), project (time-bounded),
  // department (mirrors org dept), personal (single-user)
  // 'company' retained for backward-compat with existing documents
  type: {
    type: String,
    enum: ["team", "project", "department", "personal", "company"],
    default: "team"
  },

  // Department association (for company workspaces)
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

  name: { type: String, required: true },
  description: { type: String, default: "" },
  icon: { type: String, default: "📁" }, // emoji or icon identifier
  color: { type: String, default: "#2563eb" }, // workspace brand color
  rules: { type: String, default: "" }, // workspace rules and guidelines

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Members with roles
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
    status: {
      type: String,
      enum: ["active", "suspended", "removed"],
      default: "active"
    },
    joinedAt: { type: Date, default: Date.now },
    suspendedAt: { type: Date, default: null },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    removedAt: { type: Date, default: null },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
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

  // Workspace OS extensions
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceTemplate', default: null },
  clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  exportedAt: { type: Date, default: null },

  // Cached analytics snapshot (updated by analytics service on demand)
  analyticsCache: {
    totalMessages: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    totalFiles: { type: Number, default: 0 },
    activeMembers7d: { type: Number, default: 0 },
    lastComputedAt: { type: Date, default: null }
  },

  // Status
  isActive: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },

  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

// Indexes
WorkspaceSchema.index({ company: 1, name: 1 });
WorkspaceSchema.index({ company: 1, createdAt: -1 }); // For growth rate queries
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
