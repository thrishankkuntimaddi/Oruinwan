// server/src/features/notes/notes.service.js
/**
 * Notes Service - Business Logic Layer
 * 
 * Behavior-preserving migration from controllers/noteController.js
 * 
 * This module contains ALL business logic for note operations.
 * NO HTTP concerns (req/res), NO direct socket emissions, NO Express dependencies.
 * 
 * @module features/notes/notes.service
 */

const mongoose = require('mongoose');

// Models
const Note = require('../../../models/Note');
const User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');

// Shared Utils
const { logAction } = require('../../../utils/historyLogger');

// Feature layers (to be imported after creation)
// const policy = require('./notes.policy');
// const validator = require('./notes.validator');
// const notifications = require('./notes.notifications');
// const activity = require('./notes.activity');

// ============================================================================
// SERVICE METHODS
// ============================================================================

/**
 * Get notes (personal or workspace)
 * 
 * Business Rules:
 * - Returns notes owned by user OR shared with user
 * - Excludes archived notes (isArchived: false)
 * - Optional workspace filter (requires membership verification)
 * - Optional type filter
 * - Sorted by: isPinned DESC, updatedAt DESC
 * 
 * @param {string} userId - User ID from auth token
 * @param {Object} filters - Query filters
 * @param {string} [filters.workspaceId] - Optional workspace filter
 * @param {string} [filters.type] - Optional type filter (personal, note, meeting, documentation)
 * @returns {Promise<Object>} { notes: Note[] }
 */
async function getNotes(userId, filters = {}) {
    const { workspaceId, type } = filters;

    // Base query: owned OR shared, not archived
    const query = {
        $or: [
            { owner: userId },      // Notes owned by user
            { sharedWith: userId }  // Notes shared with user
        ],
        isArchived: false
    };

    // Workspace filter
    if (workspaceId) {
        query.workspace = workspaceId;

        // Verify workspace access
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace || !workspace.isMember(userId)) {
            const error = new Error('Access denied');
            error.statusCode = 403;
            throw error;
        }
    }

    // Type filter
    if (type) {
        query.type = type;
    }

    // Execute query
    const notes = await Note.find(query)
        .populate('owner', 'username profilePicture')
        .populate('sharedWith', 'username profilePicture')
        .sort({ isPinned: -1, updatedAt: -1 })
        .lean();

    return { notes };
}

/**
 * Create a note
 * 
 * Business Rules:
 * - Title is REQUIRED (400 error)
 * - Non-personal notes REQUIRE workspace (400 error)
 * - User must be workspace member (403 error)
 * - Company ID inherited from workspace
 * - Socket event emitted after creation
 * - Audit log created
 * 
 * @param {string} userId - User ID from auth token
 * @param {Object} noteData - Note data
 * @param {string} noteData.title - REQUIRED
 * @param {string} [noteData.content] - Note content
 * @param {string} [noteData.type='personal'] - Note type
 * @param {string} [noteData.workspaceId] - Workspace ID (required for non-personal)
 * @param {string[]} [noteData.sharedWith=[]] - User IDs to share with
 * @param {string[]} [noteData.tags=[]] - Tags
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request (for logging)
 * @returns {Promise<Object>} { message: string, note: Note }
 */
async function createNote(userId, noteData, io, req) {
    const {
        title,
        content,
        type = 'personal',
        workspaceId,
        sharedWith = [],
        tags = []
    } = noteData;

    // Validation: title required
    if (!title) {
        const error = new Error('Title is required');
        error.statusCode = 400;
        throw error;
    }

    let companyId = null;
    let workspace = null;

    // Validate workspace if provided
    if (workspaceId) {
        workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            const error = new Error('Workspace not found');
            error.statusCode = 404;
            throw error;
        }

        if (!workspace.isMember(userId)) {
            const error = new Error('Access denied');
            error.statusCode = 403;
            throw error;
        }

        companyId = workspace.company;
    } else if (type !== 'personal') {
        // Non-personal notes REQUIRE workspace
        const error = new Error('Workspace ID required for non-personal notes');
        error.statusCode = 400;
        throw error;
    }

    // Create note
    const note = new Note({
        company: companyId,
        workspace: workspaceId || null,
        owner: userId,
        title,
        content: content || '',
        type,
        sharedWith,
        tags
    });

    await note.save();

    // Audit logging
    await logAction({
        userId,
        action: 'note_created',
        description: `Created note: ${title}`,
        resourceType: 'note',
        resourceId: note._id,
        companyId,
        metadata: { type, workspaceId },
        req
    });

    // Populate for response
    const populatedNote = await Note.findById(note._id)
        .populate('owner', 'username profilePicture')
        .populate('sharedWith', 'username profilePicture');

    // STUB: Socket notification (to be moved to notes.notifications.js)
    if (io) {
        if (populatedNote.isPublic && populatedNote.workspace) {
            io.to(`workspace_${populatedNote.workspace}`).emit('note-created', populatedNote);
        } else {
            // Private/Shared
            const recipients = new Set([userId, ...populatedNote.sharedWith.map(u => u._id.toString())]);
            recipients.forEach(readerId => {
                io.to(`user_${readerId}`).emit('note-created', populatedNote);
            });
        }
    }

    return {
        message: 'Note created successfully',
        note: populatedNote
    };
}

