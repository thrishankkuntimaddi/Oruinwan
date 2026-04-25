const mongoose = require("mongoose");

const InviteSchema = new mongoose.Schema({
  email: { type: String, lowercase: true }, 
  tokenHash: { type: String, required: true, unique: true }, 

  
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null }, 
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department", default: null }, 

  role: { type: String, enum: ["owner", "admin", "member", "guest"], default: "member" },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, 

  
  status: {
    type: String,
    enum: ["pending", "accepted", "revoked"],
    default: "pending"
  },

  
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }, 
  usedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  usedAt: { type: Date, default: null },

  
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  revokedAt: { type: Date, default: null },
  revokeReason: { type: String, default: null },

  
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

  
  inviteType: { type: String, enum: ["link", "email"], default: "link" },

  createdAt: { type: Date, default: Date.now }
});

InviteSchema.index({ email: 1 });
InviteSchema.index({ workspace: 1, status: 1 });
InviteSchema.index({ expiresAt: 1 }); 

module.exports = mongoose.model("Invite", InviteSchema);
