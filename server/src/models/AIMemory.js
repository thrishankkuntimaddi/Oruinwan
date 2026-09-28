'use strict';

const mongoose = require('mongoose');

/**
 * Something Oruinwan AI remembers about one user ("I lead the design team",
 * "keep replies short"). Used only in that user's private assistant chats.
 * `workspace: null` means it applies in every workspace.
 */
const AIMemorySchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
        text: { type: String, required: true, trim: true, maxlength: 500 },
        source: { type: String, enum: ['user', 'assistant'], default: 'user' },
    },
    { timestamps: true }
);

AIMemorySchema.index({ user: 1, workspace: 1, updatedAt: -1 });

module.exports = mongoose.models.AIMemory || mongoose.model('AIMemory', AIMemorySchema);
