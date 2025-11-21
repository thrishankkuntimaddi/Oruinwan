const mongoose = require('mongoose');

const RefreshTokenSchema = new mongoose.Schema({
  _id: false, // prevent ObjectId creation
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
  deviceInfo: { type: String }
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

  refreshTokens: [RefreshTokenSchema], // Updated schema

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

// ❌ Remove invalid TTL index — cannot TTL arrays
// UserSchema.index({ "refreshTokens.expiresAt": 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('User', UserSchema);
