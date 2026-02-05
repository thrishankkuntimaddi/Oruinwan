// server/src/models/UserDeviceSession.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * UserDeviceSession Model
 * 
 * PHASE 3: Device awareness and session management
 * 
 * Purpose:
 * - Track active browser/device sessions per user
 * - Allow device revocation without affecting identity keys
 * - Monitor device activity
 * 
 * CRITICAL: Device sessions are AUTH sessions, NOT crypto identities
 * - All devices share the same user identity keypair
 * - Revocation affects auth only, not message encryption
 */
const UserDeviceSessionSchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    deviceId: {
        type: String,
        required: true,
        index: true,
        unique: true  // Each deviceId is globally unique (UUID v4)
    },
    deviceName: {
        type: String,
        required: true,
        default: 'Unknown Device'
    },
    platform: {
        type: String,
        enum: ['web', 'ios', 'android', 'unknown'],
        default: 'unknown'
    },
    userAgent: {
        type: String,
        default: null
    },
    ipAddress: {
        type: String,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    lastActiveAt: {
        type: Date,
        default: Date.now
    },
    revokedAt: {
        type: Date,
        default: null
    },
    trustLevel: {
        type: String,
        enum: ['trusted', 'untrusted'],
        default: 'trusted'
    }
});

// Compound index for efficient queries
UserDeviceSessionSchema.index({ userId: 1, revokedAt: 1 });
UserDeviceSessionSchema.index({ userId: 1, lastActiveAt: -1 });

/**
 * Check if session is revoked
 */
UserDeviceSessionSchema.methods.isRevoked = function () {
    return this.revokedAt !== null;
};

/**
 * Check if session is active (not revoked)
 */
UserDeviceSessionSchema.methods.isActive = function () {
    return this.revokedAt === null;
};

/**
 * Revoke this session
 */
UserDeviceSessionSchema.methods.revoke = async function () {
    this.revokedAt = new Date();
    await this.save();
};

/**
 * Update last active timestamp
 */
UserDeviceSessionSchema.methods.updateActivity = async function () {
    this.lastActiveAt = new Date();
    await this.save();
};

const UserDeviceSession = mongoose.model('UserDeviceSession', UserDeviceSessionSchema);

module.exports = UserDeviceSession;
