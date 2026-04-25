const mongoose = require("mongoose");

const RefreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  deviceInfo: { type: String }
});

const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String }, 
    dob: { type: Date },
    about: { type: String },
    company: { type: String },
    showCompany: { type: Boolean, default: true },
    
    address: { type: String },
    resumeUrl: String,
    socialLinks: {
      linkedin: String,
      twitter: String,
      github: String,
      website: String
    }
  },
  { _id: false }
);

const PreferencesSchema = new mongoose.Schema({
  theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
  
  privacy: {
    readReceipts: { type: Boolean, default: true },
    typingIndicators: { type: Boolean, default: true },
    allowDiscovery: { type: Boolean, default: true },
    dataSharing: { type: Boolean, default: false }
  },
  
  region: {
    language: { type: String, default: 'en' },
    timezone: { type: String, default: 'UTC' },
    dateFormat: { type: String, default: 'MM/DD/YYYY' }
  }
}, { _id: false });

const UserSchema = new mongoose.Schema(
  {
    
    username: { type: String, required: true }, 
    email: { type: String, required: true, unique: true, lowercase: true },
    personalEmail: { type: String, lowercase: true }, 
    companyEmail: { type: String, lowercase: true }, 
    phone: { type: String, unique: true, sparse: true },
    phoneCode: { type: String, default: "+1" }, 

    
    emails: [{
      email: { type: String, required: true, lowercase: true },
      verified: { type: Boolean, default: false },
      isPrimary: { type: Boolean, default: false },
      verificationTokenHash: String,
      verificationTokenExpires: Date,
      addedAt: { type: Date, default: Date.now }
    }],

    passwordHash: { type: String, required: false, default: null }, 

    
    
    inviteToken: { type: String, default: null },  
    inviteTokenExpiry: { type: Date, default: null },  
    inviteEmailStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed', 'accepted'],
      default: 'pending',
    },

    
    userType: {
      type: String,
      enum: ["personal", "company"],
      default: "personal"
    }, 

    
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

    
    companyRole: {
      type: String,
      enum: ["owner", "admin", "manager", "member", "guest"],
      default: "member"
    },

    
    managedDepartments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],

    
    reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    
    
    
    
    
    
    
    
    coOwnerOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },

    
    permissions: {
      canCreateWorkspace: { type: Boolean },
      canManageUsers: { type: Boolean },
      customPermissions: [String]
    },

    
    jobTitle: { type: String },

    
    joiningDate: { type: Date, default: Date.now },
    employeeCategory: { type: String, enum: ["Full-time", "Part-time", "Contractor", "Intern"], default: "Full-time" },
    workHistory: [{
      company: String,
      role: String,
      startDate: Date,
      endDate: Date,
      description: String
    }],

    
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],

    
    workspaces: [{
      workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
      role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
      joinedAt: { type: Date, default: Date.now }
    }],

    
    personalWorkspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },

    
    rolesPerCompany: { type: mongoose.Schema.Types.Mixed }, 

    
    verified: { type: Boolean, default: false },
    verificationTokenHash: String,
    verificationTokenExpires: Date,

    
    resetPasswordTokenHash: String,
    resetPasswordExpires: Date,

    
    refreshTokens: [RefreshTokenSchema],

    
    roles: { type: [String], default: ["user"] },

    
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,

    
    unverifiedLoginAttempts: { type: Number, default: 0 },
    lastUnverifiedLoginAttempt: { type: Date },
    lastVerificationEmailSent: { type: Date },

    
    profile: ProfileSchema,

    
    preferences: { type: PreferencesSchema, default: () => ({}) },

    
    googleId: { type: String, unique: true, sparse: true },
    profilePicture: { type: String },
    googleAccount: { type: Boolean, default: false },

    
    encryption: {
      publicKey: { type: String }, 
      encryptedPrivateKey: { type: String }, 
      keyVersion: { type: Number, default: 1 }, 
      createdAt: { type: Date }
    },

    
    githubId: { type: String, unique: true, sparse: true },

    
    linkedinId: { type: String, unique: true, sparse: true },

    
    authProvider: { type: String, enum: ['local', 'google', 'github', 'linkedin', 'microsoft', 'okta'], default: 'local' },

    
    ssoProvider: { type: String, enum: ['google', 'microsoft', 'okta'], default: null },
    ssoId: { type: String, default: null }, 

    
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null }, 

    
    devices: [{
      deviceId: { type: String },
      userAgent: { type: String },
      ip: { type: String },
      lastActive: { type: Date, default: Date.now },
      createdAt: { type: Date, default: Date.now }
    }],

    
    deviceTokens: [{
      token: { type: String, required: true },        
      platform: { type: String, enum: ['ios', 'android', 'web', 'unknown'], default: 'unknown' },
      registeredAt: { type: Date, default: Date.now }
    }],

    
    legalHold: { type: Boolean, default: false },
    legalHoldReason: { type: String },
    legalHoldSetBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    legalHoldAt: { type: Date },

    
    retentionDays: { type: Number, default: null },

    
    passwordSetAt: { type: Date, default: null },

    
    passwordLoginEnabled: { type: Boolean, default: true },

    
    passwordSkipped: { type: Boolean, default: false },

    
    
    
    
    isTemporaryPassword: { type: Boolean, default: false },
    passwordInitialized: { type: Boolean, default: false },

    
    lastLoginMethod: { type: String, enum: ['oauth', 'password', null], default: null },
    lastLoginMethodAt: { type: Date, default: null },

    
    lastLoginAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },

    
    userStatus: {
      type: String,
      enum: ['active', 'away', 'dnd'],
      default: 'active'
    },

    
    accountStatus: {
      type: String,
      enum: ["active", "invited", "pending", "pending_company", "suspended", "blocked", "removed"],
      default: "active"
    },

    
    suspendedAt: { type: Date },
    suspendedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    suspensionReason: { type: String },

    
    favorites: [{
      chatId: mongoose.Schema.Types.ObjectId,
      chatType: { type: String, enum: ["dm", "channel"] }
    }],

    
    blockedUsers: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      blockedAt: { type: Date, default: Date.now }
    }],

    
    mutedChats: [{
      chatId: mongoose.Schema.Types.ObjectId,
      chatType: { type: String, enum: ["dm", "channel"] },
      mutedUntil: Date
    }],

    
    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date, default: null },

    
    otpCodes: [{
      code: { type: String, required: true },
      type: { type: String, required: true }, 
      expiresAt: { type: Date, required: true },
      used: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    }],

    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

UserSchema.pre("save", function (next) {
  try {
    if (!this.profile) this.profile = {};
    
    if (!this.profile.name || this.profile.name !== this.username) {
      this.profile.name = this.username;
    }
    this.updatedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model("User", UserSchema);
