const mongoose = require('mongoose');
const { Schema } = mongoose;

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
        unique: true  
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

UserDeviceSessionSchema.index({ userId: 1, revokedAt: 1 });
UserDeviceSessionSchema.index({ userId: 1, lastActiveAt: -1 });

UserDeviceSessionSchema.methods.isRevoked = function () {
    return this.revokedAt !== null;
};

UserDeviceSessionSchema.methods.isActive = function () {
    return this.revokedAt === null;
};

UserDeviceSessionSchema.methods.revoke = async function () {
    this.revokedAt = new Date();
    await this.save();
};

UserDeviceSessionSchema.methods.updateActivity = async function () {
    this.lastActiveAt = new Date();
    await this.save();
};

const UserDeviceSession = mongoose.model('UserDeviceSession', UserDeviceSessionSchema);

module.exports = UserDeviceSession;
