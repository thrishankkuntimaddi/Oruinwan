const _mongoose = require('mongoose');

const Note = require('../../../models/Note');
const _User = require('../../../models/User');
const Workspace = require('../../../models/Workspace');

const { logAction } = require('../../../utils/historyLogger');

async function getNotes(userId, filters = {}) {
    const { workspaceId, type } = filters;

    
    
    
    
    const query = {
        $or: [
            { owner: userId },      
            { sharedWith: userId }  
        ]
    };

    
    if (workspaceId) {
        query.workspace = workspaceId;

        
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace || !workspace.isMember(userId)) {
            const error = new Error('Access denied');
            error.statusCode = 403;
            throw error;
        }
    }

    
    if (type) {
        query.type = type;
    }

    
    const notes = await Note.find(query)
        .populate('owner', 'username profilePicture')
        .populate('sharedWith', 'username profilePicture')
        .sort({ isPinned: -1, updatedAt: -1 })
        .lean();

    return { notes };
}

async function createNote(userId, noteData, io, req) {
    const {
        title,
        content,
        type = 'note',
        workspaceId,
        sharedWith = [],
        tags = []
    } = noteData;

    
    if (!title) {
        const error = new Error('Title is required');
        error.statusCode = 400;
        throw error;
    }

    let companyId = null;
    let workspace = null;

    
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
    } else {
        
        const error = new Error('Workspace ID is required');
        error.statusCode = 400;
        throw error;
    }

    
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

    
    const populatedNote = await Note.findById(note._id)
        .populate('owner', 'username profilePicture')
        .populate('sharedWith', 'username profilePicture');

    
    if (io) {
        if (populatedNote.isPublic && populatedNote.workspace) {
            io.to(`workspace_${populatedNote.workspace}`).emit('note-created', populatedNote);
        } else {
            
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

async function updateNote(userId, noteId, updates, io, _req) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    
    if (note.owner.toString() !== userId) {
        const error = new Error('Only note owner can update');
        error.statusCode = 403;
        throw error;
    }

    
    const allowedFields = [
        'title',
        'content',
        'sharedWith',
        'isPublic',
        'isPinned',
        'isArchived',
        'archivedAt',
        'tags'
    ];

    allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
            note[field] = updates[field];
        }
    });

    await note.save();

    
    const populatedNote = await Note.findById(note._id)
        .populate('owner', 'username profilePicture')
        .populate('sharedWith', 'username profilePicture');

    
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

async function deleteNote(userId, noteId, permanent, io, _req) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    
    if (note.owner.toString() !== userId) {
        const error = new Error('Only note owner can delete');
        error.statusCode = 403;
        throw error;
    }

    if (permanent) {
        
        await Note.findByIdAndDelete(noteId);
        return { message: 'Note permanently deleted' };
    } else {
        
        note.isArchived = true;
        note.archivedAt = new Date();
        await note.save();

        
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

async function shareNote(userId, noteId, userIds, io, req) {
    
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

    
    if (note.owner.toString() !== userId) {
        const error = new Error('Only note owner can share');
        error.statusCode = 403;
        throw error;
    }

    
    userIds.forEach(uid => {
        if (!note.sharedWith.includes(uid)) {
            note.sharedWith.push(uid);
        }
    });

    await note.save();

    
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

    
    const populatedNote = await Note.findById(note._id)
        .populate('owner', 'username profilePicture')
        .populate('sharedWith', 'username profilePicture');

    
    if (io) {
        if (populatedNote.isPublic && populatedNote.workspace) {
            
            io.to(`workspace_${populatedNote.workspace}`).emit('note-updated', populatedNote);
        } else {
            
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

async function addAttachment(userId, noteId, attachmentData, io, _req) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    
    if (!note.canEdit(userId)) {
        const error = new Error('Not authorized to edit this note');
        error.statusCode = 403;
        throw error;
    }

    
    note.attachments.push(attachmentData);
    await note.save();

    
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

async function removeAttachment(userId, noteId, attachmentId, _req) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    
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

    
    try {
        const path = require('path');
        const fs = require('fs');
        const filePath = path.join(__dirname, '../../../', attachment.url);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (_fsErr) {
        
    }

    
    note.attachments.pull({ _id: attachmentId });
    await note.save();

    return { message: 'Attachment deleted successfully' };
}

async function downloadAttachment(userId, noteId, attachmentId) {
    const note = await Note.findById(noteId);
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }

    
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

async function getVersions(userId, noteId) {
    const note = await Note.findById(noteId).select('owner sharedWith versions');
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }
    if (!note.canView(userId)) {
        const error = new Error('Access denied');
        error.statusCode = 403;
        throw error;
    }
    
    return { versions: note.versions || [] };
}

async function saveVersion(userId, noteId, snapshot) {
    const note = await Note.findById(noteId).select('owner');
    if (!note) {
        const error = new Error('Note not found');
        error.statusCode = 404;
        throw error;
    }
    
    if (note.owner.toString() !== userId.toString()) {
        const error = new Error('Access denied');
        error.statusCode = 403;
        throw error;
    }

    const entry = {
        title: snapshot.title || '',
        content: snapshot.content || '',
        savedAt: new Date(),
    };

    
    await Note.findByIdAndUpdate(noteId, {
        $push: {
            versions: {
                $each: [entry],
                $slice: -50,  
            },
        },
    });

    return { version: entry };
}

module.exports = {
    getNotes,
    createNote,
    updateNote,
    deleteNote,
    shareNote,
    addAttachment,
    removeAttachment,
    downloadAttachment,
    getVersions,
    saveVersion,
};
