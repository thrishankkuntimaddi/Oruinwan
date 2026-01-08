const mongoose = require("mongoose");

const ChannelSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null }, // null for personal workspaces

  name: { type: String, required: true },
  description: { type: String, default: "" },
  topic: { type: String, default: "" }, // channel topic/purpose

  // Channel type
  isPrivate: { type: Boolean, default: false },
  isDefault: { type: Boolean, default: false }, // auto-join for all workspace members
  isArchived: { type: Boolean, default: false },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Members with join tracking
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now }
  }],

  // Channel admins (can manage members, settings, and delete channel)
  admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // Activity tracking
  lastMessageAt: { type: Date, default: null },
  messageCount: { type: Number, default: 0 },

  // Pinned messages
  pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],

  // Generic Tabs (Canvas, etc.)
  tabs: [{
    name: { type: String, required: true },
    type: { type: String, enum: ['canvas'], default: 'canvas' },
    content: { type: String, default: "" }, // HTML content
    createdAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  }],

  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

// Indexes
ChannelSchema.index({ workspace: 1, name: 1 });
ChannelSchema.index({ company: 1, isPrivate: 1 });
ChannelSchema.index({ "members.user": 1 }); // Correct nested path for member queries

// Helper to check if user is member
ChannelSchema.methods.isMember = function (userId) {
  if (!this.isPrivate || this.isDefault) return true; // public channels

  // Handle both old format (ObjectId) and new format ({ user, joinedAt })
  return this.members.some(m => {
    const memberId = m.user ? m.user.toString() : m.toString();
    return memberId === userId.toString();
  });
};

// Helper to get user's join date
ChannelSchema.methods.getUserJoinDate = function (userId) {
  const member = this.members.find(m => {
    const memberId = m.user ? m.user.toString() : m.toString();
    return memberId === userId.toString();
  });

  // Return joinedAt if new format, otherwise return channel creation date
  return member?.joinedAt || this.createdAt;
};

// Helper to check if user is admin
ChannelSchema.methods.isAdmin = function (userId) {
  return this.admins.some(adminId => adminId.toString() === userId.toString());
};

// Helper to check if user is the only admin
ChannelSchema.methods.isOnlyAdmin = function (userId) {
  return this.admins.length === 1 && this.isAdmin(userId);
};

module.exports = mongoose.model("Channel", ChannelSchema);
