const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const { upload, uploadFile } = require('./upload.controller');
const { streamGCSFile } = require('./upload.service');

router.post('/', requireAuth, upload.single('file'), uploadFile);

router.get('/file', requireAuth, async (req, res) => {
    try {
        const { path: gcsPath } = req.query;
        if (!gcsPath) {
            return res.status(400).json({ error: 'Missing path query param' });
        }
        
        if (!/^[a-zA-Z0-9/_.\-]+$/.test(gcsPath)) {
            return res.status(400).json({ error: 'Invalid path' });
        }
        await streamGCSFile(gcsPath, req, res);
    } catch (err) {
        console.error('[UploadRoutes] /file error:', err);
        if (!res.headersSent) {
            return res.status(err.code === 404 ? 404 : 500).json({ error: err.message || 'File not found' });
        }
    }
});

module.exports = router;
