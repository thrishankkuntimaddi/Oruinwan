// server/src/shared/upload/upload.controller.js
// Note-attachment upload — stores files in GCS (memory→GCS, never local disk)
const { uploadNoteAttachment, getFileCategory, validateFileSize, FILE_SIZE_LIMITS } = require('../../../config/multer.config');
const { uploadToGCS, streamGCSFile, BUCKET_NAME } = require('../../modules/uploads/upload.service');
const { Storage } = require('@google-cloud/storage');
const Note = require('../../../models/Note');
const Workspace = require('../../../models/Workspace');

/**
 * Upload a file for note attachment
 * POST /api/upload/note-attachment
 * Body (multipart/form-data):
 *   - file: The file to upload
 *   - workspaceId: Workspace ID
 *   - noteId: (optional) Note ID if attaching to existing note
 */
exports.uploadNoteAttachment = async (req, res) => {
    try {
        // Run multer middleware (memory storage)
        uploadNoteAttachment.single('file')(req, res, async (err) => {
            if (err) {
                console.error('Upload error:', err);
                return res.status(400).json({
                    message: err.message || 'File upload failed'
                });
            }

            if (!req.file) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const { workspaceId, noteId } = req.body;
            const userId = req.user.sub;

            if (!workspaceId) {
                return res.status(400).json({ message: 'Workspace ID required' });
            }

            const workspace = await Workspace.findById(workspaceId);
            if (!workspace || !workspace.isMember(userId)) {
                return res.status(403).json({ message: 'Access denied to workspace' });
            }

            // Validate file size based on category
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

            // Upload to GCS (memory buffer → Cloud Storage)
            const gcsFolder = `notes/${workspaceId}`;
            const gcsAttachment = await uploadToGCS(req.file, gcsFolder);

            const category = getFileCategory(req.file.mimetype);
            const categoryKey = category === 'images' ? 'image' :
                category === 'videos' ? 'video' :
                    category === 'audio' ? 'audio' : 'document';

            const attachmentData = {
                name: req.file.originalname,
                url: gcsAttachment.url,          // GCS proxy URL (/api/v2/uploads/file?path=<gcsPath>)
                type: req.file.mimetype,
                size: req.file.size,
                category: categoryKey,
                uploadedBy: userId,
                uploadedAt: new Date()
            };

            // If noteId provided, add attachment to note
            if (noteId) {
                const note = await Note.findById(noteId);
                if (!note) {
                    return res.status(404).json({ message: 'Note not found' });
                }
                if (!note.canEdit(userId)) {
                    return res.status(403).json({ message: 'Not authorized to edit this note' });
                }

                note.attachments.push(attachmentData);
                await note.save();

                // Emit real-time update
                if (req.io) {
                    if (note.isPublic && note.workspace) {
                        req.io.to(`workspace_${note.workspace}`).emit('note-attachment-added', {
                            noteId: note._id,
                            attachment: attachmentData
                        });
                    } else {
                        const recipients = new Set([
                            note.owner.toString(),
                            ...note.sharedWith.map(id => id.toString())
                        ]);
                        recipients.forEach(readerId => {
                            req.io.to(`user_${readerId}`).emit('note-attachment-added', {
                                noteId: note._id,
                                attachment: attachmentData
                            });
                        });
                    }
                }
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
        });

    } catch (err) {
        console.error('UPLOAD ATTACHMENT ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Delete a note attachment from GCS
 * DELETE /api/upload/note-attachment/:filename
 * Query: gcsPath — the GCS object path returned when the file was uploaded
 */
exports.deleteAttachment = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { gcsPath } = req.query;

        if (!gcsPath) {
            return res.status(400).json({ message: 'gcsPath query parameter required' });
        }

        // Basic path traversal guard
        if (!/^[a-zA-Z0-9/_.\-]+$/.test(gcsPath)) {
            return res.status(400).json({ message: 'Invalid gcsPath' });
        }

        // The proxy URL that was stored in attachment.url looks like:
        //   /api/v2/uploads/file?path=<gcsPath>
        // Match on that URL so we can find the owning note without a separate gcsPath field.
        const proxyUrl = `/api/v2/uploads/file?path=${encodeURIComponent(gcsPath)}`;
        const notes = await Note.find({ 'attachments.url': proxyUrl });

        // Verify user has permission to delete
        const hasPermission = notes.some(note => note.owner.toString() === userId);
        if (!hasPermission) {
            return res.status(403).json({ message: 'Not authorized to delete this file' });
        }

        // Delete from GCS
        const storageClient = new Storage({ projectId: process.env.GCP_PROJECT_ID || 'chttrix-prod' });
        await storageClient.bucket(BUCKET_NAME).file(gcsPath).delete();

        // Remove from all notes' attachments
        for (const note of notes) {
            note.attachments = note.attachments.filter(att => att.url !== proxyUrl);
            await note.save();
        }

        return res.json({ message: 'File deleted successfully' });

    } catch (err) {
        console.error('DELETE ATTACHMENT ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = exports;
