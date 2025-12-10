// server/models/Invite.js
const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  tokenHash: { type: String, required: true }, // sha256 of raw token
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
  role: { type: String, enum: ["owner","admin","member","guest"], default: "member" },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // optional
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

InviteSchema.index({ tokenHash: 1 });
InviteSchema.index({ email: 1 });

module.exports = mongoose.model("Invite", InviteSchema);
