// server/models/Invite.js
const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
  email: { type: String, lowercase: true }, // Optional - for email-based invites
  tokenHash: { type: String, required: true, unique: true }, // sha256 of raw token
  
  // Workspace is now the primary entity (can be personal or company workspace)
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null }, // Optional
  
  role: { type: String, enum: ["owner","admin","member","guest"], default: "member" },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional
  
  // One-time use tracking
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  usedAt: { type: Date, default: null },
  
  // Invite type
  inviteType: { type: String, enum: ["link", "email"], default: "link" },
  
  createdAt: { type: Date, default: Date.now }
});

InviteSchema.index({ tokenHash: 1 });
InviteSchema.index({ email: 1 });
InviteSchema.index({ workspace: 1, used: 1 });

module.exports = mongoose.model("Invite", InviteSchema);
