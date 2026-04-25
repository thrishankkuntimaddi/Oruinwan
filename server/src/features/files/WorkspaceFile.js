const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['view', 'edit', 'download'], default: 'view' },
}, { _id: false });

const workspaceFileSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    url: { type: String, required: true },
    gcsPath: { type: String, required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceFile', default: null },
    tags: [{ type: String, lowercase: true, trim: true }],
    permissions: [permissionSchema],
    isDeleted: { type: Boolean, default: false },
    currentVersion: { type: Number, default: 1 },
}, { timestamps: true });

workspaceFileSchema.index({ name: 'text', description: 'text', tags: 'text' });
workspaceFileSchema.index({ workspaceId: 1, isDeleted: 1 });
workspaceFileSchema.index({ workspaceId: 1, folderId: 1 });

module.exports = mongoose.model('WorkspaceFile', workspaceFileSchema);
