'use strict';

/**
 * Real-time note events.
 *   public notes  -> workspace room `workspace:<id>` (the room sockets join via
 *                    `join-workspace`, see src/socket/chatHandlers.js)
 *   other notes   -> personal rooms `user_<id>` of the owner and shared users
 * Events: note-created, note-updated, note-deleted, note-shared, note-attachment-added.
 */

function idOf(v) {
    return String(v?._id || v || '');
}

function workspaceRoom(workspaceId) {
    return `workspace:${idOf(workspaceId)}`;
}

function personalRecipients(note, extra = []) {
    return new Set([
        idOf(note.owner),
        ...(note.sharedWith || []).map(idOf),
        ...extra.map(idOf),
    ].filter(Boolean));
}

function emitForNote(io, note, event, payload, { extraUsers = [] } = {}) {
    if (!io || !note) return;
    if (note.isPublic && note.workspace) {
        io.to(workspaceRoom(note.workspace)).emit(event, payload);
        // Users removed from sharedWith / owner still get it on their personal room.
        extraUsers.forEach(uid => io.to(`user_${idOf(uid)}`).emit(event, payload));
        return;
    }
    personalRecipients(note, extraUsers).forEach(uid => io.to(`user_${uid}`).emit(event, payload));
}

const notifyNoteCreated = (note, io) => emitForNote(io, note, 'note-created', note);
const notifyNoteUpdated = (note, io, opts) => emitForNote(io, note, 'note-updated', note, opts);
const notifyNoteShared = (note, io) => emitForNote(io, note, note.isPublic ? 'note-updated' : 'note-shared', note);
const notifyNoteDeleted = (noteId, note, io, extra = {}) =>
    emitForNote(io, note, 'note-deleted', { noteId: String(noteId), ...extra });
const notifyAttachmentAdded = (noteId, attachment, note, io) =>
    emitForNote(io, note, 'note-attachment-added', { noteId: String(noteId), attachment });

/**
 * Called after an update, before notifyNoteUpdated:
 *   public -> private : workspace members who can no longer see it get note-deleted
 *   private -> public : workspace members get note-created
 *   unshared users (still private) get note-deleted
 */
function notifyVisibilityChange(io, note, { wasPublic, removedUserIds = [] } = {}) {
    if (!io || !note || !note.workspace) return;
    const payload = { noteId: idOf(note._id), reason: 'access-changed' };
    const keep = [...personalRecipients(note)].map(uid => `user_${uid}`);
    if (wasPublic && !note.isPublic) {
        io.to(workspaceRoom(note.workspace)).except(keep).emit('note-deleted', payload);
    } else if (!wasPublic && note.isPublic) {
        io.to(workspaceRoom(note.workspace)).except(keep).emit('note-created', note);
    }
    if (!note.isPublic) {
        removedUserIds.map(idOf).filter(Boolean).forEach(uid => io.to(`user_${uid}`).emit('note-deleted', payload));
    }
}

module.exports = {
    workspaceRoom,
    notifyVisibilityChange,
    emitForNote,
    notifyNoteCreated,
    notifyNoteUpdated,
    notifyNoteDeleted,
    notifyNoteShared,
    notifyAttachmentAdded,
};
