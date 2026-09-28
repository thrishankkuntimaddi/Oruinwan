'use strict';

/**
 * Note access rules (all require active membership of the note's workspace):
 *   view  : owner, anyone the note is shared with, or any member when isPublic
 *   edit  : owner, or a shared user when the note's allowEditing flag is true
 *   owner : owner only (sharing, visibility, pin/archive, delete, versions)
 */

const { getWorkspaceMembership, isValidId, HttpError } = require('../../shared/utils/workspaceAccess');

function idOf(v) {
    return String(v?._id || v || '');
}

function isNoteOwner(note, userId) {
    return idOf(note.owner) === String(userId);
}

function isSharedWith(note, userId) {
    return (note.sharedWith || []).some(u => idOf(u) === String(userId));
}

function canView(note, userId, isWorkspaceMember) {
    if (!isWorkspaceMember) return false;
    return isNoteOwner(note, userId) || !!note.isPublic || isSharedWith(note, userId);
}

function canEdit(note, userId, isWorkspaceMember) {
    if (!isWorkspaceMember) return false;
    return isNoteOwner(note, userId) || (!!note.allowEditing && isSharedWith(note, userId));
}

/** true when userId is an active member of the workspace. */
async function isWorkspaceMember(userId, workspaceId) {
    if (!workspaceId || !isValidId(idOf(workspaceId))) return false;
    const access = await getWorkspaceMembership(idOf(workspaceId), userId);
    return !!(access && access.member);
}

/**
 * Resolve `note` for `userId` at the required level ('view' | 'edit' | 'owner').
 * Throws HttpError 403 when the caller is not an active workspace member or lacks
 * the right. Returns { isMember }.
 */
async function assertNoteAccess(note, userId, level = 'view') {
    const isMember = await isWorkspaceMember(userId, note.workspace);
    if (!isMember) throw new HttpError(403, 'You are not a member of this workspace', 'WORKSPACE_ACCESS_DENIED');
    const ok = level === 'owner' ? isNoteOwner(note, userId)
        : level === 'edit' ? canEdit(note, userId, true)
            : canView(note, userId, true);
    if (!ok) {
        const msg = level === 'owner' ? 'Only the note owner can do this'
            : level === 'edit' ? 'Not authorized to edit this note' : 'Not authorized to view this note';
        throw new HttpError(403, msg);
    }
    return { isMember };
}

module.exports = {
    canView,
    canEdit,
    isNoteOwner,
    isSharedWith,
    isWorkspaceMember,
    assertNoteAccess,
};
