const filesService = require('./files.service');
const logger = require('../../../utils/logger');
// Same upload rules as chat attachments: 100 MB, programs refused, UTF-8 file names,
// and clear 413/415 answers instead of a 500.
const { upload } = require('../../modules/uploads/upload.controller');

function handleError(res, err) {
    let status = err.statusCode || 500;
    if (status === 500 && (err.name === 'CastError' || err.name === 'ValidationError')) status = 400;
    if (status >= 500) logger.error({ err }, '[files] request failed');
    return res.status(status).json({ message: status >= 500 ? 'Internal server error' : (err.message || 'Bad request') });
}

/** Tags from a multipart field: a JSON array, a comma list, or repeated fields. */
function parseTags(tags) {
    if (tags === undefined || tags === null || tags === '') return [];
    if (Array.isArray(tags)) return tags;
    const s = String(tags).trim();
    if (s.startsWith('[')) {
        try {
            const parsed = JSON.parse(s);
            if (Array.isArray(parsed)) return parsed;
        } catch { /* fall through to the comma list */ }
        throw Object.assign(new Error('tags must be a JSON array or a comma-separated list'), { statusCode: 400 });
    }
    return s.split(',');
}

/** Tell everyone looking at the library (workspace room) and at this file (file room). */
function emitFileEvent(req, event, file, extra = {}) {
    if (!req.io || !file) return;
    const rooms = [`workspace:${file.workspaceId}`, `file:${file._id}`];
    req.io.to(rooms).emit(event, { file, ...extra });
}

const uploadFile = [
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No file provided' });
            const { workspaceId, description, folderId, tags } = req.body;
            if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
            const file = await filesService.uploadFile(req.user.sub, workspaceId, req.file, { description, folderId, tags: parseTags(tags), io: req.io });

            if (req.io) req.io.to(`workspace:${workspaceId}`).emit('file:uploaded', { file });
            return res.status(201).json({ file });
        } catch (err) { return handleError(res, err); }
    },
];

async function getFiles(req, res) {
    try {
        const { workspaceId, folderId, tags, search } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await filesService.getFiles(req.user.sub, workspaceId, { folderId, tags, search });
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function getSharedFiles(req, res) {
    try {
        const { workspaceId, kind, source, conversationId, sharedBy, q, sort, limit, offset } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await require('./sharedFiles.service').listSharedFiles(
            req.user.sub, workspaceId,
            { kind, source, conversationId, sharedBy, q, sort, limit, offset },
            { assertWorkspaceMember: filesService.assertWorkspaceMember },
        );
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function getTags(req, res) {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        return res.json(await filesService.getTags(req.user.sub, workspaceId));
    } catch (err) { return handleError(res, err); }
}

async function getFile(req, res) {
    try {
        const result = await filesService.getFile(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function updateFile(req, res) {
    try {
        const result = await filesService.updateFile(req.user.sub, req.params.id, req.body || {});
        emitFileEvent(req, 'file:updated', result.file);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function deleteFile(req, res) {
    try {
        const { message, file } = await filesService.deleteFile(req.user.sub, req.params.id);
        if (req.io) req.io.to([`workspace:${file.workspaceId}`, `file:${file._id}`]).emit('file:deleted', { fileId: String(file._id) });
        return res.json({ message });
    } catch (err) { return handleError(res, err); }
}

const createVersion = [
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No file provided' });
            const { changeNote } = req.body;
            const result = await filesService.createVersion(req.user.sub, req.params.id, req.file, changeNote);
            emitFileEvent(req, 'file:updated', result.file, { reason: 'version' });
            return res.status(201).json(result);
        } catch (err) { return handleError(res, err); }
    },
];

async function getVersions(req, res) {
    try {
        const result = await filesService.getVersions(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function restoreVersion(req, res) {
    try {
        const result = await filesService.restoreVersion(req.user.sub, req.params.id, req.params.vId);
        emitFileEvent(req, 'file:updated', result.file, { reason: 'restore' });
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function getComments(req, res) {
    try {
        const result = await filesService.getComments(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function addComment(req, res) {
    try {
        const { content, parentId } = req.body || {};
        if (!content) return res.status(400).json({ message: 'content is required' });
        const result = await filesService.addComment(req.user.sub, req.params.id, content, parentId);

        if (req.io) req.io.to(`file:${req.params.id}`).emit('file:comment', { comment: result.comment });
        return res.status(201).json(result);
    } catch (err) { return handleError(res, err); }
}

async function updateComment(req, res) {
    try {
        const result = await filesService.updateComment(req.user.sub, req.params.id, req.params.commentId, (req.body || {}).content);
        if (req.io) req.io.to(`file:${req.params.id}`).emit('file:comment_updated', { comment: result.comment });
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function deleteComment(req, res) {
    try {
        const result = await filesService.deleteComment(req.user.sub, req.params.id, req.params.commentId);
        if (req.io) req.io.to(`file:${req.params.id}`).emit('file:comment_deleted', { fileId: result.fileId, commentId: result.commentId });
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function shareFile(req, res) {
    try {
        const { permissions, access, remove } = req.body || {};
        if (permissions !== undefined && !Array.isArray(permissions)) return res.status(400).json({ message: 'permissions array required' });
        if (permissions === undefined && access === undefined && remove === undefined) {
            return res.status(400).json({ message: 'permissions, remove or access required' });
        }
        const result = await filesService.shareFile(req.user.sub, req.params.id, permissions || [], { access, remove });
        emitFileEvent(req, 'file:updated', result.file, { reason: 'share' });
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function getDownload(req, res) {
    try {
        return res.json(await filesService.getDownloadUrl(req.user.sub, req.params.id, { versionId: req.query.versionId }));
    } catch (err) { return handleError(res, err); }
}

async function updateTags(req, res) {
    try {
        const { tags } = req.body || {};
        if (!Array.isArray(tags)) return res.status(400).json({ message: 'tags array required' });
        const result = await filesService.tagFile(req.user.sub, req.params.id, tags);
        emitFileEvent(req, 'file:updated', result.file, { reason: 'tags' });
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

module.exports = {
    uploadFile, getFiles, getSharedFiles, getTags, getFile, updateFile, deleteFile, createVersion, getVersions, restoreVersion,
    getComments, addComment, updateComment, deleteComment, shareFile, updateTags, getDownload,
    _parseTags: parseTags,
};
