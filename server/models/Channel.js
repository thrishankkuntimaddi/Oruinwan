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

  // Members (for private channels or explicit membership)
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // Activity tracking
  lastMessageAt: { type: Date, default: null },
  messageCount: { type: Number, default: 0 },

  // Pinned messages
  pinnedMessages: [{ type: mongoose.Schema.Types.ObjectId, ref: "Message" }],

  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

// Indexes
ChannelSchema.index({ workspace: 1, name: 1 });
ChannelSchema.index({ company: 1, isPrivate: 1 });
ChannelSchema.index({ members: 1 });

// Helper to check if user is member
ChannelSchema.methods.isMember = function (userId) {
  if (!this.isPrivate || this.isDefault) return true; // public channels
  return this.members.some(m => m.toString() === userId.toString());
};

module.exports = mongoose.model("Channel", ChannelSchema);
