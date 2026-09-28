const logger = require('../../../utils/logger');
const notesService = require('./notes.service');
const validator = require('./notes.validator');
const activityService = require('../activity/activity.service');
const { sendError } = require('../../shared/utils/httpError');

function handleError(res, error) {
    if (error && (error.name === 'CastError' || error.name === 'ValidationError')) {
        return res.status(400).json({ message: error.name === 'CastError' ? 'Invalid id' : error.message });
    }
    const statusCode = Number(error.statusCode || error.status) || 500;
    if (statusCode >= 500) return sendError(res, error, { status: 500 });

    const response = { message: error.message || 'Request failed' };
    if (error.code) response.code = error.code;
    if (error.errors) response.errors = error.errors;
    return res.status(statusCode).json(response);
}

function validationError(errors) {
    const error = new Error(`Validation failed: ${errors.join('; ')}`);
    error.statusCode = 400;
    error.errors = errors;
    return error;
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
        logger.error('GET_NOTES ERROR:', error);
        return handleError(res, error);
    }
}

async function getNote(req, res) {
    try {
        const result = await notesService.getNote(req.user.sub, req.params.id);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function createNote(req, res) {
    try {
        const userId = req.user.sub;
        const noteData = req.body || {};

        
        const validation = validator.validateCreateNote(noteData);
        if (!validation.valid) {
            throw validationError(validation.errors);
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
        logger.error('CREATE_NOTE ERROR:', error);
        return handleError(res, error);
    }
}

async function updateNote(req, res) {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const updates = req.body || {};

        
        const validation = validator.validateUpdateNote(updates);
        if (!validation.valid) {
            throw validationError(validation.errors);
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
        logger.error('UPDATE_NOTE ERROR:', error);
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
        logger.error('DELETE_NOTE ERROR:', error);
        return handleError(res, error);
    }
}

async function shareNote(req, res) {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const { userIds, allowEditing } = req.body || {};

        const validation = validator.validateShareNote({ userIds, allowEditing });
        if (!validation.valid) {
            throw validationError(validation.errors);
        }

        const result = await notesService.shareNote(userId, noteId, userIds, req.io, req, { allowEditing });
        return res.json(result);
    } catch (error) {
        logger.error('SHARE_NOTE ERROR:', error);
        return handleError(res, error);
    }
}

async function addAttachment(req, res) {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const attachmentData = req.body || {};

        
        const validation = validator.validateAttachment(attachmentData);
        if (!validation.valid) {
            throw validationError(validation.errors);
        }

        const result = await notesService.addAttachment(userId, noteId, attachmentData, req.io, req);
        return res.json(result);
    } catch (error) {
        logger.error('ADD_ATTACHMENT ERROR:', error);
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
        logger.error('REMOVE_ATTACHMENT ERROR:', error);
        return handleError(res, error);
    }
}

async function downloadAttachment(req, res) {
    try {
        const userId = req.user.sub;
        const { id: noteId, attachmentId } = req.params;

        const { objectPath } = await notesService.downloadAttachment(userId, noteId, attachmentId);
        const { streamGCSFile } = require('../../modules/uploads/upload.service');
        try {
            await streamGCSFile(objectPath, req, res);
        } catch (streamErr) {
            if (streamErr && (streamErr.code === 404 || streamErr.code === 400)) {
                if (!res.headersSent) return res.status(404).json({ message: 'Attachment file not found' });
                return undefined;
            }
            throw streamErr;
        }
    } catch (error) {
        logger.error('DOWNLOAD_ATTACHMENT ERROR:', error);
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
        logger.error('GET_VERSIONS ERROR:', error);
        return handleError(res, error);
    }
}

async function saveVersion(req, res) {
    try {
        const userId = req.user.sub;
        const { id: noteId } = req.params;
        const { title, content } = req.body || {};
        const result = await notesService.saveVersion(userId, noteId, { title, content });
        return res.status(201).json(result);
    } catch (error) {
        logger.error('SAVE_VERSION ERROR:', error);
        return handleError(res, error);
    }
}

module.exports = {
    getNotes,
    getNote,
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
