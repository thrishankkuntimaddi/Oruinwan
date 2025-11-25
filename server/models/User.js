// server/models/User.js
const mongoose = require("mongoose");

const RefreshTokenSchema = new mongoose.Schema({
  _id: false,
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

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true }, // primary display name
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, unique: true, sparse: true },
    passwordHash: { type: String, required: true },

    verified: { type: Boolean, default: false },

    verificationTokenHash: String,
    verificationTokenExpires: Date,

    resetPasswordTokenHash: String,
    resetPasswordExpires: Date,

    refreshTokens: [RefreshTokenSchema],

    roles: { type: [String], default: ["user"] },

    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,

    profile: ProfileSchema,

    // Google OAuth fields (required by authController.js)
    googleId: { type: String, unique: true, sparse: true },
    profilePicture: { type: String },
    googleAccount: { type: Boolean, default: false },

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
