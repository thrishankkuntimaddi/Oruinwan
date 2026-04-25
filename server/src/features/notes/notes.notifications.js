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

function notifyNoteShared(note, io) {
    if (!io) return;

    const recipients = getRecipients(note);

    if (recipients.type === 'workspace') {
        
        io.to(recipients.target).emit('note-updated', note);
    } else {
        
        recipients.target.forEach(userId => {
            io.to(`user_${userId}`).emit('note-shared', note);
        });
    }
}

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

module.exports = {
    notifyNoteCreated,
    notifyNoteUpdated,
    notifyNoteDeleted,
    notifyNoteShared,
    notifyAttachmentAdded
};
