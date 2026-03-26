// server/src/features/files/FileComment.js
const mongoose = require('mongoose');

const fileCommentSchema = new mongoose.Schema({
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceFile', required: true, index: true },
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'FileComment', default: null },
    isDeleted: { type: Boolean, default: false },
}, { timestamps: true });

fileCommentSchema.index({ fileId: 1, createdAt: 1 });

module.exports = mongoose.model('FileComment', fileCommentSchema);
