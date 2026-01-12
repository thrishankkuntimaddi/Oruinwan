// server/routes/upload.js
const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const requireAuth = require('../middleware/auth');

// All routes require authentication
router.use(requireAuth);

/**
 * @route   POST /api/upload/note-attachment
 * @desc    Upload a file for note attachment
 * @access  Private
 */
router.post('/note-attachment', uploadController.uploadNoteAttachment);

/**
 * @route   DELETE /api/upload/note-attachment/:filename
 * @desc    Delete an uploaded file
 * @access  Private
 */
router.delete('/note-attachment/:filename', uploadController.deleteAttachment);

module.exports = router;
