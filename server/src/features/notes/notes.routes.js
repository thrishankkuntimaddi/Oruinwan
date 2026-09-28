const express = require('express');
const { requireWorkspaceFeature } = require('../../shared/workspaceFeatures');
const router = express.Router();
const notesController = require('./notes.controller');
const requireAuth = require('../../shared/middleware/auth');
const { isValidId } = require('../../shared/utils/workspaceAccess');

router.use(requireAuth);

// Malformed ids are a client error, never a 500.
router.param('id', (req, res, next, id) => (isValidId(id) ? next() : res.status(400).json({ message: 'Invalid note id' })));
router.param('attachmentId', (req, res, next, id) => (isValidId(id) ? next() : res.status(400).json({ message: 'Invalid attachment id' })));

function validWorkspaceQuery(req, res, next) {
    const ws = req.query.workspaceId;
    if (ws !== undefined && ws !== '' && !isValidId(ws)) return res.status(400).json({ message: 'Invalid workspaceId' });
    return next();
}

router.get('/', validWorkspaceQuery, notesController.getNotes);

router.post('/', (req, res, next) => {
    const ws = req.body?.workspaceId;
    if (!ws) return res.status(400).json({ message: 'Workspace ID is required' });
    if (!isValidId(ws)) return res.status(400).json({ message: 'Invalid workspaceId' });
    return next();
}, requireWorkspaceFeature('notes'), notesController.createNote);

router.get('/:id', notesController.getNote);

router.put('/:id', notesController.updateNote);

// ?permanent=true -> owner permanently deletes; otherwise the note is archived.
router.delete('/:id', notesController.deleteNote);

// Body: { userIds: string[], allowEditing?: boolean }
router.post('/:id/share', notesController.shareNote);

router.post('/:id/attachments', notesController.addAttachment);

router.delete('/:id/attachments/:attachmentId', notesController.removeAttachment);

router.get('/:id/versions', notesController.getVersions);

router.post('/:id/versions', notesController.saveVersion);

router.get('/:id/attachments/:attachmentId/download', notesController.downloadAttachment);

module.exports = router;
