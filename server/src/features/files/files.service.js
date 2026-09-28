const logger = require('../../../utils/logger');
const WorkspaceFile = require('./WorkspaceFile');
const FileVersion = require('./FileVersion');
const FileComment = require('./FileComment');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');

/**
 * Store a library file through the uploads module (GCS, or local disk when GCS isn't
 * configured). Either way it is served by /api/v2/uploads/file, which checks that the
 * reader is a member of the file's workspace. (The old fallback wrote to uploads/files,
 * which is served publicly without any check; it is only used if the uploads module fails.)
 */
async function uploadStorage(multerFile, folder, owner = {}) {
    try {
        const { uploadToGCS } = require('../../modules/uploads/upload.service');
        return await uploadToGCS(multerFile, folder, owner);
    } catch (storageErr) {
        if (process.env.NODE_ENV === 'production') throw storageErr;
        logger.warn('[FilesService] Storage upload failed — falling back to public local disk:', storageErr.message);
    }


    const localDir = path.join(__dirname, '../../../uploads/files');
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });

    const ext = path.extname(multerFile.originalname) || '';
    const fileName = `${randomUUID()}${ext}`;
    const filePath = path.join(localDir, fileName);
    fs.writeFileSync(filePath, multerFile.buffer);

    
    
    const baseUrl = process.env.BACKEND_URL || '';
    return {
        url: `${baseUrl}/uploads/files/${fileName}`,
        name: multerFile.originalname,
        size: multerFile.size,
        mimeType: multerFile.mimetype,
        type: multerFile.mimetype.startsWith('image/') ? 'image'
            : multerFile.mimetype.startsWith('video/') ? 'video'
            : multerFile.mimetype.startsWith('audio/') ? 'voice'
            : 'file',
        gcsPath: `local/${fileName}`, 
    };
}

/** Only members of a workspace see, add or comment on its library files. */
async function assertWorkspaceMember(workspaceId, userId) {
    if (!workspaceId || !mongoose.isValidObjectId(String(workspaceId))) {
        throw Object.assign(new Error('Invalid workspaceId'), { statusCode: 400 });
    }
    const Workspace = require('../../../models/Workspace');
    const ws = await Workspace.findOne({ _id: workspaceId, 'members.user': userId }).select('_id').lean();
    if (!ws) throw Object.assign(new Error('Not a member of this workspace'), { statusCode: 403 });
}

async function loadVisibleFile(fileId, userId) {
    if (!mongoose.isValidObjectId(String(fileId))) throw Object.assign(new Error('File not found'), { statusCode: 404 });
    const file = await WorkspaceFile.findById(fileId).lean();
    if (!file || file.isDeleted) throw Object.assign(new Error('File not found'), { statusCode: 404 });
    await assertWorkspaceMember(file.workspaceId, userId);
    return file;
}

function assertAccess(file, userId, minRole = 'view') {
    const roles = ['view', 'edit', 'download'];
    const minIdx = roles.indexOf(minRole);
    if (!file) throw Object.assign(new Error('File not found'), { statusCode: 404 });
    if (file.createdBy.toString() === userId.toString()) return; 
    const perm = file.permissions.find(p => p.user.toString() === userId.toString());
    if (!perm || roles.indexOf(perm.role) < minIdx) {
        throw Object.assign(new Error('Access denied'), { statusCode: 403 });
    }
}

async function uploadFile(userId, workspaceId, multerFile, opts = {}) {
    await assertWorkspaceMember(workspaceId, userId);
    const gcsResult = await uploadStorage(multerFile, `workspaces/${workspaceId}/files`, { userId });

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

async function getFiles(userId, workspaceId, filters = {}) {
    await assertWorkspaceMember(workspaceId, userId);
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

async function getFile(userId, fileId) {
    await loadVisibleFile(fileId, userId);
    const file = await WorkspaceFile.findById(fileId)
        .populate('createdBy', 'username firstName lastName avatarUrl profilePicture')
        .lean();
    if (!file || file.isDeleted) throw Object.assign(new Error('File not found'), { statusCode: 404 });
    return { file };
}

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

async function createVersion(userId, fileId, multerFile, changeNote = '') {
    const file = await WorkspaceFile.findById(fileId);
    assertAccess(file, userId, 'edit');

    
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

    
    const gcsResult = await uploadStorage(multerFile, `workspaces/${file.workspaceId}/files/versions`, { userId });

    file.url = gcsResult.url;
    file.gcsPath = gcsResult.gcsPath;
    file.size = gcsResult.size;
    file.mimeType = gcsResult.mimeType;
    file.currentVersion += 1;
    await file.save();

    return { file, version: file.currentVersion };
}

async function getVersions(userId, fileId) {
    const file = await loadVisibleFile(fileId, userId);

    const versions = await FileVersion.find({ fileId })
        .populate('createdBy', 'username firstName lastName avatarUrl')
        .sort({ versionNumber: -1 })
        .lean();

    return { versions, currentVersion: file.currentVersion };
}

async function restoreVersion(userId, fileId, versionId) {
    const file = await WorkspaceFile.findById(fileId);
    assertAccess(file, userId, 'edit');

    const version = await FileVersion.findById(versionId);
    if (!version || version.fileId.toString() !== fileId.toString()) {
        throw Object.assign(new Error('Version not found'), { statusCode: 404 });
    }

    
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

async function addComment(userId, fileId, content, parentId = null) {
    const file = await loadVisibleFile(fileId, userId);
    if (typeof content !== 'string' || !content.trim()) throw Object.assign(new Error('Comment is empty'), { statusCode: 400 });

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

async function getComments(userId, fileId) {
    await loadVisibleFile(fileId, userId);
    const comments = await FileComment.find({ fileId, isDeleted: false })
        .populate('author', 'username firstName lastName avatarUrl profilePicture')
        .sort({ createdAt: 1 })
        .lean();
    return { comments };
}

async function shareFile(userId, fileId, permissions) {
    const file = await WorkspaceFile.findById(fileId);
    if (!file || file.isDeleted) throw Object.assign(new Error('File not found'), { statusCode: 404 });
    if (file.createdBy.toString() !== userId.toString()) {
        throw Object.assign(new Error('Only file owner can share'), { statusCode: 403 });
    }

    
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

async function tagFile(userId, fileId, tags) {
    const file = await WorkspaceFile.findById(fileId);
    assertAccess(file, userId, 'edit');
    file.tags = tags.map(t => t.toLowerCase().trim());
    await file.save();
    return { file };
}

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
