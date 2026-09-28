const logger = require('../../../utils/logger');
const { sendError } = require('../utils/httpError');
const { uploadNoteAttachment, getFileCategory, validateFileSize, FILE_SIZE_LIMITS } = require('../../../config/multer.config');
const { uploadToGCS, streamGCSFile, BUCKET_NAME } = require('../../modules/uploads/upload.service');
const { Storage } = require('@google-cloud/storage');
const Note = require('../../../models/Note');
const { assertWorkspaceMember, sendAccessError, isValidId } = require('../utils/workspaceAccess');

exports.uploadNoteAttachment = async (req, res) => {
    try {
        
        uploadNoteAttachment.single('file')(req, res, async (err) => {
          try {
            if (err) {
                // Multer/validation errors are client errors with user-safe messages.
                return sendError(res, err, { status: 400, message: err.message || 'File upload failed' });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const { workspaceId, noteId } = req.body;
            const userId = req.user.sub;

            if (!workspaceId) {
                return res.status(400).json({ message: 'Workspace ID required' });
            }

            let workspace;
            try {
                ({ workspace } = await assertWorkspaceMember(workspaceId, userId));
            } catch (accessErr) {
                return sendAccessError(res, accessErr);
            }

            
            if (!validateFileSize(req.file)) {
                const category = getFileCategory(req.file.mimetype);
                const categoryKey = category === 'images' ? 'image' :
                    category === 'videos' ? 'video' :
                        category === 'audio' ? 'audio' : 'document';
                const limitMB = Math.round(FILE_SIZE_LIMITS[categoryKey] / (1024 * 1024));
                return res.status(400).json({
                    message: `File size exceeds limit of ${limitMB}MB for ${categoryKey} files`
                });
            }

            
            const gcsFolder = `notes/${workspaceId}`;
            const gcsAttachment = await uploadToGCS(req.file, gcsFolder, { userId, companyId: workspace.company || undefined });

            const category = getFileCategory(req.file.mimetype);
            const categoryKey = category === 'images' ? 'image' :
                category === 'videos' ? 'video' :
                    category === 'audio' ? 'audio' : 'document';

            const attachmentData = {
                name: req.file.originalname,
                url: gcsAttachment.url,          
                type: req.file.mimetype,
                size: req.file.size,
                category: categoryKey,
                uploadedBy: userId,
                uploadedAt: new Date()
            };

            
            if (noteId) {
                if (!isValidId(noteId)) return res.status(400).json({ message: 'Invalid note id' });
                const note = await Note.findById(noteId);
                // The note must live in the workspace the file was uploaded to.
                if (!note || String(note.workspace) !== String(workspaceId)) {
                    return res.status(404).json({ message: 'Note not found' });
                }
                if (!note.canEdit(userId, { isWorkspaceMember: true })) {
                    return res.status(403).json({ message: 'Not authorized to edit this note' });
                }

                note.attachments.push(attachmentData);
                await note.save();

                require('../../features/notes/notes.notifications')
                    .notifyAttachmentAdded(note._id, note.attachments[note.attachments.length - 1], note, req.io);
            }

            return res.status(200).json({
                message: 'File uploaded successfully',
                url: gcsAttachment.url,
                originalName: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype,
                category: categoryKey,
                attachment: attachmentData
            });
          } catch (innerErr) {
            // Errors inside the multer callback are not caught by the outer try.
            return sendError(res, innerErr, { status: 500 });
          }
        });

    } catch (err) {
        return sendError(res, err, { status: 500 });
    }
};

exports.deleteAttachment = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { gcsPath } = req.query;

        if (!gcsPath) {
            return res.status(400).json({ message: 'gcsPath query parameter required' });
        }

        
        if (!/^[a-zA-Z0-9/_.\-]+$/.test(gcsPath)) {
            return res.status(400).json({ message: 'Invalid gcsPath' });
        }

        
        
        
        const proxyUrl = `/api/v2/uploads/file?path=${encodeURIComponent(gcsPath)}`;
        const notes = await Note.find({ 'attachments.url': proxyUrl });

        
        const hasPermission = notes.some(note => note.owner.toString() === userId);
        if (!hasPermission) {
            return res.status(403).json({ message: 'Not authorized to delete this file' });
        }

        
        const storageClient = new Storage({ projectId: process.env.GCP_PROJECT_ID || 'chttrix-prod' });
        await storageClient.bucket(BUCKET_NAME).file(gcsPath).delete();

        
        for (const note of notes) {
            note.attachments = note.attachments.filter(att => att.url !== proxyUrl);
            await note.save();
        }

        return res.json({ message: 'File deleted successfully' });

    } catch (err) {
        return sendError(res, err, { status: 500 });
    }
};

module.exports = exports;