/**
 * Update a note
 * 
 * Business Rules:
 * - Only owner can update (403 error)
 * - Allowed fields: title, content, sharedWith, isPublic, isPinned, tags
 * - Partial updates supported (only provided fields updated)
 * - Socket event emitted after update
 * 
 * @param {string} userId - User ID from auth token
 * @param {string} noteId - Note ID
 * @param {Object} updates - Fields to update
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request
 * @returns {Promise<Object>} { message: string, note: Note }
 */
async function updateNote(userId, noteId, updates, io, req) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    // Permission: Only owner can update
    if (note.owner.toString() !== userId) {
        const error = new Error('Only note owner can update');
        error.statusCode = 403;
        throw error;
    }

    // Update allowed fields
    const allowedFields = [
        'title',
        'content',
        'sharedWith',
        'isPublic',
        'isPinned',
        'tags'
    ];

    allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
            note[field] = updates[field];
        }
    });

    await note.save();

    // Populate for response
    const populatedNote = await Note.findById(note._id)
        .populate('owner', 'username profilePicture')
        .populate('sharedWith', 'username profilePicture');

    // STUB: Socket notification
    if (io) {
        if (populatedNote.isPublic && populatedNote.workspace) {
            io.to(`workspace_${populatedNote.workspace}`).emit('note-updated', populatedNote);
        } else {
            const recipients = new Set([
                populatedNote.owner._id.toString(),
                ...populatedNote.sharedWith.map(u => u._id.toString())
            ]);
            recipients.forEach(readerId => {
                io.to(`user_${readerId}`).emit('note-updated', populatedNote);
            });
        }
    }

    return {
        message: 'Note updated successfully',
        note: populatedNote
    };
}

/**
 * Delete/Archive a note
 * 
 * Business Rules:
 * - Only owner can delete (403 error)
 * - Soft delete (default): isArchived=true, archivedAt=Date.now()
 * - Hard delete (permanent=true): Note.findByIdAndDelete()
 * - Socket event emitted for soft delete only
 * 
 * @param {string} userId - User ID from auth token
 * @param {string} noteId - Note ID
 * @param {boolean} permanent - If true, hard delete; else soft delete
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request
 * @returns {Promise<Object>} { message: string }
 */
async function deleteNote(userId, noteId, permanent, io, req) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    // Permission: Only owner can delete
    if (note.owner.toString() !== userId) {
        const error = new Error('Only note owner can delete');
        error.statusCode = 403;
        throw error;
    }

    if (permanent) {
        // Hard delete
        await Note.findByIdAndDelete(noteId);
        return { message: 'Note permanently deleted' };
    } else {
        // Soft delete (archive)
        note.isArchived = true;
        note.archivedAt = new Date();
        await note.save();

        // STUB: Socket notification (soft delete only)
        if (io) {
            if (note.isPublic && note.workspace) {
                io.to(`workspace_${note.workspace}`).emit('note-deleted', { noteId });
            } else {
                const recipients = new Set([userId, ...note.sharedWith.map(id => id.toString())]);
                recipients.forEach(readerId => {
                    io.to(`user_${readerId}`).emit('note-deleted', { noteId });
                });
            }
        }

        return { message: 'Note archived' };
    }
}

/**
 * Share a note with users
 * 
 * Business Rules:
 * - Only owner can share (403 error)
 * - userIds array required (400 error if missing/empty)
 * - Duplicate users not added (check before push)
 * - Audit log created
 * - Socket event emitted
 * 
 * @param {string} userId - User ID from auth token
 * @param {string} noteId - Note ID
 * @param {string[]} userIds - Array of user IDs to share with
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request
 * @returns {Promise<Object>} { message: string, note: Note }
 */
