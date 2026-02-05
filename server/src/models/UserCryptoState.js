// server/src/models/UserCryptoState.js

const mongoose = require('mongoose');

const UserCryptoStateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true
    },

    // Public identity key (for others to encrypt conversation keys)
    identityPublicKey: {
      type: String,
      required: true
    },

    // Identity private key encrypted with UMEK
    encryptedIdentityPrivateKey: {
      type: String,
      required: true
    },

    // IV used for encrypting identity private key
    identityPrivateKeyIv: {
      type: String,
      required: true
    },

    // UMEK wrapped/protected based on protection type
    umekEnvelope: {
      type: String,
      required: true
    },

    // IV for UMEK envelope (if password-protected)
    umekEnvelopeIv: {
      type: String
    },

    // Salt for password-based UMEK derivation (if password-protected)
    umekSalt: {
      type: String
    },

    // Protection type: PASSWORD or SERVER_KEK
    umekProtectionType: {
      type: String,
      enum: ['PASSWORD', 'SERVER_KEK'],
      required: true
    },

    // Key algorithm (X25519 or RSA-OAEP)
    algorithm: {
      type: String,
      default: 'X25519'
    },

    // PHASE 4D: Server KEK version (for SERVER_KEK users only)
    // Used to support KEK rotation without breaking existing wraps
    kekVersion: {
      type: Number,
      default: null  // null for PASSWORD users, number for SERVER_KEK users
    },

    // Key version (for future rotation)
    version: {
      type: Number,
      default: 1
    },

    createdAt: {
      type: Date,
      default: Date.now
    },

    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('UserCryptoState', UserCryptoStateSchema);
