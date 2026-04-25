const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema({
  
  name: { type: String, required: true },
  displayName: { type: String }, 
  logo: { type: String }, 
  website: { type: String },

  
  domain: { type: String, unique: true, sparse: true },
  domainVerified: { type: Boolean, default: false },
  domainVerificationToken: { type: String, default: null },
  domainVerificationExpires: { type: Date, default: null },

  
  ownerPhone: { type: String },
  phoneOTP: { type: String },
  phoneOTPExpiresAt: { type: Number },
  phoneVerified: { type: Boolean, default: false },

  
  verificationStatus: {
    type: String,
    enum: ["pending", "verified", "rejected"],
    default: "pending"
  },
  rejectionReason: { type: String, default: null },

  
  isSetupComplete: { type: Boolean, default: false },
  setupStep: { type: Number, default: 0 }, 

  
  autoJoinByDomain: { type: Boolean, default: false }, 

  
  allowedEmails: [{ type: String, lowercase: true }],

  
  invitePolicy: {
    requireInvite: { type: Boolean, default: true }, 
    allowExternalInvite: { type: Boolean, default: false }, 
    defaultRole: { type: String, enum: ["member", "guest"], default: "member" }
  },

  
  admins: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["owner", "admin"], default: "admin" },
    assignedAt: { type: Date, default: Date.now }
  }],

  
  defaultWorkspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },

  
  plan: {
    type: String,
    enum: ["free", "starter", "professional", "enterprise"],
    default: "free"
  },
  billingEmail: { type: String },

  
  isActive: { type: Boolean, default: true },
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String },

  
  settings: {
    
    allowMemberWorkspaceCreation: { type: Boolean, default: false }, 
    allowPersonalWorkspaces: { type: Boolean, default: true },

    
    timezone: { type: String, default: "Asia/Kolkata" },
    theme: { type: String, default: "light" },
    logo: { type: String },

    
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

    
    maxUsers: { type: Number, default: 50 }, 
    maxWorkspaces: { type: Number, default: 10 },
    maxChannelsPerWorkspace: { type: Number, default: 50 },
    maxMembersPerChannel: { type: Number, default: 1000 },
    dataRetentionDays: { type: Number, default: 365 }
  },

  
  documents: [{
    name: String,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  
  departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],

  
  metadata: { type: mongoose.Schema.Types.Mixed },

  
  
  
  ssoEnabled: { type: Boolean, default: false },

  ssoProvider: {
    type: String,
    enum: ['saml', 'oauth2', 'oidc', null],
    default: null,
  },

  
  ssoMetadataUrl: { type: String, default: null },

  
  ssoDomain: { type: String, default: null },

  
  
  ssoConfig: { type: mongoose.Schema.Types.Mixed, default: null },

  
  
  
  securitySettings: {
    mfaRequired: { type: Boolean, default: false },
    passwordMinLength: { type: Number, default: 8 },
    sessionTimeoutMinutes: { type: Number, default: 1440 },  
    allowedIpRanges: [{ type: String }],                
    enforceSSO: { type: Boolean, default: false },  
  },

}, { timestamps: true });

CompanySchema.index({ isActive: 1 });
CompanySchema.index({ "admins.user": 1 });

CompanySchema.methods.isAdmin = function (userId) {
  return this.admins.some(admin => admin.user.toString() === userId.toString());
};

CompanySchema.methods.isOwner = function (userId) {
  return this.admins.some(
    admin => admin.user.toString() === userId.toString() && admin.role === "owner"
  );
};

module.exports = mongoose.model("Company", CompanySchema);