async function shareNote(userId, noteId, userIds, io, req) {
    // Validation: userIds required
    if (!Array.isArray(userIds) || userIds.length === 0) {
        const error = new Error('User IDs array required');
        error.statusCode = 400;
        throw error;
    }

    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    // Permission: Only owner can share
    if (note.owner.toString() !== userId) {
        const error = new Error('Only note owner can share');
        error.statusCode = 403;
        throw error;
    }

    // Add users to sharedWith (avoid duplicates)
    userIds.forEach(uid => {
        if (!note.sharedWith.includes(uid)) {
            note.sharedWith.push(uid);
        }
    });

    await note.save();

    // Audit logging
    await logAction({
        userId,
        action: 'note_shared',
        description: `Shared note: ${note.title}`,
        resourceType: 'note',
        resourceId: note._id,
        companyId: note.company,
        metadata: { sharedWith: userIds },
        req
    });

    // Populate for response
    const populatedNote = await Note.findById(note._id)
        .populate('owner', 'username profilePicture')
        .populate('sharedWith', 'username profilePicture');

    // STUB: Socket notification
    if (io) {
        if (populatedNote.isPublic && populatedNote.workspace) {
            // If already public, sharing just updates list
            io.to(`workspace_${populatedNote.workspace}`).emit('note-updated', populatedNote);
        } else {
            // Notify all shared users (including new ones)
            const recipients = new Set([
                populatedNote.owner._id.toString(),
                ...populatedNote.sharedWith.map(u => u._id.toString())
            ]);
            recipients.forEach(readerId => {
                io.to(`user_${readerId}`).emit('note-shared', populatedNote);
            });
        }
    }

    return {
        message: 'Note shared successfully',
        note: populatedNote
    };
}

/**
 * Add attachment to note
 * 
 * Business Rules:
 * - Permission: note.canEdit(userId) - owner OR shared with allowEditing
 * - Attachment pushed to note.attachments array
 * - Socket event emitted
 * 
 * @param {string} userId - User ID from auth token
 * @param {string} noteId - Note ID
 * @param {Object} attachmentData - Attachment data
 * @param {string} attachmentData.name - Filename
 * @param {string} attachmentData.url - File URL
 * @param {string} attachmentData.type - MIME type
 * @param {number} attachmentData.size - File size
 * @param {string} attachmentData.category - Category (image, video, audio, document)
 * @param {Object} io - Socket.io instance
 * @param {Object} req - Express request
 * @returns {Promise<Object>} { message: string, attachment: Object }
 */
async function addAttachment(userId, noteId, attachmentData, io, req) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    // Permission: canEdit (owner OR shared with allowEditing)
    if (!note.canEdit(userId)) {
        const error = new Error('Not authorized to edit this note');
        error.statusCode = 403;
        throw error;
    }

    // Add attachment
    note.attachments.push(attachmentData);
    await note.save();

    // STUB: Socket notification
    if (io) {
        if (note.isPublic && note.workspace) {
            io.to(`workspace_${note.workspace}`).emit('note-attachment-added', {
                noteId: note._id,
                attachment: attachmentData
            });
        } else {
            const recipients = new Set([
                note.owner.toString(),
                ...note.sharedWith.map(id => id.toString())
            ]);
            recipients.forEach(readerId => {
                io.to(`user_${readerId}`).emit('note-attachment-added', {
                    noteId: note._id,
                    attachment: attachmentData
                });
            });
        }
    }

    return {
        message: 'Attachment added successfully',
        attachment: attachmentData
    };
}

/**
 * Remove attachment from note
 * 
 * Business Rules:
 * - Permission: note.canEdit(userId)
 * - Physical file deleted from disk (fs.unlinkSync)
 * - Attachment removed from database
 * 
 * @param {string} userId - User ID from auth token
 * @param {string} noteId - Note ID
 * @param {string} attachmentId - Attachment ID
 * @param {Object} req - Express request
 * @returns {Promise<Object>} { message: string }
 */
async function removeAttachment(userId, noteId, attachmentId, req) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    // Permission: canEdit
    if (!note.canEdit(userId)) {
        const error = new Error('Not authorized to edit this note');
        error.statusCode = 403;
        throw error;
    }

    const attachment = note.attachments.id(attachmentId);
    if (!attachment) {
        const error = new Error('Attachment not found');
        error.statusCode = 404;
        throw error;
    }

    // Delete file from storage
    const path = require('path');
    const fs = require('fs');
    const filePath = path.join(__dirname, '../../../', attachment.url);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // Remove from database
    attachment.remove();
    await note.save();

    return { message: 'Attachment deleted successfully' };
}

/**
 * Download attachment
 * 
 * Business Rules:
 * - Permission: note.canView(userId) - owner, public, or shared
 * - Returns file path for res.download()
 * 
 * NOTE: This is special - returns file path, not JSON
 * Controller will call res.download() directly
 * 
 * @param {string} userId - User ID from auth token
 * @param {string} noteId - Note ID
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Object>} { filePath: string, fileName: string }
 */
async function downloadAttachment(userId, noteId, attachmentId) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    // Permission: canView
    if (!note.canView(userId)) {
        const error = new Error('Not authorized to view this note');
        error.statusCode = 403;
        throw error;
    }

    const attachment = note.attachments.id(attachmentId);
    if (!attachment) {
        const error = new Error('Attachment not found');
        error.statusCode = 404;
        throw error;
    }

    const path = require('path');
    const filePath = path.join(__dirname, '../../../', attachment.url);

    return {
        filePath,
        fileName: attachment.name
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    getNotes,
    createNote,
    updateNote,
    deleteNote,
    shareNote,
    addAttachment,
    removeAttachment,
    downloadAttachment
};
