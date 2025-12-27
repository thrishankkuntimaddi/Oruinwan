// server/models/User.js
const mongoose = require("mongoose");

const RefreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  deviceInfo: { type: String }
});

const ProfileSchema = new mongoose.Schema(
  {
    name: { type: String }, // kept for backward-compatibility
    dob: { type: Date },
    about: { type: String },
    company: { type: String },
    showCompany: { type: Boolean, default: true }
  },
  { _id: false }
);

const PreferencesSchema = new mongoose.Schema({
  theme: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' }
}, { _id: false });

const UserSchema = new mongoose.Schema(
  {
    // Basic Info
    username: { type: String, required: true }, // primary display name
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    phoneCode: { type: String, default: "+1" }, // Country code

    // Multiple Email Addresses
    emails: [{
      email: { type: String, required: true, lowercase: true },
      verified: { type: Boolean, default: false },
      isPrimary: { type: Boolean, default: false },
      verificationTokenHash: String,
      verificationTokenExpires: Date,
      addedAt: { type: Date, default: Date.now }
    }],

    passwordHash: { type: String, required: true },

    // User Type
    userType: {
      type: String,
      enum: ["personal", "company"],
      default: "personal"
    }, // personal users vs company users

    // Company Association
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },

    // Company Role (within their company)
    companyRole: {
      type: String,
      enum: ["owner", "admin", "manager", "member", "guest"],
      default: "member"
    },

    // Departments
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],

    // Workspace Memberships
    workspaces: [{
      workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },
      role: { type: String, enum: ["owner", "admin", "member"], default: "member" },
      joinedAt: { type: Date, default: Date.now }
    }],

    // Personal workspace for personal users
    personalWorkspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },

    // Legacy/backward compatibility
    rolesPerCompany: { type: mongoose.Schema.Types.Mixed }, // e.g. { "<companyId>": "admin" }

    // Verification
    verified: { type: Boolean, default: false },
    verificationTokenHash: String,
    verificationTokenExpires: Date,

    // Password Reset
    resetPasswordTokenHash: String,
    resetPasswordExpires: Date,

    // Refresh Tokens
    refreshTokens: [RefreshTokenSchema],

    // System Roles (for platform admin, etc.)
    roles: { type: [String], default: ["user"] },

    // Security
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,

    // Profile
    profile: ProfileSchema,

    // App Preferences
    preferences: { type: PreferencesSchema, default: () => ({}) },

    // Google OAuth fields
    googleId: { type: String, unique: true, sparse: true },
    profilePicture: { type: String },
    googleAccount: { type: Boolean, default: false },

    // Activity Tracking
    lastLoginAt: { type: Date, default: null },
    lastActivityAt: { type: Date, default: Date.now },
    isOnline: { type: Boolean, default: false },

    // User Status (Active/Away/DND)
    userStatus: {
      type: String,
      enum: ['active', 'away', 'dnd'],
      default: 'active'
    },

    // Favorites (channels and DMs)
    favorites: [{ type: String }], // Array of channel/conversation IDs

    // Blocked Users
    blockedUsers: [{
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      blockedAt: { type: Date, default: Date.now }
    }],

    // Muted Chats (DMs and Channels)
    mutedChats: [{
      chatId: { type: String, required: true }, // DM session ID or channel ID
      chatType: { type: String, enum: ["dm", "channel"], required: true },
      mutedAt: { type: Date, default: Date.now }
    }],

    // Status
    isActive: { type: Boolean, default: true },
    deactivatedAt: { type: Date, default: null },

    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true
  }
);

// Keep profile.name in sync with username for backward compatibility
UserSchema.pre("save", function (next) {
  try {
    if (!this.profile) this.profile = {};
    // If profile.name is missing or different, update it to username
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
