// server/src/features/onboarding/BulkOnboardingJob.js
//
// Phase 1 — Company Identity Layer
// Persistent job record for async bulk employee onboarding.
// Polling: GET /api/company/onboarding/status/:jobId reads this document.

const mongoose = require('mongoose');

const RowResultSchema = new mongoose.Schema({
    email: { type: String },
    name: { type: String },
    status: { type: String, enum: ['created', 'skipped', 'error'], required: true },
    reason: { type: String },   // error/skip reason
}, { _id: false });

const WarningSchema = new mongoose.Schema({
    email: { type: String },
    warning: { type: String, required: true },
}, { _id: false });

const BulkOnboardingJobSchema = new mongoose.Schema({
    // Stable identifier returned to the frontend immediately (HTTP 202)
    jobId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },

    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true,
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },

    // Lifecycle
    status: {
        type: String,
        enum: ['queued', 'processing', 'done', 'failed'],
        default: 'queued',
        index: true,
    },

    // Row counts
    totalRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0 },
    createdCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },

    // Per-row results (capped at 500 to avoid doc bloat)
    results: { type: [RowResultSchema], default: [] },
    warnings: { type: [WarningSchema], default: [] },

    // Timestamps
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

}, {
    timestamps: true,    // createdAt / updatedAt
    collection: 'bulk_onboarding_jobs',
});

// TTL index — auto-delete stale jobs after 7 days
BulkOnboardingJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('BulkOnboardingJob', BulkOnboardingJobSchema);
