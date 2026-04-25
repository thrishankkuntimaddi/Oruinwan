const filesService = require('./files.service');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

function handleError(res, err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ message: err.message || 'Internal server error' });
}

const uploadFile = [
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No file provided' });
            const { workspaceId, description, folderId, tags } = req.body;
            if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
            const parsedTags = tags ? (Array.isArray(tags) ? tags : JSON.parse(tags)) : [];
            const file = await filesService.uploadFile(req.user.sub, workspaceId, req.file, { description, folderId, tags: parsedTags });
            
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

async function getFile(req, res) {
    try {
        const result = await filesService.getFile(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function updateFile(req, res) {
    try {
        const result = await filesService.updateFile(req.user.sub, req.params.id, req.body);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function deleteFile(req, res) {
    try {
        const result = await filesService.deleteFile(req.user.sub, req.params.id);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

const createVersion = [
    upload.single('file'),
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No file provided' });
            const { changeNote } = req.body;
            const result = await filesService.createVersion(req.user.sub, req.params.id, req.file, changeNote);
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
        const { content, parentId } = req.body;
        if (!content) return res.status(400).json({ message: 'content is required' });
        const result = await filesService.addComment(req.user.sub, req.params.id, content, parentId);
        
        if (req.io) req.io.to(`file:${req.params.id}`).emit('file:comment', { comment: result.comment });
        return res.status(201).json(result);
    } catch (err) { return handleError(res, err); }
}

async function shareFile(req, res) {
    try {
        const { permissions } = req.body;
        if (!Array.isArray(permissions)) return res.status(400).json({ message: 'permissions array required' });
        const result = await filesService.shareFile(req.user.sub, req.params.id, permissions);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

async function updateTags(req, res) {
    try {
        const { tags } = req.body;
        if (!Array.isArray(tags)) return res.status(400).json({ message: 'tags array required' });
        const result = await filesService.tagFile(req.user.sub, req.params.id, tags);
        return res.json(result);
    } catch (err) { return handleError(res, err); }
}

module.exports = { uploadFile, getFiles, getFile, updateFile, deleteFile, createVersion, getVersions, restoreVersion, getComments, addComment, shareFile, updateTags };
