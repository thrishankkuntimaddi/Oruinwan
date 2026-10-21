const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Ranked view < download < edit (files.service.js ROLE_RANK).
    role: { type: String, enum: ['view', 'edit', 'download'], default: 'view' },
}, { _id: false });

const workspaceFileSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Who uploaded / last changed the current content (null on older files: the owner).
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    url: { type: String, required: true },
    gcsPath: { type: String, required: true },
    folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'WorkspaceFile', default: null },
    tags: [{ type: String, lowercase: true, trim: true }],
    permissions: [permissionSchema],
    // 'workspace': every active member may view and download.
    // 'restricted': only the owner, workspace owners/admins and users listed in
    // permissions see the file; downloading needs the download or edit role.
    access: { type: String, enum: ['workspace', 'restricted'], default: 'workspace' },
    isDeleted: { type: Boolean, default: false },
    currentVersion: { type: Number, default: 1 },
    currentVersionNote: { type: String, default: '' },
}, { timestamps: true });

workspaceFileSchema.index({ name: 'text', description: 'text', tags: 'text' });
workspaceFileSchema.index({ workspaceId: 1, isDeleted: 1 });
workspaceFileSchema.index({ workspaceId: 1, folderId: 1 });

module.exports = mongoose.model('WorkspaceFile', workspaceFileSchema);
