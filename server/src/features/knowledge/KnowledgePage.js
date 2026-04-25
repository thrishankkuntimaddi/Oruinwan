const mongoose = require('mongoose');

const versionEntrySchema = new mongoose.Schema({
    content: { type: String, default: '' },
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    savedAt: { type: Date, default: Date.now },
}, { _id: false });

const knowledgePageSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: '' },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgePage', default: null },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'KnowledgeCategory', default: null },
    tags: [{ type: String, lowercase: true, trim: true }],
    summary: { type: String, default: '' }, 
    isHandbook: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    icon: { type: String, default: '📄' },
    versions: {
        type: [versionEntrySchema],
        default: [],
        validate: {
            validator: function(v) { return v.length <= 50; },
            message: 'Maximum 50 versions stored per page',
        },
    },
}, { timestamps: true });

knowledgePageSchema.index({ title: 'text', content: 'text', tags: 'text' });
knowledgePageSchema.index({ workspaceId: 1, isDeleted: 1 });
knowledgePageSchema.index({ workspaceId: 1, parentId: 1 });

module.exports = mongoose.model('KnowledgePage', knowledgePageSchema);
