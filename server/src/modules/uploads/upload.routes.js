/**
 * upload.routes.js — Phase 7.1 Attachments
 * Mounted at: /api/v2/uploads
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const { upload, uploadFile } = require('./upload.controller');
const { streamGCSFile } = require('./upload.service');

// POST /api/v2/uploads
// Auth required — prevents anonymous uploads to the GCS bucket
router.post('/', requireAuth, upload.single('file'), uploadFile);

// GET /api/v2/uploads/file?path=<gcsPath>
// Authenticated proxy: streams a private GCS object directly to the client.
// Bucket has Uniform Bucket-Level Access — no per-object public URLs.
router.get('/file', requireAuth, async (req, res) => {
    try {
        const { path: gcsPath } = req.query;
        if (!gcsPath) {
            return res.status(400).json({ error: 'Missing path query param' });
        }
        // Basic path traversal guard — only allow alphanumeric, '-', '/', '_', '.'
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
