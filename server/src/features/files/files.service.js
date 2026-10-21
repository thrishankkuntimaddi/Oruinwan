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

const { hydrate } = require('../../identity/hydrate');
const PERSON = { type: 'user', fields: ['username', 'profilePicture', 'profile'] };

/**
 * Access model for library files:
 *   - every active member of the file's workspace can see the file, its
 *     versions and its comments, and can comment
 *   - permission roles rank view < download < edit; `edit` (or ownership)
 *     is needed to rename, retag, upload or restore versions
 *   - the owner (or a workspace owner/admin) shares and deletes
 *   - a file with access 'restricted' is visible only to its owner, workspace
 *     owners/admins and users listed in its permissions (others get 404), and
 *     downloading it needs the download or edit role
 */
const ROLE_RANK = { view: 0, download: 1, edit: 2 };
const MAX_TAGS = 30;

const httpErr = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const isId = (v) => v != null && /^[a-f\d]{24}$/i.test(String(v)) && mongoose.isValidObjectId(String(v));

/** Active member of the workspace; returns { workspace, isAdmin }. */
async function assertWorkspaceMember(workspaceId, userId) {
    if (!workspaceId || !isId(workspaceId)) throw httpErr(400, 'Invalid workspaceId');
    const ws = await require('../../identity').workspaces.findById(workspaceId);
    const member = ws && (ws.members || []).find(m => String(m.user?._id || m.user) === String(userId) && (m.status || 'active') === 'active');
    if (!member) throw httpErr(403, 'Not a member of this workspace');
    return { workspace: ws, isAdmin: member.role === 'owner' || member.role === 'admin' };
}

const isRestricted = (file) => file && file.access === 'restricted';

/** Whether the user may see the file at all (restricted files: owner, admins, grantees). */
function canSee(file, userId, isAdmin) {
    if (!isRestricted(file) || isAdmin) return true;
    if (String(file.createdBy?._id || file.createdBy) === String(userId)) return true;
    return (file.permissions || []).some(p => String(p.user?._id || p.user) === String(userId));
}

/**
 * A live file the user may see, in a workspace they are an active member of
 * (a document unless lean). Restricted files the user is not on answer 404.
 */
async function loadFileForMember(fileId, userId, { lean = false } = {}) {
    if (!isId(fileId)) throw httpErr(404, 'File not found');
    const q = WorkspaceFile.findById(fileId);
    const file = lean ? await q.lean() : await q;
    if (!file || file.isDeleted) throw httpErr(404, 'File not found');
    let access;
    try {
        access = await assertWorkspaceMember(file.workspaceId, userId);
    } catch (err) {
        if (isRestricted(file)) throw httpErr(404, 'File not found');
        throw err;
    }
    if (!canSee(file, userId, access.isAdmin)) throw httpErr(404, 'File not found');
    return { file, ...access };
}

async function loadVisibleFile(fileId, userId) {
    const { file } = await loadFileForMember(fileId, userId, { lean: true });
    return file;
}

/** Effective role of the user on a file: 'owner' | 'edit' | 'download' | 'view'. */
function roleOf(file, userId) {
    if (String(file.createdBy?._id || file.createdBy) === String(userId)) return 'owner';
    const perm = (file.permissions || []).find(p => String(p.user?._id || p.user) === String(userId));
    return perm ? perm.role : 'view';
}

function assertAccess(file, userId, minRole = 'view') {
    if (!file) throw httpErr(404, 'File not found');
    const role = roleOf(file, userId);
    if (role === 'owner') return;
    if ((ROLE_RANK[role] ?? 0) < (ROLE_RANK[minRole] ?? 0)) throw httpErr(403, 'Access denied');
}

function normaliseTags(tags) {
    if (tags === undefined || tags === null) return [];
    const list = Array.isArray(tags) ? tags : String(tags).split(',');
    if (list.some(t => typeof t !== 'string')) throw httpErr(400, 'tags must be strings');
    const out = [...new Set(list.map(t => t.toLowerCase().trim()).filter(Boolean))];
    if (out.length > MAX_TAGS) throw httpErr(400, `At most ${MAX_TAGS} tags`);
    if (out.some(t => t.length > 50)) throw httpErr(400, 'Tags must be at most 50 characters');
    return out;
}

