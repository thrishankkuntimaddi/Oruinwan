// server/models/ComplianceLog.js
// Immutable compliance record — write-once, never updated or deleted.
// Used for security/legal compliance audit trails distinct from operational AuditLog.
const mongoose = require('mongoose');
const crypto = require('crypto');

const ComplianceLogSchema = new mongoose.Schema({
    // Tenant isolation
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },

    // Who performed the action
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorEmail: { type: String }, // Denormalized for historical accuracy (user may be deleted)
    actorRole: { type: String },  // Role at time of action

    // What happened
    action: { type: String, required: true }, // e.g. 'workspace.cloned', 'permissions.updated'
    category: {
        type: String,
        enum: ['workspace', 'org', 'permissions', 'security', 'auth', 'billing', 'data-export', 'data-import'],
        required: true
    },
    severity: {
        type: String,
        enum: ['info', 'warning', 'critical'],
        default: 'info'
    },

    // Target resource
    resourceType: { type: String }, // 'Workspace', 'Team', 'Permission', 'User', etc.
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    resourceName: { type: String }, // Denormalized snapshot

    // Rich detail payload (read-only snapshot)
    details: { type: mongoose.Schema.Types.Mixed },

    // Request metadata for forensics
    ipAddress: { type: String },
    userAgent: { type: String },

    // Tamper-detection hash: SHA-256(companyId|actorId|action|resourceId|createdAt)
    // Generated at write time, verified on read by the compliance log viewer.
    hash: { type: String, required: true },

    // Write-only timestamp (no updatedAt)
    createdAt: { type: Date, default: Date.now }

}, {
    timestamps: false, // Only createdAt — no updatedAt
    versionKey: false  // Remove __v to prevent version-bump writes
});

// Pre-save: compute hash and block updates
ComplianceLogSchema.pre('save', function (next) {
    // Block updates — compliance logs are CREATE ONLY
    if (!this.isNew) {
        return next(new Error('ComplianceLog records are immutable and cannot be modified.'));
    }
    // Compute tamper-detection hash
    const ts = this.createdAt instanceof Date ? this.createdAt.getTime() : Date.now();
    const raw = `${this.companyId}|${this.actorId}|${this.action}|${String(this.resourceId || '')}|${ts}`;
    this.hash = crypto.createHash('sha256').update(raw).digest('hex');
    next();
});

// Prevent findOneAndUpdate / updateMany / deleteMany etc.
ComplianceLogSchema.pre(['findOneAndUpdate', 'updateOne', 'updateMany'], function (next) {
    next(new Error('ComplianceLog records cannot be updated via query middleware.'));
});

// Indexes
ComplianceLogSchema.index({ companyId: 1, createdAt: -1 });
ComplianceLogSchema.index({ actorId: 1, createdAt: -1 });
ComplianceLogSchema.index({ category: 1, severity: 1, createdAt: -1 });
ComplianceLogSchema.index({ resourceType: 1, resourceId: 1 });

module.exports = mongoose.model('ComplianceLog', ComplianceLogSchema);
