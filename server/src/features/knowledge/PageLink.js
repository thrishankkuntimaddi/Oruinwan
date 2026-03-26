// server/src/features/knowledge/PageLink.js
const mongoose = require('mongoose');

const pageLinkSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    fromPageId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgePage', required: true },
    toPageId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgePage', required: true },
}, { timestamps: true });

pageLinkSchema.index({ fromPageId: 1 });
pageLinkSchema.index({ toPageId: 1 });
// Prevent duplicate edges
pageLinkSchema.index({ fromPageId: 1, toPageId: 1 }, { unique: true });

module.exports = mongoose.model('PageLink', pageLinkSchema);