/** A folder id must be another live file in the same workspace (or null / 'root'). */
async function resolveFolderId(folderId, workspaceId, selfId = null) {
    if (folderId === undefined) return undefined;
    if (folderId === null || folderId === '' || folderId === 'root') return null;
    if (!isId(folderId)) throw httpErr(400, 'Invalid folderId');
    if (selfId && String(folderId) === String(selfId)) throw httpErr(400, 'A file cannot be its own folder');
    const folder = await WorkspaceFile.findOne({ _id: folderId, workspaceId, isDeleted: false }).select('_id').lean();
    if (!folder) throw httpErr(400, 'Invalid folderId');
    return folder._id;
}

/**
 * `file.uploaded` automation trigger for workspace library files (metadata only).
 * Chat attachments are not included: they belong to end-to-end encrypted
 * conversations, and DM activity must never feed automations.
 */
function emitFileUploaded(file, userId, io) {
    try {
        const ext = path.extname(file.name || '').replace('.', '').toLowerCase() || null;
        require('../../modules/notifications/notificationEventEmitter').emit('file.uploaded', {
            io: io || null,
            workspaceId: String(file.workspaceId),
            fileId: String(file._id),
            fileName: file.name,
            extension: ext,
            mimeType: file.mimeType || null,
            size: file.size || 0,
            sizeMB: Math.round(((file.size || 0) / (1024 * 1024)) * 100) / 100,
            folderId: file.folderId ? String(file.folderId) : null,
            tags: file.tags || [],
            userId: String(userId),
            uploadedBy: String(userId),
        });
    } catch (err) {
        logger.warn({ err: err.message }, '[files] file.uploaded emit failed');
    }
}

async function uploadFile(userId, workspaceId, multerFile, opts = {}) {
    await assertWorkspaceMember(workspaceId, userId);
    const tags = normaliseTags(opts.tags);
    const folderId = await resolveFolderId(opts.folderId, workspaceId);
    const gcsResult = await uploadStorage(multerFile, `workspaces/${workspaceId}/files`, { userId });

    const file = await WorkspaceFile.create({
        workspaceId,
        createdBy: userId,
        updatedBy: userId,
        name: multerFile.originalname,
        description: typeof opts.description === 'string' ? opts.description : '',
        mimeType: gcsResult.mimeType,
        size: gcsResult.size,
        url: gcsResult.url,
        gcsPath: gcsResult.gcsPath,
        folderId: folderId || null,
        tags,
        permissions: [],
        currentVersion: 1,
    });

    emitFileUploaded(file, userId, opts.io);
    return file;
}

async function getFiles(userId, workspaceId, filters = {}) {
    const { isAdmin } = await assertWorkspaceMember(workspaceId, userId);
    const query = { workspaceId, isDeleted: false };
    if (!isAdmin) {
        query.$or = [{ access: { $ne: 'restricted' } }, { createdBy: userId }, { 'permissions.user': userId }];
    }

    if (filters.folderId !== undefined && filters.folderId !== '') {
        if (filters.folderId === 'root') query.folderId = null;
        else if (isId(filters.folderId)) query.folderId = filters.folderId;
        else throw httpErr(400, 'Invalid folderId');
    }
    if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: normaliseTags(filters.tags) };
    }
    if (filters.search && typeof filters.search === 'string') {
        query.$text = { $search: filters.search };
    }

    const files = await WorkspaceFile.find(query)
        .sort({ createdAt: -1 })
        .lean();
    const roles = files.map(f => roleOf(f, userId));
    await hydrate(files, { createdBy: PERSON });

    return { files: files.map((f, i) => ({ ...f, myRole: roles[i] })) };
}

async function getFile(userId, fileId) {
    const file = await loadVisibleFile(fileId, userId);
    const myRole = roleOf(file, userId);
    await hydrate(file, { createdBy: PERSON });
    return { file: { ...file, myRole } };
}

