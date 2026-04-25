const express = require('express');
const router = express.Router();
const uploadController = require('./upload.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.post('/note-attachment', uploadController.uploadNoteAttachment);

router.delete('/note-attachment', uploadController.deleteAttachment);

module.exports = router;
