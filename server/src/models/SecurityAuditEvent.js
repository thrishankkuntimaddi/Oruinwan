// server/src/models/SecurityAuditEvent.js

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * SecurityAuditEvent Model
 * 
 * PHASE 4A: Security observability and audit logging
 * 
 * Purpose:
 * - Record sensitive security events for observability
 * - Append-only, read-only audit trail
 * - Help users track security-related activities
 * 
 * CRITICAL:
 * - This is observability ONLY, not enforcement
 * - Failures MUST NOT affect main execution paths
 * - Never store secrets, keys, or sensitive crypto material
 */
const SecurityAuditEventSchema = new Schema({
    userId: {
        type: String,
        required: true,
        index: true
    },
    eventType: {
        type: String,
        required: true,
        enum: [
            'LOGIN_NEW_DEVICE',
            'DEVICE_REVOKED',
            'ALL_DEVICES_REVOKED',
            'PASSWORD_CHANGED',
            'OAUTH_TO_PASSWORD_MIGRATION',
            'UMEK_ROTATED',
            'IDENTITY_RECOVERED',
            'DEVICE_REVOKED_ACCESS_BLOCKED',
            'FAILED_CRYPTO_ACCESS',
            // PHASE 4D: KEK rotation events
            'SERVER_KEK_ROTATION_STARTED',
            'SERVER_KEK_ROTATION_COMPLETED',
            'SERVER_KEK_ROTATION_FAILED'
        ]
    },
    deviceId: {
        type: String,
        default: null
    },
    deviceName: {
        type: String,
        default: null
    },
    platform: {
        type: String,
        default: null
    },
    ipAddress: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    },
    metadata: {
        type: Schema.Types.Mixed,
        default: {}
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true,
        immutable: true
    }
});

// Compound index for efficient user queries
SecurityAuditEventSchema.index({ userId: 1, createdAt: -1 });

// Virtual: formatted event type for display
SecurityAuditEventSchema.virtual('eventDescription').get(function () {
    const descriptions = {
        'LOGIN_NEW_DEVICE': 'New device login',
        'DEVICE_REVOKED': 'Device revoked',
        'ALL_DEVICES_REVOKED': 'All other devices revoked',
        'PASSWORD_CHANGED': 'Password changed',
        'OAUTH_TO_PASSWORD_MIGRATION': 'Migrated to password protection',
        'UMEK_ROTATED': 'Encryption key protection updated',
        'IDENTITY_RECOVERED': 'Identity keys recovered',
        'DEVICE_REVOKED_ACCESS_BLOCKED': 'Access blocked from revoked device',
        'FAILED_CRYPTO_ACCESS': 'Failed cryptographic operation'
    };
    return descriptions[this.eventType] || this.eventType;
});

const SecurityAuditEvent = mongoose.model('SecurityAuditEvent', SecurityAuditEventSchema);

module.exports = SecurityAuditEvent;
