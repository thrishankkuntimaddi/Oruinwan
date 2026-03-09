// server/models/SecurityEvent.js
//
// Phase 3 — Company Security Layer
//
// Tracks security-relevant events scoped to a company.
// Exposes: GET /api/company/security/events (admin/owner only)
//
// TTL: events auto-delete after 90 days.

const mongoose = require('mongoose');

const SecurityEventSchema = new mongoose.Schema({
    // Company scope — always required for tenant isolation
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true,
    },

    // The user whose action triggered the event (null for anonymous/system)
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },

    // Canonical event types
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

    // Severity
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info',
    },

    // Outcome
    outcome: {
        type: String,
        enum: ['success', 'failure'],
        default: 'success',
    },

    // Request context
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },

    // Flexible extra data (e.g., old role vs new role for role_changed)
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },

}, {
    timestamps: { createdAt: true, updatedAt: false },
    collection: 'security_events',
});

// Compound indexes for efficient queries
SecurityEventSchema.index({ companyId: 1, createdAt: -1 });
SecurityEventSchema.index({ companyId: 1, eventType: 1, createdAt: -1 });
SecurityEventSchema.index({ companyId: 1, severity: 1, createdAt: -1 });

// TTL — auto-delete security events after 90 days
SecurityEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('SecurityEvent', SecurityEventSchema);
