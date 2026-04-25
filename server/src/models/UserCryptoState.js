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

    
    identityPublicKey: {
      type: String,
      required: true
    },

    
    encryptedIdentityPrivateKey: {
      type: String,
      required: true
    },

    
    identityPrivateKeyIv: {
      type: String,
      required: true
    },

    
    umekEnvelope: {
      type: String,
      required: true
    },

    
    umekEnvelopeIv: {
      type: String
    },

    
    umekSalt: {
      type: String
    },

    
    umekProtectionType: {
      type: String,
      enum: ['PASSWORD', 'SERVER_KEK'],
      required: true
    },

    
    algorithm: {
      type: String,
      default: 'X25519'
    },

    
    
    kekVersion: {
      type: Number,
      default: null  
    },

    
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
