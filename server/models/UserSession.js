const mongoose = require('mongoose');

/**
 * UserSession Model
 * Tracks active user sessions for security monitoring
 */
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

    // Session token (hashed)
    token: {
        type: String,
        required: true
    },

    // Device and browser info
    device: {
        type: String, // e.g., "Chrome on MacOS", "Safari on iOS"
        default: 'Unknown Device'
    },
    os: {
        type: String, // e.g., "MacOS", "Windows", "iOS"
        default: null
    },
    browser: {
        type: String, // e.g., "Chrome", "Safari", "Firefox"
        default: null
    },

    // Location info
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

    // Session timing
    lastActivityAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: {
        type: Date,
        required: true
    },

    // Session status
    isActive: {
        type: Boolean,
        default: true
    },
    logoutAt: {
        type: Date,
        default: null
    },

    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes
UserSessionSchema.index({ userId: 1, isActive: 1 });
UserSessionSchema.index({ companyId: 1, isActive: 1 });
UserSessionSchema.index({ token: 1 }, { unique: true });
UserSessionSchema.index({ lastActivityAt: -1 });

// Auto-cleanup expired sessions (TTL index)
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('UserSession', UserSessionSchema);
