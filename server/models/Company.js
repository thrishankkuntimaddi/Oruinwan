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

  // Phone Verification (OTP)
  ownerPhone: { type: String },
  phoneOTP: { type: String },
  phoneOTPExpiresAt: { type: Number },
  phoneVerified: { type: Boolean, default: false },

  // Verification Status (Phase 2 Requirement)
  verificationStatus: {
    type: String,
    enum: ["pending", "verified", "rejected"],
    default: "pending"
  },
  rejectionReason: { type: String, default: null },

  // Phase 3 & 4: Setup Tracking
  isSetupComplete: { type: Boolean, default: false },
  setupStep: { type: Number, default: 0 }, // 0: Confirmation, 1: Profile, 2: Depts, 3: Invites, 4: Complete

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
    // Permission Settings
    allowMemberWorkspaceCreation: { type: Boolean, default: false }, // "Members cannot create workspaces without approval"
    allowPersonalWorkspaces: { type: Boolean, default: true },

    // Branding & Localization
    timezone: { type: String, default: "Asia/Kolkata" },
    theme: { type: String, default: "light" },
    logo: { type: String },

    // Phase 3: Company Profile
    phone: { type: String },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String
    },
    socialLinks: {
      linkedin: String,
      twitter: String,
      website: String
    },

    // Limits & Quotas
    maxUsers: { type: Number, default: 50 }, // Seat limit based on plan
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

  // Organization Structure
  departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],

  // Additional metadata
  metadata: { type: mongoose.Schema.Types.Mixed },

  // ────────────────────────────────────────────────────────────────────────
  // Phase 3 — SSO Preparation (schema only — no SSO logic implemented yet)
  // ────────────────────────────────────────────────────────────────────────
  ssoEnabled: { type: Boolean, default: false },

  ssoProvider: {
    type: String,
    enum: ['saml', 'oauth2', 'oidc', null],
    default: null,
  },

  // URL pointing to the IdP SAML/OIDC metadata document
  ssoMetadataUrl: { type: String, default: null },

  // Verified domain that triggers SSO redirect for sign-in
  ssoDomain: { type: String, default: null },

  // Raw federation / IdP config (provider-specific — stored as-is)
  // Validated at the application layer, not in schema to stay provider-agnostic
  ssoConfig: { type: mongoose.Schema.Types.Mixed, default: null },

  // ────────────────────────────────────────────────────────────────────────
  // Phase 3 — Security Settings
  // ────────────────────────────────────────────────────────────────────────
  securitySettings: {
    mfaRequired: { type: Boolean, default: false },
    passwordMinLength: { type: Number, default: 8 },
    sessionTimeoutMinutes: { type: Number, default: 1440 },  // 24h default
    allowedIpRanges: [{ type: String }],                // CIDR notation
    enforceSSO: { type: Boolean, default: false },  // block non-SSO logins when ssoEnabled
  },

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