async function updateFile(userId, fileId, updates = {}) {
    const { file } = await loadFileForMember(fileId, userId);
    assertAccess(file, userId, 'edit');

    if (updates.name !== undefined) {
        if (typeof updates.name !== 'string' || !updates.name.trim()) throw httpErr(400, 'name must be a non-empty string');
        file.name = updates.name.trim().slice(0, 255);
    }
    if (updates.description !== undefined) {
        if (updates.description !== null && typeof updates.description !== 'string') throw httpErr(400, 'description must be a string');
        file.description = (updates.description || '').slice(0, 5000);
    }
    if (updates.folderId !== undefined) file.folderId = await resolveFolderId(updates.folderId, file.workspaceId, file._id);
    if (updates.tags !== undefined) file.tags = normaliseTags(updates.tags);
    file.updatedBy = userId;
    await file.save();
    return { file };
}

/** Snapshot the file's current content as version `file.currentVersion`. */
function snapshot(file, changeNote) {
    return FileVersion.create({
        fileId: file._id,
        versionNumber: file.currentVersion,
        url: file.url,
        gcsPath: file.gcsPath,
        size: file.size,
        mimeType: file.mimeType,
        // Whoever produced that content (older files: the owner).
        createdBy: file.updatedBy || file.createdBy,
        changeNote: changeNote || file.currentVersionNote || `Version ${file.currentVersion}`,
    });
}

async function createVersion(userId, fileId, multerFile, changeNote = '') {
    const { file } = await loadFileForMember(fileId, userId);
    assertAccess(file, userId, 'edit');
    if (changeNote && typeof changeNote !== 'string') throw httpErr(400, 'changeNote must be a string');

    // Upload first: a failed upload must not leave a stray snapshot behind.
    const gcsResult = await uploadStorage(multerFile, `workspaces/${file.workspaceId}/files/versions`, { userId });
    await snapshot(file);

    file.url = gcsResult.url;
    file.gcsPath = gcsResult.gcsPath;
    file.size = gcsResult.size;
    file.mimeType = gcsResult.mimeType;
    file.currentVersion += 1;
    file.updatedBy = userId;
    file.currentVersionNote = (changeNote || '').slice(0, 500);
    await file.save();

    return { file, version: file.currentVersion };
}

async function getVersions(userId, fileId) {
    const file = await loadVisibleFile(fileId, userId);

    const versions = await FileVersion.find({ fileId: file._id })
        .sort({ versionNumber: -1 })
        .lean();
    await hydrate(versions, { createdBy: PERSON });

    const current = {
        _id: null,
        fileId: file._id,
        versionNumber: file.currentVersion,
        url: file.url,
        size: file.size,
        mimeType: file.mimeType,
        createdBy: file.updatedBy || file.createdBy,
        changeNote: file.currentVersionNote || '',
        createdAt: file.updatedAt,
        isCurrent: true,
    };
    await hydrate(current, { createdBy: PERSON });

    return { versions, current, currentVersion: file.currentVersion };
}

async function restoreVersion(userId, fileId, versionId) {
    const { file } = await loadFileForMember(fileId, userId);
    assertAccess(file, userId, 'edit');

    const version = isId(versionId) ? await FileVersion.findById(versionId) : null;
    if (!version || String(version.fileId) !== String(file._id)) throw httpErr(404, 'Version not found');

    await snapshot(file);

    file.url = version.url;
    file.gcsPath = version.gcsPath;
    file.size = version.size;
    file.mimeType = version.mimeType;
    file.currentVersion += 1;
    file.updatedBy = userId;
    file.currentVersionNote = `Restored version ${version.versionNumber}`;
    await file.save();

    return { file, restoredFrom: version.versionNumber };
}

