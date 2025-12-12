// server/models/Company.js
const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema({
  // Basic Info
  name: { type: String, required: true },
  displayName: { type: String }, // optional display name
  logo: { type: String }, // logo URL
  website: { type: String },

  // Domain Configuration
  domain: { type: String, unique: true, sparse: true },
  domainVerified: { type: Boolean, default: false },
  domainVerificationToken: { type: String, default: null },
  domainVerificationExpires: { type: Date, default: null },

  // Auto-join policy
  autoJoinByDomain: { type: Boolean, default: false }, // if true + verified → anyone with @domain.com auto-joins

  // Email allowlist (specific emails pre-approved to join)
  allowedEmails: [{ type: String, lowercase: true }],

  // Invite Policy
  invitePolicy: {
    requireInvite: { type: Boolean, default: true }, // require invite to join company
    allowExternalInvite: { type: Boolean, default: false }, // can admins invite external users?
    defaultRole: { type: String, enum: ["member", "guest"], default: "member" }
  },

  // Company Admins (owners/admins who can manage company)
  admins: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["owner", "admin"], default: "admin" },
    assignedAt: { type: Date, default: Date.now }
  }],

  // Default workspace created during company registration
  defaultWorkspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },

  // Billing & Plan
  plan: {
    type: String,
    enum: ["free", "starter", "professional", "enterprise"],
    default: "free"
  },
  billingEmail: { type: String },

  // Status
  isActive: { type: Boolean, default: true },
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String },

  // Settings
  settings: {
    allowPersonalWorkspaces: { type: Boolean, default: true },
    maxWorkspaces: { type: Number, default: 10 },
    maxChannelsPerWorkspace: { type: Number, default: 50 },
    maxMembersPerChannel: { type: Number, default: 1000 },
    dataRetentionDays: { type: Number, default: 365 }
  },

  // Documents (registration documents)
  documents: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed }

}, { timestamps: true });

// Indexes
// Note: domain index is created automatically by unique: true
CompanySchema.index({ isActive: 1 });
CompanySchema.index({ "admins.user": 1 });

// Helper method to check if user is admin
CompanySchema.methods.isAdmin = function (userId) {
  return this.admins.some(admin => admin.user.toString() === userId.toString());
};

// Helper method to check if user is owner
CompanySchema.methods.isOwner = function (userId) {
  return this.admins.some(
    admin => admin.user.toString() === userId.toString() && admin.role === "owner"
  );
};

module.exports = mongoose.model("Company", CompanySchema);
