'use strict';

const mongoose = require('mongoose');

/**
 * One embedded chunk of workspace knowledge (a note, task or knowledge page)
 * for Oruinwan AI's meaning-based search. Rebuilt when the source changes.
 * Messages are end-to-end encrypted and are never indexed here.
 */
const AIEmbeddingSchema = new mongoose.Schema(
    {
        workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
        kind: { type: String, enum: ['note', 'task', 'knowledge'], required: true },
        ref: { type: mongoose.Schema.Types.ObjectId, required: true },
        chunk: { type: Number, default: 0 },
        title: { type: String, default: '' },
        text: { type: String, required: true },
        vector: { type: [Number], required: true },
        model: { type: String, required: true },
        sourceUpdatedAt: { type: Date, required: true },
    },
    { timestamps: true }
);

AIEmbeddingSchema.index({ workspace: 1, kind: 1, ref: 1, chunk: 1 }, { unique: true });

module.exports = mongoose.models.AIEmbedding || mongoose.model('AIEmbedding', AIEmbeddingSchema);