async function addComment(userId, fileId, content, parentId = null) {
    const file = await loadVisibleFile(fileId, userId);
    if (typeof content !== 'string' || !content.trim()) throw httpErr(400, 'Comment is empty');
    if (content.length > 5000) throw httpErr(400, 'Comment is too long (5000 characters max)');

    let parent = null;
    if (parentId) {
        parent = isId(parentId) ? await FileComment.findOne({ _id: parentId, fileId: file._id, isDeleted: false }).select('_id parentId').lean() : null;
        if (!parent) throw httpErr(400, 'Reply target not found');
    }

    const comment = await FileComment.create({
        fileId: file._id,
        workspaceId: file.workspaceId,
        author: userId,
        content: content.trim(),
        // Replies stay one level deep: a reply to a reply joins the thread root.
        parentId: parent ? (parent.parentId || parent._id) : null,
    });

    const commentOut = comment.toObject();
    await hydrate(commentOut, { author: PERSON });
    return { comment: commentOut };
}

async function getComments(userId, fileId) {
    const file = await loadVisibleFile(fileId, userId);
    const comments = await FileComment.find({ fileId: file._id, isDeleted: false })
        .sort({ createdAt: 1 })
        .lean();
    await hydrate(comments, { author: PERSON });
    return { comments };
}

async function loadComment(file, commentId) {
    const comment = isId(commentId) ? await FileComment.findOne({ _id: commentId, fileId: file._id, isDeleted: false }) : null;
    if (!comment) throw httpErr(404, 'Comment not found');
    return comment;
}

/** Author only. */
async function updateComment(userId, fileId, commentId, content) {
    const file = await loadVisibleFile(fileId, userId);
    const comment = await loadComment(file, commentId);
    if (String(comment.author) !== String(userId)) throw httpErr(403, 'Only the author can edit this comment');
    if (typeof content !== 'string' || !content.trim()) throw httpErr(400, 'Comment is empty');
    if (content.length > 5000) throw httpErr(400, 'Comment is too long (5000 characters max)');
    comment.content = content.trim();
    comment.editedAt = new Date();
    await comment.save();
    const out = comment.toObject();
    await hydrate(out, { author: PERSON });
    return { comment: out };
}

/** Author, file owner, or a workspace owner/admin. */
async function deleteComment(userId, fileId, commentId) {
    const { file, isAdmin } = await loadFileForMember(fileId, userId, { lean: true });
    const comment = await loadComment(file, commentId);
    const allowed = String(comment.author) === String(userId) || String(file.createdBy) === String(userId) || isAdmin;
    if (!allowed) throw httpErr(403, 'Not allowed to delete this comment');
    comment.isDeleted = true;
    await comment.save();
    return { message: 'Comment deleted', commentId: String(comment._id), fileId: String(file._id) };
}

/**
 * The owner (or a workspace owner/admin) sets per-user roles. Each entry is
 * { user, role } with role 'view' | 'download' | 'edit'; role null or 'none'
 * removes that user's grant (so does listing them in `remove`). Grants go only
 * to active workspace members. `access` ('workspace' | 'restricted') switches
 * whether the whole workspace or only the listed people can see the file.
 */
async function shareFile(userId, fileId, permissions = [], { access, remove } = {}) {
    const { file, workspace, isAdmin } = await loadFileForMember(fileId, userId);
    if (String(file.createdBy) !== String(userId) && !isAdmin) throw httpErr(403, 'Only file owner can share');
    if (permissions === undefined || permissions === null) permissions = [];
    if (!Array.isArray(permissions)) throw httpErr(400, 'permissions array required');
    if (remove !== undefined && (!Array.isArray(remove) || remove.some(u => !isId(u?._id || u)))) {
        throw httpErr(400, 'remove must be an array of user ids');
    }
    if (access !== undefined && !['workspace', 'restricted'].includes(access)) {
        throw httpErr(400, "access must be 'workspace' or 'restricted'");
    }
    permissions = [...permissions, ...(remove || []).map(u => ({ user: u, role: null }))];

    const active = new Set((workspace.members || [])
        .filter(m => (m.status || 'active') === 'active')
        .map(m => String(m.user?._id || m.user)));
    const entries = permissions.map((entry) => {
        const user = entry && String(entry.user?._id || entry.user || '');
        if (!user || !isId(user)) throw httpErr(400, 'Each permission needs a valid user id');
        const role = entry.role === undefined ? 'view' : entry.role;
        const revoke = role === null || role === 'none';
        if (!revoke && !(role in ROLE_RANK)) throw httpErr(400, `Invalid role: ${role}`);
        if (!revoke && !active.has(user)) throw httpErr(400, 'Files can only be shared with active members of this workspace');
        return { user, role, revoke };
    });

    for (const { user, role, revoke } of entries) {
        if (user === String(file.createdBy)) continue;
        const idx = file.permissions.findIndex(p => String(p.user) === user);
        if (revoke) {
            if (idx >= 0) file.permissions.splice(idx, 1);
        } else if (idx >= 0) {
            file.permissions[idx].role = role;
        } else {
            file.permissions.push({ user, role });
        }
    }
    if (access !== undefined) file.access = access;
    await file.save();
    return { file };
}

