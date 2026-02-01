// server/controllers/noteController.js

const Note = require("../models/Note");
const User = require("../models/User");
const Workspace = require("../models/Workspace");
const { logAction } = require("../utils/historyLogger");

/**
 * Get notes (personal or workspace)
 * GET /api/notes?workspaceId=...&type=...
 */
exports.getNotes = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, type } = req.query;

        const user = await User.findById(userId);

        const query = {
            $or: [
                { owner: userId }, // Notes owned by user
                { sharedWith: userId } // Notes shared with user
            ],
            isArchived: false
        };

        if (workspaceId) {
            query.workspace = workspaceId;

            // Verify workspace access
            const workspace = await Workspace.findById(workspaceId);
            if (!workspace || !workspace.isMember(userId)) {
                return res.status(403).json({ message: "Access denied" });
            }
        }

        if (type) {
            query.type = type;
        }

        const notes = await Note.find(query)
            .populate("owner", "username profilePicture")
            .populate("sharedWith", "username profilePicture")
            .sort({ isPinned: -1, updatedAt: -1 })
            .lean();

        return res.json({ notes });

    } catch (err) {
        console.error("GET NOTES ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Create a note
 * POST /api/notes
 */
exports.createNote = async (req, res) => {
    try {
        const userId = req.user.sub;
        const {
            title,
            content,
            type = "personal",
            workspaceId,
            sharedWith = [],
            tags = []
        } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Title is required" });
        }

        const user = await User.findById(userId);

        let companyId = null;
        let workspace = null;

        // Validate workspace if provided
        if (workspaceId) {
            workspace = await Workspace.findById(workspaceId);
            if (!workspace) {
                return res.status(404).json({ message: "Workspace not found" });
            }

            if (!workspace.isMember(userId)) {
                return res.status(403).json({ message: "Access denied" });
            }

            companyId = workspace.company;
        } else if (type !== "personal") {
            return res.status(400).json({
                message: "Workspace ID required for non-personal notes"
            });
        }

        const note = new Note({
            company: companyId,
            workspace: workspaceId || null,
            owner: userId,
            title,
            content: content || "",
            type,
            sharedWith,
            tags
        });

        await note.save();

        await logAction({
            userId,
            action: "note_created",
            description: `Created note: ${title}`,
            resourceType: "note",
            resourceId: note._id,
            companyId,
            metadata: { type, workspaceId },
            req
        });

        const populatedNote = await Note.findById(note._id)
            .populate("owner", "username profilePicture")
            .populate("sharedWith", "username profilePicture");

        // ✅ REAL-TIME SOCKET EMISSION
        if (req.io) {
            if (populatedNote.isPublic && populatedNote.workspace) {
                req.io.to(`workspace_${populatedNote.workspace}`).emit("note-created", populatedNote);
            } else {
                // Private/Shared
                const recipients = new Set([userId, ...populatedNote.sharedWith.map(u => u._id.toString())]);
                recipients.forEach(readerId => {
                    req.io.to(`user_${readerId}`).emit("note-created", populatedNote);
                });
            }
        }

        return res.status(201).json({
            message: "Note created successfully",
            note: populatedNote
        });

    } catch (err) {
        console.error("CREATE NOTE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Update a note
 * PUT /api/notes/:id
 */
exports.updateNote = async (req, res) => {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const updates = req.body;

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: "Note not found" });
        }

        // Only owner can update
        if (note.owner.toString() !== userId) {
            return res.status(403).json({ message: "Only note owner can update" });
        }

        // Update allowed fields
        const allowedFields = [
            "title",
            "content",
            "sharedWith",
            "isPublic",
            "isPinned",
            "tags"
        ];

        allowedFields.forEach(field => {
            if (updates[field] !== undefined) {
                note[field] = updates[field];
            }
        });

        await note.save();

        const populatedNote = await Note.findById(note._id)
            .populate("owner", "username profilePicture")
            .populate("sharedWith", "username profilePicture");

        // ✅ REAL-TIME SOCKET EMISSION
        if (req.io) {
            if (populatedNote.isPublic && populatedNote.workspace) {
                req.io.to(`workspace_${populatedNote.workspace}`).emit("note-updated", populatedNote);
            } else {
                const recipients = new Set([
                    populatedNote.owner._id.toString(),
                    ...populatedNote.sharedWith.map(u => u._id.toString())
                ]);
                recipients.forEach(readerId => {
                    req.io.to(`user_${readerId}`).emit("note-updated", populatedNote);
                });
            }
        }

        return res.json({
            message: "Note updated successfully",
            note: populatedNote
        });

    } catch (err) {
        console.error("UPDATE NOTE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Delete/Archive a note
 * DELETE /api/notes/:id
 */
exports.deleteNote = async (req, res) => {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const { permanent = false } = req.query;

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: "Note not found" });
        }

        if (note.owner.toString() !== userId) {
            return res.status(403).json({ message: "Only note owner can delete" });
        }

        if (permanent) {
            await Note.findByIdAndDelete(noteId);
            return res.json({ message: "Note permanently deleted" });
        } else {
            // Soft delete (archive)
            note.isArchived = true;
            note.archivedAt = new Date();
            await note.save();

            // ✅ REAL-TIME SOCKET EMISSION (Archive)
            if (req.io) {
                // Only notify if public or shared
                if (note.isPublic && note.workspace) {
                    req.io.to(`workspace_${note.workspace}`).emit("note-deleted", { noteId });
                } else {
                    const recipients = new Set([userId, ...note.sharedWith.map(id => id.toString())]);
                    recipients.forEach(readerId => {
                        req.io.to(`user_${readerId}`).emit("note-deleted", { noteId });
                    });
                }
            }

            return res.json({ message: "Note archived" });
        }

    } catch (err) {
        console.error("DELETE NOTE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Share a note with users
 * POST /api/notes/:id/share
 */
exports.shareNote = async (req, res) => {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({ message: "User IDs array required" });
        }

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: "Note not found" });
        }

        if (note.owner.toString() !== userId) {
            return res.status(403).json({ message: "Only note owner can share" });
        }

        // Add users to sharedWith (avoid duplicates)
        userIds.forEach(uid => {
            if (!note.sharedWith.includes(uid)) {
                note.sharedWith.push(uid);
            }
        });

        await note.save();

        await logAction({
            userId,
            action: "note_shared",
            description: `Shared note: ${note.title}`,
            resourceType: "note",
            resourceId: note._id,
            companyId: note.company,
            metadata: { sharedWith: userIds },
            req
        });

        const populatedNote = await Note.findById(note._id)
            .populate("owner", "username profilePicture")
            .populate("sharedWith", "username profilePicture");

        // ✅ REAL-TIME SOCKET EMISSION
        if (req.io) {
            // If already public, sharing just updates list
            if (populatedNote.isPublic && populatedNote.workspace) {
                req.io.to(`workspace_${populatedNote.workspace}`).emit("note-updated", populatedNote);
            } else {
                // Notify all shared users (including new ones)
                const recipients = new Set([
                    populatedNote.owner._id.toString(),
                    ...populatedNote.sharedWith.map(u => u._id.toString())
                ]);
                recipients.forEach(readerId => {
                    req.io.to(`user_${readerId}`).emit("note-shared", populatedNote);
                });
            }
        }

        return res.json({
            message: "Note shared successfully",
            note: populatedNote
        });

    } catch (err) {
        console.error("SHARE NOTE ERROR:", err);
        return res.status(500).json({ message: "Server error" });
    }
};

