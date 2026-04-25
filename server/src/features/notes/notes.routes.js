const express = require('express');
const router = express.Router();
const notesController = require('./notes.controller');
const requireAuth = require('../../shared/middleware/auth');

router.use(requireAuth);

router.get('/', notesController.getNotes);

router.post('/', notesController.createNote);

router.put('/:id', notesController.updateNote);

router.delete('/:id', notesController.deleteNote);

router.post('/:id/share', notesController.shareNote);

router.post('/:id/attachments', notesController.addAttachment);

router.delete('/:id/attachments/:attachmentId', notesController.removeAttachment);

router.get('/:id/versions', notesController.getVersions);

router.post('/:id/versions', notesController.saveVersion);

router.get('/:id/attachments/:attachmentId/download', notesController.downloadAttachment);

module.exports = router;
