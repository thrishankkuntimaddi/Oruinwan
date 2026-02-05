// server/controllers/uploadController.js
const { uploadNoteAttachment, getFileCategory, validateFileSize, FILE_SIZE_LIMITS } = require('../../../config/multer.config');
const Note = require('../../../models/Note');
const Workspace = require('../../../models/Workspace');
const path = require('path');
const fs = require('fs');

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
        // Upload file using multer
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

            // Validate workspace access
            if (!workspaceId) {
                // Delete uploaded file
                fs.unlinkSync(req.file.path);
                return res.status(400).json({ message: 'Workspace ID required' });
            }

            const workspace = await Workspace.findById(workspaceId);
            if (!workspace || !workspace.isMember(userId)) {
                // Delete uploaded file
                fs.unlinkSync(req.file.path);
                return res.status(403).json({ message: 'Access denied to workspace' });
            }

            // Validate file size based on category
            if (!validateFileSize(req.file)) {
                // Delete uploaded file
                fs.unlinkSync(req.file.path);
                const category = getFileCategory(req.file.mimetype);
                const categoryKey = category === 'images' ? 'image' :
                    category === 'videos' ? 'video' :
                        category === 'audio' ? 'audio' : 'document';
                const limit = FILE_SIZE_LIMITS[categoryKey];
                const limitMB = Math.round(limit / (1024 * 1024));

                return res.status(400).json({
                    message: `File size exceeds limit of ${limitMB}MB for ${categoryKey} files`
                });
            }

            // Build file URL (relative to server root)
            const category = path.basename(path.dirname(req.file.path)); // images, videos, audio, documents
            const fileUrl = `/uploads/notes/${category}/${req.file.filename}`;

            // Prepare attachment data
            const attachmentData = {
                name: req.file.originalname,
                url: fileUrl,
                type: req.file.mimetype,
                size: req.file.size,
                category: category === 'images' ? 'image' :
                    category === 'videos' ? 'video' :
                        category === 'audio' ? 'audio' : 'document',
                uploadedBy: userId,
                uploadedAt: new Date()
            };

            // If noteId provided, add attachment to note
            if (noteId) {
                const note = await Note.findById(noteId);
                if (!note) {
                    // Delete uploaded file
                    fs.unlinkSync(req.file.path);
                    return res.status(404).json({ message: 'Note not found' });
                }

                if (!note.canEdit(userId)) {
                    // Delete uploaded file
                    fs.unlinkSync(req.file.path);
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
                url: fileUrl,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
                mimeType: req.file.mimetype,
                category: attachmentData.category,
                attachment: attachmentData
            });
        });

    } catch (_err) {
        console.error('UPLOAD ATTACHMENT ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Delete an uploaded file
 * DELETE /api/upload/note-attachment/:filename
 */
exports.deleteAttachment = async (req, res) => {
    try {
        const { filename } = req.params;
        const { category } = req.query; // images, videos, audio, documents
        const userId = req.user.sub;

        if (!category) {
            return res.status(400).json({ message: 'File category required' });
        }

        // Construct file path
        const filePath = path.join(__dirname, '../uploads/notes', category, filename);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'File not found' });
        }

        // Find notes that reference this file
        const fileUrl = `/uploads/notes/${category}/${filename}`;
        const notes = await Note.find({
            'attachments.url': fileUrl
        });

        // Verify user has permission to delete (must be owner of at least one note with this attachment)
        const hasPermission = notes.some(note => note.owner.toString() === userId);
        if (!hasPermission) {
            return res.status(403).json({ message: 'Not authorized to delete this file' });
        }

        // Delete file
        fs.unlinkSync(filePath);

        // Remove from all notes' attachments
        for (const note of notes) {
            note.attachments = note.attachments.filter(att => att.url !== fileUrl);
            await note.save();
        }

        return res.json({ message: 'File deleted successfully' });

    } catch (_err) {
        console.error('DELETE ATTACHMENT ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = exports;
