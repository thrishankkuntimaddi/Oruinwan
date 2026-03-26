// server/src/features/files/files.service.js
/**
 * Files Service — Business Logic Layer
 * Handles all file management operations: upload, versioning, tagging, sharing, commenting.
 * Uses GCS for storage in production; falls back to local disk in dev when GCS is unavailable.
 */

const WorkspaceFile = require('./WorkspaceFile');
const FileVersion = require('./FileVersion');
const FileComment = require('./FileComment');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

// ── Storage abstraction — GCS with local-disk fallback ────────────────────────

/**
 * Upload a file to GCS, falling back to local disk if GCS is unavailable.
 * Returns the same shape as uploadToGCS so the rest of the service is unaffected.
 */
async function uploadStorage(multerFile, folder) {
    // Attempt GCS if bucket name is configured
    if (process.env.GCS_BUCKET_NAME) {
        try {
            const { uploadToGCS } = require('../../modules/uploads/upload.service');
            return await uploadToGCS(multerFile, folder);
        } catch (gcsErr) {
            console.warn('[FilesService] GCS upload failed — falling back to local disk:', gcsErr.message);
        }
    }

    // ── Local-disk fallback ───────────────────────────────────────────────────
    const localDir = path.join(__dirname, '../../../uploads/files');
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    const ext = path.extname(multerFile.originalname) || '';
    const fileName = `${randomUUID()}${ext}`;
    const filePath = path.join(localDir, fileName);
    fs.writeFileSync(filePath, multerFile.buffer);

    return {
        url: `/uploads/files/${fileName}`,
        name: multerFile.originalname,
        size: multerFile.size,
        mimeType: multerFile.mimetype,
        type: multerFile.mimetype.startsWith('image/') ? 'image'
            : multerFile.mimetype.startsWith('video/') ? 'video'
            : multerFile.mimetype.startsWith('audio/') ? 'voice'
            : 'file',
        gcsPath: `local/${fileName}`, // sentinel — not a real GCS path
    };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function assertAccess(file, userId, minRole = 'view') {
    const roles = ['view', 'edit', 'download'];
    const minIdx = roles.indexOf(minRole);
    if (!file) throw Object.assign(new Error('File not found'), { statusCode: 404 });
    if (file.createdBy.toString() === userId.toString()) return; // owner always has full access
    const perm = file.permissions.find(p => p.user.toString() === userId.toString());
    if (!perm || roles.indexOf(perm.role) < minIdx) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
}

// ── service methods ───────────────────────────────────────────────────────────

/**
 * Upload a new file to a workspace.
 * @param {string} userId
 * @param {string} workspaceId
 * @param {object} multerFile - multer file object (buffer in memory)
 * @param {object} opts - { description, folderId, tags }
 */
async function uploadFile(userId, workspaceId, multerFile, opts = {}) {
    const gcsResult = await uploadStorage(multerFile, `workspaces/${workspaceId}/files`);

    const file = await WorkspaceFile.create({
        workspaceId,
        createdBy: userId,
        name: multerFile.originalname,
        description: opts.description || '',
        mimeType: gcsResult.mimeType,
        size: gcsResult.size,
        url: gcsResult.url,
        gcsPath: gcsResult.gcsPath,
        folderId: opts.folderId || null,
        tags: opts.tags || [],
        permissions: [],
        currentVersion: 1,
    });

    return file;
}

/**
 * List files in a workspace with optional filters.
 */
async function getFiles(userId, workspaceId, filters = {}) {
    const query = { workspaceId, isDeleted: false };

    if (filters.folderId !== undefined) {
        query.folderId = filters.folderId === 'root' ? null : filters.folderId;
    }
    if (filters.tags && filters.tags.length > 0) {
        const tagList = Array.isArray(filters.tags) ? filters.tags : filters.tags.split(',');
        query.tags = { $in: tagList.map(t => t.toLowerCase()) };
    }
    if (filters.search) {
        query.$text = { $search: filters.search };
    }

    const files = await WorkspaceFile.find(query)
        .populate('createdBy', 'username firstName lastName avatarUrl profilePicture')
        .sort({ createdAt: -1 })
        .lean();

    return { files };
}

/**
 * Get a single file's metadata.
 */
async function getFile(userId, fileId) {
    const file = await WorkspaceFile.findById(fileId)
        .populate('createdBy', 'username firstName lastName avatarUrl profilePicture')
        .lean();
    if (!file || file.isDeleted) throw Object.assign(new Error('File not found'), { statusCode: 404 });
    return { file };
}

/**
 * Update file metadata (name, description, folderId).
 */
async function updateFile(userId, fileId, updates) {
    const file = await WorkspaceFile.findById(fileId);
    assertAccess(file, userId, 'edit');

    const allowed = ['name', 'description', 'folderId'];
    allowed.forEach(key => {
        if (updates[key] !== undefined) file[key] = updates[key];
    });
    await file.save();
    return { file };
}

/**
 * Upload a new version of a file.
 */
async function createVersion(userId, fileId, multerFile, changeNote = '') {
    const file = await WorkspaceFile.findById(fileId);
    assertAccess(file, userId, 'edit');

    // Save current version to history
    await FileVersion.create({
        fileId,
        versionNumber: file.currentVersion,
        url: file.url,
        gcsPath: file.gcsPath,
        size: file.size,
        mimeType: file.mimeType,
        createdBy: file.createdBy,
        changeNote: changeNote || `Version ${file.currentVersion}`,
    });

    // Upload new version to GCS
    const gcsResult = await uploadStorage(multerFile, `workspaces/${file.workspaceId}/files/versions`);

    file.url = gcsResult.url;
    file.gcsPath = gcsResult.gcsPath;
    file.size = gcsResult.size;
    file.mimeType = gcsResult.mimeType;
    file.currentVersion += 1;
    await file.save();

    return { file, version: file.currentVersion };
}

/**
 * Get version history for a file.
 */
async function getVersions(userId, fileId) {
    const file = await WorkspaceFile.findById(fileId).lean();
    if (!file || file.isDeleted) throw Object.assign(new Error('File not found'), { statusCode: 404 });

    const versions = await FileVersion.find({ fileId })
        .populate('createdBy', 'username firstName lastName avatarUrl')
        .sort({ versionNumber: -1 })
        .lean();

    return { versions, currentVersion: file.currentVersion };
}

/**
 * Restore a previous file version (swap to it).
 */
async function restoreVersion(userId, fileId, versionId) {
    const file = await WorkspaceFile.findById(fileId);
    assertAccess(file, userId, 'edit');

    const version = await FileVersion.findById(versionId);
    if (!version || version.fileId.toString() !== fileId.toString()) {
        throw Object.assign(new Error('Version not found'), { statusCode: 404 });
    }

    // Save current as a version
    await FileVersion.create({
        fileId,
        versionNumber: file.currentVersion,
        url: file.url,
        gcsPath: file.gcsPath,
        size: file.size,
        mimeType: file.mimeType,
        createdBy: userId,
        changeNote: 'Before restore',
    });

    file.url = version.url;
    file.gcsPath = version.gcsPath;
    file.size = version.size;
    file.mimeType = version.mimeType;
    file.currentVersion += 1;
    await file.save();

    return { file };
}

/**
 * Add a comment to a file.
 */
async function addComment(userId, fileId, content, parentId = null) {
    const file = await WorkspaceFile.findById(fileId).lean();
    if (!file || file.isDeleted) throw Object.assign(new Error('File not found'), { statusCode: 404 });

    const comment = await FileComment.create({
        fileId,
        workspaceId: file.workspaceId,
        author: userId,
        content: content.trim(),
        parentId: parentId || null,
    });

    await comment.populate('author', 'username firstName lastName avatarUrl profilePicture');
    return { comment };
}

/**
 * Get comments for a file (threaded).
 */
async function getComments(userId, fileId) {
    const comments = await FileComment.find({ fileId, isDeleted: false })
        .populate('author', 'username firstName lastName avatarUrl profilePicture')
        .sort({ createdAt: 1 })
        .lean();
    return { comments };
}

/**
 * Share a file — set role-based permissions.
 */
async function shareFile(userId, fileId, permissions) {
    const file = await WorkspaceFile.findById(fileId);
    if (!file || file.isDeleted) throw Object.assign(new Error('File not found'), { statusCode: 404 });
    if (file.createdBy.toString() !== userId.toString()) {
        throw Object.assign(new Error('Only file owner can share'), { statusCode: 403 });
    }

    // Upsert permissions
    permissions.forEach(({ user, role }) => {
        const existing = file.permissions.find(p => p.user.toString() === user.toString());
        if (existing) {
            existing.role = role;
        } else {
            file.permissions.push({ user, role });
        }
    });
    await file.save();
    return { file };
}

/**
 * Update file tags.
 */
async function tagFile(userId, fileId, tags) {
    const file = await WorkspaceFile.findById(fileId);
    assertAccess(file, userId, 'edit');
    file.tags = tags.map(t => t.toLowerCase().trim());
    await file.save();
    return { file };
}

/**
 * Soft-delete a file.
 */
async function deleteFile(userId, fileId) {
    const file = await WorkspaceFile.findById(fileId);
    if (!file || file.isDeleted) throw Object.assign(new Error('File not found'), { statusCode: 404 });
    if (file.createdBy.toString() !== userId.toString()) {
        throw Object.assign(new Error('Only file owner can delete'), { statusCode: 403 });
    }
    file.isDeleted = true;
    await file.save();
    return { message: 'File deleted' };
}

module.exports = {
    uploadFile,
    getFiles,
    getFile,
    updateFile,
    createVersion,
    getVersions,
    restoreVersion,
    addComment,
    getComments,
    shareFile,
    tagFile,
    deleteFile,
};
