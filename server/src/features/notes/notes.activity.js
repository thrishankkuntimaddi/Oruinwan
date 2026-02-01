// server/src/features/notes/notes.activity.js
/**
 * Notes Activity - Audit Logging
 * 
 * Handles activity logging for note operations.
 * 
 * @module features/notes/notes.activity
 */

const { logAction } = require('../../../utils/historyLogger');

// ============================================================================
// ACTIVITY LOGGING
// ============================================================================

/**
 * Log note created
 * 
 * @param {string} userId - User ID
 * @param {Object} note - Note document
 * @param {string} companyId - Company ID
 * @param {Object} metadata - Additional metadata
 * @param {Object} req - Express request
 */
async function logNoteCreated(userId, note, companyId, metadata, req) {
    await logAction({
        userId,
        action: 'note_created',
        description: `Created note: ${note.title}`,
        resourceType: 'note',
        resourceId: note._id,
        companyId,
        metadata,
        req
    });
}

/**
 * Log note shared
 * 
 * @param {string} userId - User ID
 * @param {Object} note - Note document
 * @param {string[]} userIds - Shared user IDs
 * @param {Object} req - Express request
 */
async function logNoteShared(userId, note, userIds, req) {
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
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    logNoteCreated,
    logNoteShared
};
