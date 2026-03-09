// server/models/ScimToken.js
//
// Phase 4 — Enterprise Integration Layer
//
// SCIM bearer tokens — issued per company by an admin/owner.
// The raw token is only shown ONCE at creation (like a GitHub PAT).
// The SHA-256 hash is stored here and compared on every SCIM request.
//
// TTL: tokens expire 1 year after issuance or sooner if explicitly revoked.

const mongoose = require('mongoose');

const ScimTokenSchema = new mongoose.Schema({
    // Company this token belongs to
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true,
    },

    // The user who created this token (usually owner/admin)
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    // SHA-256 hash of the raw bearer token
    // Raw token shown once at creation, never stored
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    // Human-readable label (e.g. "Workday Sync", "BambooHR")
    label: {
        type: String,
        default: 'SCIM Token',
    },

    // Which HR provider this token is for (informational)
    provider: {
        type: String,
        enum: ['workday', 'bamboohr', 'rippling', 'generic', null],
        default: 'generic',
    },

    // Active / Revoked
    isActive: { type: Boolean, default: true, index: true },

    // Expiry (null = never expires, but 1-year default set at creation)
    expiresAt: { type: Date, default: null },

    // Last time this token was used (updated on every SCIM request)
    lastUsedAt: { type: Date, default: null },

}, {
    timestamps: true,
    collection: 'scim_tokens',
});

// Compound index for lookup on every SCIM request
ScimTokenSchema.index({ tokenHash: 1, isActive: 1 });

module.exports = mongoose.model('ScimToken', ScimTokenSchema);
