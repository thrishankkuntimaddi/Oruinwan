// server/src/features/notes/notes.policy.js
/**
 * Notes Policy - Permission & Access Control Layer
 * 
 * Replicates Note model's instance methods (canView, canEdit)
 * and provides clean interface for service layer.
 * 
 * @module features/notes/notes.policy
 */

const Workspace = require('../../../models/Workspace');

// ============================================================================
// PERMISSION CHECKS
// ============================================================================

/**
 * Check if user can view note
 * 
 * Replicates Note.canView() instance method logic:
 * - Owner can always view
 * - Public notes visible to workspace members
 * - Shared users can view
 * 
 * @param {Object} note - Note document
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function canView(note, userId) {
    const userIdStr = userId.toString();

    // Owner can always view
    if (note.owner.toString() === userIdStr) return true;

    // Public notes visible to all workspace members (workspace check done by caller)
    if (note.isPublic) return true;

    // Check if explicitly shared with user
    if (note.sharedWith.some(id => id.toString() === userIdStr)) return true;

    return false;
}

/**
 * Check if user can edit note
 * 
 * Replicates Note.canEdit() instance method logic:
 * - Owner can always edit
 * - If allowEditing=true, shared users can edit
 * 
 * @param {Object} note - Note document
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function canEdit(note, userId) {
    const userIdStr = userId.toString();

    // Owner can always edit
    if (note.owner.toString() === userIdStr) return true;

    // If allowEditing is true, shared users can edit
    if (note.allowEditing && note.sharedWith.some(id => id.toString() === userIdStr)) return true;

    return false;
}

/**
 * Check if user is note owner
 * 
 * @param {Object} note - Note document
 * @param {string} userId - User ID
 * @returns {boolean}
 */
function isNoteOwner(note, userId) {
    return note.owner.toString() === userId.toString();
}

/**
 * Check if user is workspace member
 * 
 * @param {string} userId - User ID
 * @param {string} workspaceId - Workspace ID
 * @returns {Promise<boolean>}
 */
async function isWorkspaceMember(userId, workspaceId) {
    try {
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return false;
        return workspace.isMember(userId);
    } catch (err) {
        console.error('Error checking workspace membership:', err);
        return false;
    }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    canView,
    canEdit,
    isNoteOwner,
    isWorkspaceMember
};
