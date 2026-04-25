const mongoose = require('mongoose');

const SecurityEventSchema = new mongoose.Schema({
    
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true,
    },

    
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },

    
    eventType: {
        type: String,
        required: true,
        enum: [
            'login_success',
            'login_failure',
            'logout',
            'invite_accepted',
            'password_changed',
            'password_reset_requested',
            'role_changed',
            'account_suspended',
            'account_reactivated',
            'sso_login',
            'api_key_created',
            'api_key_revoked',
            'bulk_import_started',
            'bulk_import_completed',
        ],
        index: true,
    },

    
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info',
    },

    
    outcome: {
        type: String,
        enum: ['success', 'failure'],
        default: 'success',
    },

    
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },

    
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

}, {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'security_events',
});

SecurityEventSchema.index({ companyId: 1, createdAt: -1 });
SecurityEventSchema.index({ companyId: 1, eventType: 1, createdAt: -1 });
SecurityEventSchema.index({ companyId: 1, severity: 1, createdAt: -1 });

SecurityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('SecurityEvent', SecurityEventSchema);