/**
 * Add attachment to note
 * POST /api/notes/:id/attachments
 */
exports.addAttachment = async (req, res) => {
    try {
        const userId = req.user.sub;
        const noteId = req.params.id;
        const attachmentData = req.body;

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }

        if (!note.canEdit(userId)) {
            return res.status(403).json({ message: 'Not authorized to edit this note' });
        }

        note.attachments.push(attachmentData);
        await note.save();

        // Real-time update
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

        return res.json({
            message: 'Attachment added successfully',
            attachment: attachmentData
        });

    } catch (err) {
        console.error('ADD ATTACHMENT ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Remove attachment from note
 * DELETE /api/notes/:id/attachments/:attachmentId
 */
exports.removeAttachment = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { id: noteId, attachmentId } = req.params;

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }

        if (!note.canEdit(userId)) {
            return res.status(403).json({ message: 'Not authorized to edit this note' });
        }

        const attachment = note.attachments.id(attachmentId);
        if (!attachment) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        // Delete file from storage
        const path = require('path');
        const fs = require('fs');
        const filePath = path.join(__dirname, '../', attachment.url);

        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove from database
        attachment.remove();
        await note.save();

        return res.json({ message: 'Attachment deleted successfully' });

    } catch (err) {
        console.error('REMOVE ATTACHMENT ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Download attachment
 * GET /api/notes/:id/attachments/:attachmentId/download
 */
exports.downloadAttachment = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { id: noteId, attachmentId } = req.params;

        const note = await Note.findById(noteId);
        if (!note) {
            return res.status(404).json({ message: 'Note not found' });
        }

        if (!note.canView(userId)) {
            return res.status(403).json({ message: 'Not authorized to view this note' });
        }

        const attachment = note.attachments.id(attachmentId);
        if (!attachment) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        const path = require('path');
        const filePath = path.join(__dirname, '../', attachment.url);

        // Send file download
        res.download(filePath, attachment.name);

    } catch (err) {
        console.error('DOWNLOAD ATTACHMENT ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports = exports;
