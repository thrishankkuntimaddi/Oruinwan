// server/models/Invite.js
const mongoose = require("mongoose");

/**
 * Invite Model
 * 
 * Lifecycle: pending → accepted/revoked
 * - pending: Can be used
 * - accepted: Already used (one-time)
 * - revoked: Admin cancelled before use
 */
const InviteSchema = new mongoose.Schema({
  email: { type: String, lowercase: true }, // Optional - for email-based invites
  tokenHash: { type: String, required: true, unique: true }, // sha256 of raw token

  // Workspace is now the primary entity (can be personal or company workspace)
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null }, // Optional

  role: { type: String, enum: ["owner", "admin", "member", "guest"], default: "member" },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional

  // 🔒 CRITICAL: Status tracking
  status: {
    type: String,
    enum: ["pending", "accepted", "revoked"],
    default: "pending"
  },

  // One-time use tracking
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }, // Deprecated: use status === "accepted"
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  usedAt: { type: Date, default: null },

  // Revocation tracking
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, default: null },

  // Invite type
  inviteType: { type: String, enum: ["link", "email"], default: "link" },

  createdAt: { type: Date, default: Date.now }
});

InviteSchema.index({ tokenHash: 1 });
InviteSchema.index({ email: 1 });
InviteSchema.index({ workspace: 1, status: 1 });
InviteSchema.index({ expiresAt: 1 }); // For cleanup jobs

module.exports = mongoose.model("Invite", InviteSchema);
