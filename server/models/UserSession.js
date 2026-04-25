const mongoose = require('mongoose');

const UserSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        default: null
    },

    
    token: {
        type: String,
        required: true
    },

    
    device: {
        type: String, 
        default: 'Unknown Device'
    },
    os: {
        type: String, 
        default: null
    },
    browser: {
        type: String, 
        default: null
    },

    
    ipAddress: {
        type: String,
        required: true
    },
    location: {
        city: String,
        state: String,
        country: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },

    
    lastActivityAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    },

    
    isActive: {
        type: Boolean,
        default: true
    },
    logoutAt: {
        type: Date,
        default: null
    },

    
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

UserSessionSchema.index({ userId: 1, isActive: 1 });
UserSessionSchema.index({ companyId: 1, isActive: 1 });
UserSessionSchema.index({ token: 1 }, { unique: true });
UserSessionSchema.index({ lastActivityAt: -1 });

UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UserSession', UserSessionSchema);
