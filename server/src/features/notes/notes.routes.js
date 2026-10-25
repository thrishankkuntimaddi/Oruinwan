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

// Note reminders (before /:id so "reminders" isn't read as a note id).
const reminders = require('./noteReminders');
const replyWith = (fn) => async (req, res) => {
    try {
        res.json(await fn(req));
    } catch (err) {
        res.status(err.status || err.statusCode || 500).json({ message: err.status || err.statusCode ? err.message : 'Server error' });
    }
};
router.get('/reminders', validWorkspaceQuery, replyWith((req) => reminders.list(req.user.sub, req.query.workspaceId).then((list) => ({ reminders: list }))));
router.delete('/reminders/:reminderId', replyWith((req) => reminders.cancel(req.user.sub, req.params.reminderId)));
router.post('/:id/remind', replyWith((req) => reminders.remind(req.user.sub, req.params.id, req.body).then((reminder) => ({ reminder }))));

router.post('/', (req, res, next) => {
    const ws = req.body?.workspaceId;
    if (!ws) return res.status(400).json({ message: 'Workspace ID is required' });
    if (!isValidId(ws)) return res.status(400).json({ message: 'Invalid workspaceId' });
    return next();
}, requireWorkspaceFeature('notes'), require('../../shared/plans/planGuards').noteCreate, notesController.createNote);

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
