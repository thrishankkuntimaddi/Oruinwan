const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const ctrl = require('./files.controller');

router.use(requireAuth);

router.post('/', ...ctrl.uploadFile);
router.get('/', ctrl.getFiles);
router.get('/tags', ctrl.getTags);
// Everything the caller can open in the workspace: chat attachments + library files.
router.get('/shared', ctrl.getSharedFiles);
router.get('/:id', ctrl.getFile);
router.get('/:id/download', ctrl.getDownload);
router.patch('/:id', ctrl.updateFile);
router.delete('/:id', ctrl.deleteFile);
router.get('/:id/versions', ctrl.getVersions);
router.post('/:id/versions', ...ctrl.createVersion);
router.post('/:id/versions/:vId/restore', ctrl.restoreVersion);
router.get('/:id/comments', ctrl.getComments);
router.post('/:id/comments', ctrl.addComment);
router.patch('/:id/comments/:commentId', ctrl.updateComment);
router.delete('/:id/comments/:commentId', ctrl.deleteComment);
router.post('/:id/share', ctrl.shareFile);
router.patch('/:id/tags', ctrl.updateTags);

module.exports = router;
