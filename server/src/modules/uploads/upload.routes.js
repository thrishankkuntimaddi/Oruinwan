/**
 * upload.routes.js — Phase 7.1 Attachments
 * Mounted at: /api/v2/uploads
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const { upload, uploadFile } = require('./upload.controller');

// POST /api/v2/uploads
// Auth required — prevents anonymous uploads to the GCS bucket
router.post('/', requireAuth, upload.single('file'), uploadFile);

module.exports = router;
