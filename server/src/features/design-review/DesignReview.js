'use strict';

const mongoose = require('mongoose');

const REVIEW_STATUSES = ['open', 'changes_requested', 'approved'];
const DECISIONS = ['pending', 'approved', 'changes_requested'];

const reviewerSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    decision: { type: String, enum: DECISIONS, default: 'pending' },
    note: { type: String, default: '', maxlength: 2000 },
    decidedAt: { type: Date, default: null },
}, { _id: false });

/**
 * A review of one library file (WorkspaceFile) at one version.
 *
 * Versions are identified by `versionNumber` (WorkspaceFile.currentVersion at
 * the time; older versions live in FileVersion with the same number).
 * `fileVersionId` is the FileVersion row for that number when one exists, or
 * null while the reviewed version is still the file's current version.
 */
const designReviewSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceFile', required: true, index: true },
    fileVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'FileVersion', default: null },
    versionNumber: { type: Number, required: true, min: 1 },
    // Every version this review has looked at, oldest first (a new round appends).
    rounds: [{
        _id: false,
        versionNumber: { type: Number, required: true },
        startedAt: { type: Date, default: Date.now },
    }],
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 5000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reviewers: { type: [reviewerSchema], default: [] },
    status: { type: String, enum: REVIEW_STATUSES, default: 'open' },
    dueDate: { type: Date, default: null },
    deleted: { type: Boolean, default: false },
}, { timestamps: true });

designReviewSchema.index({ workspaceId: 1, deleted: 1, status: 1 });
designReviewSchema.index({ fileId: 1, deleted: 1 });
designReviewSchema.index({ 'reviewers.user': 1, status: 1 });

module.exports = mongoose.model('DesignReview', designReviewSchema);
module.exports.REVIEW_STATUSES = REVIEW_STATUSES;
module.exports.DECISIONS = DECISIONS;
