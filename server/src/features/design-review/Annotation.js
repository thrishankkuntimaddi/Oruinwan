'use strict';

const mongoose = require('mongoose');

const unit = { type: Number, min: 0, max: 1 };

const replySchema = new mongoose.Schema({
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 5000 },
}, { timestamps: true });

/**
 * A pinned comment on a reviewed file. Coordinates are normalised to the
 * rendered page/frame: x, y (top-left) and w, h (optional box) are 0..1, so
 * they survive any zoom or device size. `page` is 1-based (PDFs; 1 for images
 * and videos). `timeMs` is the video timestamp (null for images and PDFs).
 */
const annotationSchema = new mongoose.Schema({
    reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'DesignReview', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceFile', required: true, index: true },
    fileVersionId: { type: mongoose.Schema.Types.ObjectId, ref: 'FileVersion', default: null },
    versionNumber: { type: Number, required: true, min: 1 },
    page: { type: Number, min: 1, default: 1 },
    x: { ...unit, required: true },
    y: { ...unit, required: true },
    w: { ...unit, default: 0 },
    h: { ...unit, default: 0 },
    timeMs: { type: Number, min: 0, default: null },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    body: { type: String, required: true, maxlength: 5000 },
    resolved: { type: Boolean, default: false },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
    replies: { type: [replySchema], default: [] },
    deleted: { type: Boolean, default: false },
}, { timestamps: true });

annotationSchema.index({ reviewId: 1, versionNumber: 1, deleted: 1 });
annotationSchema.index({ fileId: 1, versionNumber: 1, deleted: 1 });

module.exports = mongoose.model('DesignAnnotation', annotationSchema);
