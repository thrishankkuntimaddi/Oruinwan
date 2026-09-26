const logger = require('../../../utils/logger');
const { requireWorkspaceFeature, resolvers } = require('../../shared/workspaceFeatures');
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const { upload, uploadFile } = require('./upload.controller');
const { streamGCSFile, objectHandle } = require('./upload.service');
const { canAccessFile } = require('./upload.access');
const { signMediaPath, verifyMediaSignature } = require('./mediaSignature');

// The conversation is in the multipart body, so the feature check runs after multer.
router.post('/', requireAuth, upload.single('file'), requireWorkspaceFeature('fileUploads', resolvers.fromUploadConversation), uploadFile);

function validObjectPath(p) {
    return typeof p === 'string' && /^[a-zA-Z0-9/_.\-]+$/.test(p) && !p.includes('..');
}

// Signed URL for one file, after the same access check a direct read gets.
router.get('/sign', requireAuth, async (req, res) => {
    try {
        const { path: objectPath } = req.query;
        if (!validObjectPath(objectPath)) return res.status(400).json({ error: 'Invalid path' });
        const [metadata] = await objectHandle(objectPath).getMetadata();
        const allowed = await canAccessFile(objectPath, req.user.sub, metadata.metadata || {});
        if (!allowed) return res.status(403).json({ error: 'Access denied' });
        return res.json(signMediaPath(objectPath, req.user.sub));
    } catch (err) {
        if (err.code === 404) return res.status(404).json({ error: 'File not found' });
        logger.error({ err }, '[UploadRoutes] /sign error');
        return res.status(500).json({ error: 'Failed to sign file URL' });
    }
});

// A valid signature stands in for the Authorization header (media elements cannot send one).
function authOrSignature(req, res, next) {
    if (req.query.sig) {
        const userId = verifyMediaSignature(req.query);
        if (!userId || req.query.path == null) return res.status(403).json({ error: 'Invalid or expired link' });
        req.user = { sub: userId };
        req.mediaSigned = true;
        return next();
    }
    return requireAuth(req, res, next);
}

router.get('/file', authOrSignature, async (req, res) => {
    try {
        const { path: gcsPath } = req.query;
        if (!gcsPath) {
            return res.status(400).json({ error: 'Missing path query param' });
        }
        if (!validObjectPath(gcsPath)) {
            return res.status(400).json({ error: 'Invalid path' });
        }
        await streamGCSFile(gcsPath, req, res, {
            // Signed links were access-checked when issued; re-check anyway so a
            // user removed from the conversation loses access immediately.
            authorize: (objectMeta) => canAccessFile(gcsPath, req.user.sub, objectMeta),
        });
    } catch (err) {
        logger.error({ err }, '[UploadRoutes] /file error');
        if (!res.headersSent) {
            return res.status(err.code === 404 ? 404 : 500).json({ error: err.code === 404 ? 'File not found' : 'Failed to load file' });
        }
        res.destroy();
    }
});

module.exports = router;
