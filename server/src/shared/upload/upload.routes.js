// server/routes/upload.js
const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const requireAuth = require('../../../middleware/auth');

// All routes require authentication
router.use(requireAuth);

/**
 * @route   POST /api/upload/note-attachment
 * @desc    Upload a file for note attachment
 * @access  Private
 */
router.post('/note-attachment', uploadController.uploadNoteAttachment);

/**
 * @route   DELETE /api/upload/note-attachment
 * @desc    Delete an uploaded file from GCS
 * @query   gcsPath — the GCS object path returned at upload time
 * @access  Private
 */
router.delete('/note-attachment', uploadController.deleteAttachment);

module.exports = router;
