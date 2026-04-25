const notesService = require('./notes.service');
const validator = require('./notes.validator');
const activityService = require('../activity/activity.service');

function handleError(res, error) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';

    const response = { message };
    if (error.errors) {
        response.errors = error.errors;
    }

    return res.status(statusCode).json(response);
}

async function getNotes(req, res) {
    try {
        const userId = req.user.sub;
        const filters = {
            workspaceId: req.query.workspaceId,
            type: req.query.type
        };

        const result = await notesService.getNotes(userId, filters);
        return res.json(result);
    } catch (error) {
        console.error('GET_NOTES ERROR:', error);
        return handleError(res, error);
    }
}

async function createNote(req, res) {
    try {
        const userId = req.user.sub;
        const noteData = req.body;

        
        const validation = validator.validateCreateNote(noteData);
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await notesService.createNote(userId, noteData, req.io, req);

        
        activityService.emit(req, {
            type: 'note',
            subtype: 'created',
            actor: userId,
            workspaceId: noteData.workspaceId || null,
            payload: { noteId: result.note?._id || result._id, title: noteData.title },
        }).catch(() => {});

        return res.status(201).json(result);
    } catch (error) {
        console.error('CREATE_NOTE ERROR:', error);
        return handleError(res, error);
    }
}

async function updateNote(req, res) {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const updates = req.body;

        
        const validation = validator.validateUpdateNote(updates);
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await notesService.updateNote(userId, noteId, updates, req.io, req);

        
        activityService.emit(req, {
            type: 'note',
            subtype: 'updated',
            actor: userId,
            workspaceId: updates.workspaceId || null,
            payload: { noteId, title: updates.title },
        }).catch(() => {});

        return res.json(result);
    } catch (error) {
        console.error('UPDATE_NOTE ERROR:', error);
        return handleError(res, error);
    }
}

async function deleteNote(req, res) {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const permanent = req.query.permanent === 'true';

        const result = await notesService.deleteNote(userId, noteId, permanent, req.io, req);
        return res.json(result);
    } catch (error) {
        console.error('DELETE_NOTE ERROR:', error);
        return handleError(res, error);
    }
}

async function shareNote(req, res) {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const { userIds } = req.body;

        
        const validation = validator.validateShareNote({ userIds });
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await notesService.shareNote(userId, noteId, userIds, req.io, req);
        return res.json(result);
    } catch (error) {
        console.error('SHARE_NOTE ERROR:', error);
        return handleError(res, error);
    }
}

async function addAttachment(req, res) {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const attachmentData = req.body;

        
        const validation = validator.validateAttachment(attachmentData);
        if (!validation.valid) {
            const error = new Error('Validation failed');
            error.statusCode = 400;
            error.errors = validation.errors;
            throw error;
        }

        const result = await notesService.addAttachment(userId, noteId, attachmentData, req.io, req);
        return res.json(result);
    } catch (error) {
        console.error('ADD_ATTACHMENT ERROR:', error);
        return handleError(res, error);
    }
}

async function removeAttachment(req, res) {
    try {
        const userId = req.user.sub;
        const { id: noteId, attachmentId } = req.params;

        const result = await notesService.removeAttachment(userId, noteId, attachmentId, req);
        return res.json(result);
    } catch (error) {
        console.error('REMOVE_ATTACHMENT ERROR:', error);
        return handleError(res, error);
    }
}

async function downloadAttachment(req, res) {
    try {
        const userId = req.user.sub;
        const { id: noteId, attachmentId } = req.params;

        const { filePath, fileName } = await notesService.downloadAttachment(userId, noteId, attachmentId);

        
        res.download(filePath, fileName);
    } catch (error) {
        console.error('DOWNLOAD_ATTACHMENT ERROR:', error);
        return handleError(res, error);
    }
}

async function getVersions(req, res) {
    try {
        const userId = req.user.sub;
        const { id: noteId } = req.params;
        const result = await notesService.getVersions(userId, noteId);
        return res.json(result);
    } catch (error) {
        console.error('GET_VERSIONS ERROR:', error);
        return handleError(res, error);
    }
}

async function saveVersion(req, res) {
    try {
        const userId = req.user.sub;
        const { id: noteId } = req.params;
        const { title, content } = req.body;
        const result = await notesService.saveVersion(userId, noteId, { title, content });
        return res.status(201).json(result);
    } catch (error) {
        console.error('SAVE_VERSION ERROR:', error);
        return handleError(res, error);
    }
}

module.exports = {
    getNotes,
    createNote,
    updateNote,
    deleteNote,
    shareNote,
    addAttachment,
    removeAttachment,
    downloadAttachment,
    getVersions,
    saveVersion,
};
