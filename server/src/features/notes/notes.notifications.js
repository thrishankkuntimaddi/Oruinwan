// server/src/features/notes/notes.notifications.js
/**
 * Notes Notifications - Real-time Socket Events
 * 
 * Handles all socket.io emissions for note operations.
 * Extracted from legacy inline socket logic.
 * 
 * @module features/notes/notes.notifications
 */

// ============================================================================
// HELPER: Get Recipients
// ============================================================================

/**
 * Get socket recipients for a note
 * Returns either workspace room or Set of user IDs
 * 
 * @param {Object} note - Note document
 * @returns {Object} { type: 'workspace'|'users', target: string|Set<string> }
 */
function getRecipients(note) {
    if (note.isPublic && note.workspace) {
        return {
            type: 'workspace',
            target: `workspace_${note.workspace}`
        };
    } else {
        const userIds = new Set([
            note.owner._id ? note.owner._id.toString() : note.owner.toString(),
            ...note.sharedWith.map(u => (
                u._id ? u._id.toString() : u.toString()
            ))
        ]);
        return {
            type: 'users',
            target: userIds
        };
    }
}

// ============================================================================
// NOTIFICATION FUNCTIONS
// ============================================================================

/**
 * Notify note created
 * 
 * @param {Object} note - Populated note document
 * @param {Object} io - Socket.io instance
 */
function notifyNoteCreated(note, io) {
    if (!io) return;

    const recipients = getRecipients(note);

    if (recipients.type === 'workspace') {
        io.to(recipients.target).emit('note-created', note);
    } else {
        recipients.target.forEach(userId => {
            io.to(`user_${userId}`).emit('note-created', note);
        });
    }
}

/**
 * Notify note updated
 * 
 * @param {Object} note - Populated note document
 * @param {Object} io - Socket.io instance
 */
function notifyNoteUpdated(note, io) {
    if (!io) return;

    const recipients = getRecipients(note);

    if (recipients.type === 'workspace') {
        io.to(recipients.target).emit('note-updated', note);
    } else {
        recipients.target.forEach(userId => {
            io.to(`user_${userId}`).emit('note-updated', note);
        });
    }
}

/**
 * Notify note deleted (archived)
 * 
 * @param {string} noteId - Note ID
 * @param {Object} note - Note document (before deletion)
 * @param {Object} io - Socket.io instance
 */
function notifyNoteDeleted(noteId, note, io) {
    if (!io) return;

    const payload = { noteId };

    if (note.isPublic && note.workspace) {
        io.to(`workspace_${note.workspace}`).emit('note-deleted', payload);
    } else {
        const userIds = new Set([
            note.owner.toString(),
            ...note.sharedWith.map(id => id.toString())
        ]);
        userIds.forEach(userId => {
            io.to(`user_${userId}`).emit('note-deleted', payload);
        });
    }
}

/**
 * Notify note shared
 * 
 * Special case: If already public, sends 'note-updated' instead
 * 
 * @param {Object} note - Populated note document
 * @param {Object} io - Socket.io instance
 */
function notifyNoteShared(note, io) {
    if (!io) return;

    const recipients = getRecipients(note);

    if (recipients.type === 'workspace') {
        // If already public, sharing just updates list
        io.to(recipients.target).emit('note-updated', note);
    } else {
        // Notify all shared users (including new ones)
        recipients.target.forEach(userId => {
            io.to(`user_${userId}`).emit('note-shared', note);
        });
    }
}

/**
 * Notify attachment added
 * 
 * @param {string} noteId - Note ID
 * @param {Object} attachment - Attachment data
 * @param {Object} note - Note document
 * @param {Object} io - Socket.io instance
 */
function notifyAttachmentAdded(noteId, attachment, note, io) {
    if (!io) return;

    const payload = { noteId, attachment };

    if (note.isPublic && note.workspace) {
        io.to(`workspace_${note.workspace}`).emit('note-attachment-added', payload);
    } else {
        const userIds = new Set([
            note.owner.toString(),
            ...note.sharedWith.map(id => id.toString())
        ]);
        userIds.forEach(userId => {
            io.to(`user_${userId}`).emit('note-attachment-added', payload);
        });
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    notifyNoteCreated,
    notifyNoteUpdated,
    notifyNoteDeleted,
    notifyNoteShared,
    notifyAttachmentAdded
};
