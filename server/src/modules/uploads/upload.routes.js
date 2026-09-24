const logger = require('../../../utils/logger');
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const { upload, uploadFile } = require('./upload.controller');
const { streamGCSFile } = require('./upload.service');
const { canAccessFile } = require('./upload.access');

router.post('/', requireAuth, upload.single('file'), uploadFile);

router.get('/file', requireAuth, async (req, res) => {
    try {
        const { path: gcsPath } = req.query;
        if (!gcsPath) {
            return res.status(400).json({ error: 'Missing path query param' });
        }
        
        if (typeof gcsPath !== 'string' || !/^[a-zA-Z0-9/_.\-]+$/.test(gcsPath) || gcsPath.includes('..')) {
            return res.status(400).json({ error: 'Invalid path' });
        }
        await streamGCSFile(gcsPath, req, res, {
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
