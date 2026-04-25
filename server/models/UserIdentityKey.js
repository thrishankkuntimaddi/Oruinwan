const mongoose = require('mongoose');

const UserIdentityKeySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            unique: true
        },

        
        publicKey: {
            type: String,
            required: true
        },

        
        algorithm: {
            type: String,
            enum: ['X25519', 'RSA-2048'],
            required: true
        },

        
        version: {
            type: Number,
            default: 1,
            required: true
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

UserIdentityKeySchema.index({ algorithm: 1 });

UserIdentityKeySchema.statics.findByUserId = function (userId) {
    return this.findOne({ userId });
};

UserIdentityKeySchema.statics.batchFindByUserIds = function (userIds) {
    return this.find({ userId: { $in: userIds } });
};

module.exports = mongoose.model('UserIdentityKey', UserIdentityKeySchema);
