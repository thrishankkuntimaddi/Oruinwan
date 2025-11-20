const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  deviceInfo: { type: String } // optional: store user-agent/device info
});

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  phone:    { type: String, unique: true, sparse: true },
  passwordHash: { type: String, required: true },
  verified: { type: Boolean, default: false },

  verificationTokenHash: String,
  verificationTokenExpires: Date,

  resetPasswordTokenHash: String,
  resetPasswordExpires: Date,

  refreshTokens: [RefreshTokenSchema],

  roles: { type: [String], default: ['user'] },

  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: Date,

  profile: {
    name: String,
    dob: Date,
    about: String,
    company: String,
    showCompany: { type: Boolean, default: true }
  },

  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

// Indexes to help cleanup queries
UserSchema.index({ "refreshTokens.expiresAt": 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('User', UserSchema);
