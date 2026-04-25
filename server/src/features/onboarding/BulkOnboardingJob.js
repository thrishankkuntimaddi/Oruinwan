const mongoose = require('mongoose');

const RowResultSchema = new mongoose.Schema({
    email: { type: String },
    name: { type: String },
    status: { type: String, enum: ['created', 'skipped', 'error'], required: true },
    reason: { type: String },   
}, { _id: false });

const WarningSchema = new mongoose.Schema({
    email: { type: String },
    warning: { type: String, required: true },
}, { _id: false });

const BulkOnboardingJobSchema = new mongoose.Schema({
    
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

    
    status: {
        type: String,
        enum: ['queued', 'processing', 'done', 'failed'],
        default: 'queued',
        index: true,
    },

    
    totalRows: { type: Number, default: 0 },
    processedRows: { type: Number, default: 0 },
    createdCount: { type: Number, default: 0 },
    skippedCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },

    
    results: { type: [RowResultSchema], default: [] },
    warnings: { type: [WarningSchema], default: [] },

    
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

}, {
    timestamps: true,    
    collection: 'bulk_onboarding_jobs',
});

BulkOnboardingJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

module.exports = mongoose.model('BulkOnboardingJob', BulkOnboardingJobSchema);
