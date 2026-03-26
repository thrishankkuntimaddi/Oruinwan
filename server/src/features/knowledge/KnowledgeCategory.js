// server/src/features/knowledge/KnowledgeCategory.js
const mongoose = require('mongoose');

const knowledgeCategorySchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#6366f1' },
    icon: { type: String, default: '📂' },
    order: { type: Number, default: 0 },
}, { timestamps: true });

knowledgeCategorySchema.index({ workspaceId: 1, order: 1 });

module.exports = mongoose.model('KnowledgeCategory', knowledgeCategorySchema);