/**
 * A short-lived URL to download the current content (or one version) of a
 * file. Restricted files need the download or edit role; workspace files are
 * downloadable by every member who can see them.
 */
async function getDownloadUrl(userId, fileId, { versionId } = {}) {
    const { file } = await loadFileForMember(fileId, userId, { lean: true });
    if (isRestricted(file)) assertAccess(file, userId, 'download');
    let target = file;
    if (versionId) {
        const version = isId(versionId) ? await FileVersion.findById(versionId).lean() : null;
        if (!version || String(version.fileId) !== String(file._id)) throw httpErr(404, 'Version not found');
        target = version;
    }
    if (String(target.gcsPath || '').startsWith('local/')) {
        return { url: target.url, name: file.name, mimeType: target.mimeType, expiresAt: null };
    }
    const { signMediaPath } = require('../../modules/uploads/mediaSignature');
    const signed = signMediaPath(target.gcsPath, userId);
    return { url: signed.url, name: file.name, mimeType: target.mimeType, expiresAt: signed.expiresAt };
}

/**
 * Read check for a stored object that belongs to the file library (current
 * content or a version), used by /api/v2/uploads/file. Returns null when the
 * object is not a library file, else true/false. Restricted files follow
 * their permissions (any grant may preview); others: active members.
 */
async function canReadLibraryObject(gcsPath, userId) {
    let file = await WorkspaceFile.findOne({ gcsPath }).select('workspaceId createdBy permissions access isDeleted').lean();
    if (!file) {
        const version = await FileVersion.findOne({ gcsPath }).select('fileId').lean();
        if (version) file = await WorkspaceFile.findById(version.fileId).select('workspaceId createdBy permissions access isDeleted').lean();
    }
    if (!file) return null;
    try {
        const { isAdmin } = await assertWorkspaceMember(file.workspaceId, userId);
        return canSee(file, userId, isAdmin);
    } catch {
        return false;
    }
}

async function tagFile(userId, fileId, tags) {
    const { file } = await loadFileForMember(fileId, userId);
    assertAccess(file, userId, 'edit');
    file.tags = normaliseTags(tags);
    file.updatedBy = userId;
    await file.save();
    return { file };
}

/** All tags in use in a workspace, with counts (for tag pickers). */
async function getTags(userId, workspaceId) {
    await assertWorkspaceMember(workspaceId, userId);
    const rows = await WorkspaceFile.aggregate([
        { $match: { workspaceId: new mongoose.Types.ObjectId(String(workspaceId)), isDeleted: false } },
        { $unwind: '$tags' },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
    ]);
    return { tags: rows.map(r => ({ tag: r._id, count: r.count })) };
}

async function deleteFile(userId, fileId) {
    const { file, isAdmin } = await loadFileForMember(fileId, userId);
    if (String(file.createdBy) !== String(userId) && !isAdmin) throw httpErr(403, 'Only file owner can delete');
    file.isDeleted = true;
    await file.save();
    return { message: 'File deleted', file };
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
    updateComment,
    deleteComment,
    shareFile,
    getDownloadUrl,
    canReadLibraryObject,
    tagFile,
    getTags,
    deleteFile,
    // shared with other features (e.g. design reviews) and tests
    loadVisibleFile,
    loadFileForMember,
    assertAccess,
    roleOf,
    normaliseTags,
};
