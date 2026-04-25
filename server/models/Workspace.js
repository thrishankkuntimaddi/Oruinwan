const mongoose = require("mongoose");

const WorkspaceSchema = new mongoose.Schema({
  
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

  
  
  
  
  type: {
    type: String,
    enum: ["team", "project", "department", "personal", "company"],
    default: "team"
  },

  
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null },

  name: { type: String, required: true },
  description: { type: String, default: "" },
  icon: { type: String, default: "📁" }, 
  color: { type: String, default: "#2563eb" }, 
  rules: { type: String, default: "" }, 

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  
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

  
  defaultChannels: [{ type: mongoose.Schema.Types.ObjectId, ref: "Channel" }],

  
  settings: {
    isPrivate: { type: Boolean, default: false },
    allowMemberInvite: { type: Boolean, default: true },
    allowMemberChannelCreation: { type: Boolean, default: true },
    requireAdminApproval: { type: Boolean, default: false },
    isDiscoverable: { type: Boolean, default: false },
    autoArchiveInactiveDays: { type: Number, default: 90 }
  },

  
  lastActivityAt: { type: Date, default: Date.now },

  
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceTemplate', default: null },
  clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
  exportedAt: { type: Date, default: null },

  
  analyticsCache: {
    totalMessages: { type: Number, default: 0 },
    totalTasks: { type: Number, default: 0 },
    totalFiles: { type: Number, default: 0 },
    activeMembers7d: { type: Number, default: 0 },
    lastComputedAt: { type: Date, default: null }
  },

  
  isActive: { type: Boolean, default: true },
  isArchived: { type: Boolean, default: false },
  archivedAt: { type: Date, default: null },

  
  metadata: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

WorkspaceSchema.index({ company: 1, name: 1 });
WorkspaceSchema.index({ company: 1, createdAt: -1 }); 
WorkspaceSchema.index({ "members.user": 1 });
WorkspaceSchema.index({ type: 1, isActive: 1 });

WorkspaceSchema.methods.isMember = function (userId) {
  return this.members.some(m => m.user.toString() === userId.toString());
};

WorkspaceSchema.methods.isAdminOrOwner = function (userId) {
  const member = this.members.find(m => m.user.toString() === userId.toString());
  return member && (member.role === "admin" || member.role === "owner");
};

module.exports = mongoose.model("Workspace", WorkspaceSchema);
