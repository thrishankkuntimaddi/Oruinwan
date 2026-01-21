/**
 * User Identity Key Model
 * 
 * Stores users' RSA/X25519 public keys for E2EE
 * Private keys NEVER stored on server - only on client device
 */

const mongoose = require('mongoose');

const UserIdentityKeySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true
        },

        /**
         * Public key in PEM format
         * Can be RSA-2048 or X25519
         */
        publicKey: {
            type: String,
            required: true
        },

        /**
         * Algorithm used: 'X25519' or 'RSA-2048'
         */
        algorithm: {
            type: String,
            enum: ['X25519', 'RSA-2048'],
            required: true
        },

        /**
         * Key version for future upgrades
         */
        version: {
            type: Number,
            default: 1,
            required: true
        },

        /**
         * When the key was first created
         */
        createdAt: {
            type: Date,
            default: Date.now
        },

        /**
         * Last time the key was updated
         */
        updatedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Index for quick lookups
// Note: userId already has unique: true which creates an index automatically
UserIdentityKeySchema.index({ algorithm: 1 });

// Static method to find or create
UserIdentityKeySchema.statics.findByUserId = function (userId) {
    return this.findOne({ userId });
};

// Static method to batch find multiple users
UserIdentityKeySchema.statics.batchFindByUserIds = function (userIds) {
    return this.find({ userId: { $in: userIds } });
};

module.exports = mongoose.model('UserIdentityKey', UserIdentityKeySchema);
