'use strict';

const mongoose = require('mongoose');

/**
 * Persisted Yjs state of one collaborative document (Y.encodeStateAsUpdate).
 * Kept apart from Note / KnowledgePage / Whiteboard so list queries never load
 * the binary. The plain content is written back to the owning record on save.
 */
const collabDocSchema = new mongoose.Schema({
    docType: { type: String, enum: ['note', 'knowledge', 'whiteboard'], required: true },
    docId: { type: String, required: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, default: null },
    state: { type: Buffer, required: true },
    // Bumped on every save; lets an instance tell whether its copy is stale.
    rev: { type: Number, default: 0 },
}, { timestamps: true });

collabDocSchema.index({ docType: 1, docId: 1 }, { unique: true });

module.exports = mongoose.models.CollabDoc || mongoose.model('CollabDoc', collabDocSchema);
