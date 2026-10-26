'use strict';

const Note = require('../../../models/Note');
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');

const { logAction } = require('../../../utils/historyLogger');
const logger = require('../../../utils/logger');
const {
    isValidId,
    HttpError,
    assertWorkspaceMember,
    memberWorkspaceIds,
} = require('../../shared/utils/workspaceAccess');
const policy = require('./notes.policy');
const notify = require('./notes.notifications');
const { sanitizeNoteContent } = require('./notes.sanitize');

const collab = () => require('../../modules/collab/collab.service');

const NOTE_TYPES = ['note', 'meeting', 'documentation', 'brainstorm', 'sop', 'projectspec', 'techdesign', 'announcement'];
const UNTITLED = 'Untitled';

// Fields only the owner may change. Shared editors (allowEditing) may change title and content only.
const OWNER_FIELDS = ['sharedWith', 'isPublic', 'isPinned', 'isArchived', 'allowEditing', 'allowComments', 'tags', 'type'];

function idOf(v) {
    return String(v?._id || v || '');
}

function normaliseTitle(title) {
    const t = typeof title === 'string' ? title.trim() : '';
    return t || UNTITLED;
}

const NOTE_USERS = {
    owner: { type: 'user', fields: ['username', 'profilePicture'] },
    sharedWith: { type: 'user', fields: ['username', 'profilePicture'] },
};

/** Run a lean note query and attach owner / sharedWith from PostgreSQL. */
async function withUsers(query) {
    const result = await query;
    if (result) await hydrate(result, NOTE_USERS);
    return result;
}

async function loadNote(noteId, select) {
    if (!isValidId(noteId)) throw new HttpError(400, 'Invalid note id');
    let q = Note.findById(noteId);
    if (select) q = q.select(select);
    const note = await q;
    if (!note) throw new HttpError(404, 'Note not found');
    return note;
}

/**
 * Keep only valid ObjectIds of active members of `workspaceId`, excluding the owner.
 * Throws 400 listing the rejected ids when any are invalid or not members.
 */
async function validateShareTargets(workspaceId, ownerId, userIds) {
    const ids = [...new Set((userIds || []).map(idOf))].filter(id => id && id !== String(ownerId));
    const malformed = ids.filter(id => !isValidId(id));
    if (malformed.length) throw new HttpError(400, 'Invalid user id(s) in share list');
    if (!ids.length) return [];
    const { workspace } = await assertWorkspaceMember(idOf(workspaceId), ownerId);
    const active = new Set((workspace.members || [])
        .filter(m => (m.status || 'active') === 'active')
        .map(m => idOf(m.user)));
    const outsiders = ids.filter(id => !active.has(id));
    if (outsiders.length) {
        const err = new HttpError(400, 'Notes can only be shared with active members of this workspace');
        err.errors = outsiders;
        throw err;
    }
    return ids;
}

async function getNotes(userId, filters = {}) {
    const { workspaceId, type } = filters;
    const visibility = [{ owner: userId }, { sharedWith: userId }, { isPublic: true }];
    // The list shows notes (their first page); more pages open from inside the note.
    const query = { $or: visibility, parentNote: null };

    if (workspaceId) {
        await assertWorkspaceMember(workspaceId, userId);
        query.workspace = workspaceId;
    } else {
        // Never return notes from workspaces the caller is not an active member of.
        query.workspace = { $in: await memberWorkspaceIds(userId) };
    }

    if (type) {
        if (typeof type !== 'string' || !NOTE_TYPES.includes(type)) throw new HttpError(400, 'Invalid note type');
        query.type = type;
    }

    const notes = await withUsers(Note.find(query)
        .select('-versions')
        .sort({ isPinned: -1, updatedAt: -1 })
        .lean());

    return { notes };
}

/** The pages of the note `root` heads, in order: [{ _id, title, pageOrder }] (the first page first). */
async function pagesOf(rootId) {
    const rest = await Note.find({ parentNote: rootId }).select('_id title pageOrder').sort({ pageOrder: 1, createdAt: 1 }).lean();
    const root = await Note.findById(rootId).select('_id title').lean();
    return [...(root ? [{ _id: root._id, title: root.title, pageOrder: 0 }] : []), ...rest];
}

async function getNote(userId, noteId) {
    const note = await loadNote(noteId);
    await policy.assertNoteAccess(note, userId, 'view');
    const populated = await withUsers(Note.findById(note._id).select('-versions').lean());
    const rootId = note.parentNote || note._id;
    populated.pages = await pagesOf(rootId);
    return { note: populated };
}

/** Copies the first page's sharing (and archive state) to its other pages. */
async function syncPages(root) {
    await Note.updateMany(
        { parentNote: root._id },
        { $set: { sharedWith: root.sharedWith || [], isPublic: !!root.isPublic, allowEditing: !!root.allowEditing, allowComments: !!root.allowComments, isArchived: !!root.isArchived, archivedAt: root.archivedAt || null } },
    );
}

/** A new page in a note: anyone who may edit the note may add one. It takes the note's sharing. */
async function createPage(userId, parentId, noteData, io, req) {
    const parent = await loadNote(parentId);
    const root = parent.parentNote ? await loadNote(parent.parentNote) : parent;
    await policy.assertNoteAccess(root, userId, policy.isNoteOwner(root, userId) ? 'owner' : 'edit');
    const count = await Note.countDocuments({ parentNote: root._id });
    if (count >= 99) throw new HttpError(409, 'A note can have up to 100 pages');
    const last = await Note.findOne({ parentNote: root._id }).sort({ pageOrder: -1 }).select('pageOrder').lean();
    const page = new Note({
        company: root.company || null,
        workspace: root.workspace,
        owner: root.owner,
        title: normaliseTitle(noteData.title || `Page ${count + 2}`),
        content: sanitizeNoteContent(noteData.content || ''),
        type: root.type,
        sharedWith: root.sharedWith || [],
        isPublic: !!root.isPublic,
        allowEditing: !!root.allowEditing,
        allowComments: !!root.allowComments,
        meeting: root.meeting || null,
        parentNote: root._id,
        pageOrder: (last?.pageOrder || 0) + 1,
    });
    await page.save();
    await logAction({ userId, action: 'note_page_created', description: `Added a page to: ${root.title}`, resourceType: 'note', resourceId: root._id, companyId: root.company || null, metadata: { pageId: String(page._id) }, req });
    const populated = await withUsers(Note.findById(page._id).lean());
    populated.pages = await pagesOf(root._id);
    notify.notifyNoteUpdated(await withUsers(Note.findById(root._id).lean()), io);
    return { message: 'Page added', note: populated };
}

async function createNote(userId, noteData, io, req) {
    if (noteData.parentNoteId) {
        if (!isValidId(noteData.parentNoteId)) throw new HttpError(400, 'Invalid parent note id');
        return createPage(userId, noteData.parentNoteId, noteData, io, req);
    }
    const {
        content,
        type = 'note',
        workspaceId,
        sharedWith = [],
        tags = [],
        isPublic,
        allowEditing,
    } = noteData;

    if (!workspaceId) throw new HttpError(400, 'Workspace ID is required');
    const { workspace } = await assertWorkspaceMember(workspaceId, userId);

    const title = normaliseTitle(noteData.title);
    const shareIds = await validateShareTargets(workspaceId, userId, sharedWith);

    const note = new Note({
        company: workspace.company || null,
        workspace: workspaceId,
        owner: userId,
        title,
        content: sanitizeNoteContent(content || ''),
        type,
        sharedWith: shareIds,
        tags,
        isPublic: isPublic === true,
        allowEditing: allowEditing === true,
        templateKey: require('../../shared/plans/planService').templateKeyFor(noteData.templateId),
    });

    await note.save();

    await logAction({
        userId,
        action: 'note_created',
        description: `Created note: ${title}`,
        resourceType: 'note',
        resourceId: note._id,
        companyId: workspace.company || null,
        metadata: { type, workspaceId },
        req
    });

    const populatedNote = await withUsers(Note.findById(note._id).lean());
    notify.notifyNoteCreated(populatedNote, io);

    return {
        message: 'Note created successfully',
        note: populatedNote
    };
}

async function updateNote(userId, noteId, updates, io, _req) {
    const note = await loadNote(noteId);
    const isOwner = policy.isNoteOwner(note, userId);
    await policy.assertNoteAccess(note, userId, isOwner ? 'owner' : 'edit');

    if (!isOwner) {
        const forbidden = OWNER_FIELDS.filter(f => updates[f] !== undefined);
        if (forbidden.length) {
            throw new HttpError(403, `Only the note owner can change: ${forbidden.join(', ')}`);
        }
    }

    const wasPublic = !!note.isPublic;
    const previousShared = (note.sharedWith || []).map(idOf);

    if (updates.title !== undefined) note.title = normaliseTitle(updates.title);
    if (updates.content !== undefined) note.content = sanitizeNoteContent(updates.content);
    if (updates.pageOrder !== undefined && note.parentNote && Number.isFinite(Number(updates.pageOrder))) note.pageOrder = Number(updates.pageOrder);

    if (isOwner) {
        if (updates.sharedWith !== undefined) {
            note.sharedWith = await validateShareTargets(note.workspace, userId, updates.sharedWith);
        }
        ['isPublic', 'isPinned', 'allowEditing', 'allowComments'].forEach(f => {
            if (updates[f] !== undefined) note[f] = updates[f] === true;
        });
        if (updates.tags !== undefined) note.tags = updates.tags;
        if (updates.type !== undefined) {
            if (!NOTE_TYPES.includes(updates.type)) throw new HttpError(400, 'Invalid note type');
            note.type = updates.type;
        }
        if (updates.isArchived !== undefined) {
            note.isArchived = updates.isArchived === true;
            note.archivedAt = note.isArchived ? new Date() : null;
        }
    }

    await note.save();
    if (!note.parentNote && isOwner) await syncPages(note);
    // Keep an open live editor (and its stored Yjs state) in step with this write.
    if (updates.content !== undefined) await collab().contentChanged('note', note._id, note.content, { workspaceId: idOf(note.workspace) });

    const populatedNote = await withUsers(Note.findById(note._id).lean());
    const nowShared = new Set((note.sharedWith || []).map(idOf));
    const removed = previousShared.filter(id => !nowShared.has(id));
    notify.notifyVisibilityChange(io, populatedNote, { wasPublic, removedUserIds: removed });
    notify.notifyNoteUpdated(populatedNote, io);

    return {
        message: 'Note updated successfully',
        note: populatedNote
    };
}

async function deleteObjectForAttachment(note, attachment) {
    const objectPath = attachmentObjectPath(attachment, note.workspace);
    if (!objectPath) return;
    try {
        await require('../../modules/uploads/upload.service').deleteObject(objectPath);
    } catch (err) {
        logger.warn({ err: err.message, objectPath }, '[notes] failed to delete attachment object');
    }
}

async function deleteNote(userId, noteId, permanent, io, _req) {
    const note = await loadNote(noteId);
    await policy.assertNoteAccess(note, userId, 'owner');

    if (permanent) {
        // Deleting a note deletes its pages too.
        if (!note.parentNote) {
            const pages = await Note.find({ parentNote: note._id }).select('_id').lean();
            await Note.deleteMany({ parentNote: note._id });
            await Promise.all(pages.map((p) => collab().documentDeleted('note', p._id)));
        }
        await Note.findByIdAndDelete(note._id);
        await collab().documentDeleted('note', note._id);
        await Promise.all((note.attachments || []).map(a => deleteObjectForAttachment(note, a)));
        notify.notifyNoteDeleted(note._id, note, io, { permanent: true });
        return { message: 'Note permanently deleted', permanent: true };
    }

    note.isArchived = true;
    note.archivedAt = new Date();
    await note.save();
    if (!note.parentNote) await syncPages(note);
    notify.notifyNoteDeleted(note._id, note, io, { archived: true });
    return { message: 'Note archived', archived: true };
}

/**
 * Share a note. Body: { userIds: string[], allowEditing?: boolean }
 *   userIds       ids of ACTIVE members of the note's workspace to add to sharedWith
 *                 (may be empty when only allowEditing is being changed)
 *   allowEditing  per-note flag: when true every user in sharedWith may edit title/content
 */
async function shareNote(userId, noteId, userIds, io, req, options = {}) {
    const { allowEditing } = options;
    if (!Array.isArray(userIds)) throw new HttpError(400, 'userIds must be an array');
    if (userIds.length === 0 && allowEditing === undefined) throw new HttpError(400, 'userIds must be a non-empty array');
    if (allowEditing !== undefined && typeof allowEditing !== 'boolean') throw new HttpError(400, 'allowEditing must be a boolean');

    const note = await loadNote(noteId);
    await policy.assertNoteAccess(note, userId, 'owner');

    const ids = await validateShareTargets(note.workspace, userId, userIds);
    const existing = new Set((note.sharedWith || []).map(idOf));
    const added = ids.filter(id => !existing.has(id));
    added.forEach(id => note.sharedWith.push(id));
    if (allowEditing !== undefined) note.allowEditing = allowEditing;

    await note.save();
    if (!note.parentNote) await syncPages(note);

    await logAction({
        userId,
        action: 'note_shared',
        description: `Shared note: ${note.title}`,
        resourceType: 'note',
        resourceId: note._id,
        companyId: note.company,
        metadata: { sharedWith: added, allowEditing: note.allowEditing },
        req
    });

    const populatedNote = await withUsers(Note.findById(note._id).lean());
    notify.notifyNoteShared(populatedNote, io);

    const recipientIds = added.filter(id => id !== String(userId) && id !== idOf(note.owner));
    if (recipientIds.length && populatedNote.workspace) {
        let sharerUsername = populatedNote.owner?.username;
        if (!sharerUsername) {
            const u = await identity.users.findById(userId).catch(() => null);
            sharerUsername = u?.username;
        }
        const notificationService = require('../../modules/notifications/notificationService');
        notificationService.noteShared(io, {
            recipientIds,
            sharerUsername: sharerUsername || 'Someone',
            workspaceId: populatedNote.workspace,
            noteTitle: note.title || 'Untitled note',
            noteId: String(note._id),
        }).catch(() => {});
    }

    return {
        message: 'Note shared successfully',
        note: populatedNote
    };
}

/**
 * Stored attachment URLs look like `/api/v2/uploads/file?path=notes/<workspaceId>/<date>/<uuid><ext>`
 * (see src/shared/upload/upload.controller.js). Returns the object path only when it is
 * inside this note's workspace folder and contains no traversal; otherwise null.
 */
function attachmentObjectPath(attachment, workspaceId) {
    const url = typeof attachment?.url === 'string' ? attachment.url : '';
    const prefix = '/api/v2/uploads/file?path=';
    if (!url.startsWith(prefix)) return null;
    let objectPath;
    try {
        objectPath = decodeURIComponent(url.slice(prefix.length));
    } catch {
        return null;
    }
    const ws = idOf(workspaceId);
    if (!isValidId(ws)) return null;
    const re = new RegExp(`^notes/${ws}/\\d{4}-\\d{2}-\\d{2}/[A-Za-z0-9-]{8,64}(\\.[A-Za-z0-9_-]{1,16})?$`);
    if (!re.test(objectPath)) return null;
    return objectPath;
}

async function addAttachment(userId, noteId, attachmentData, io, _req) {
    const note = await loadNote(noteId);
    await policy.assertNoteAccess(note, userId, 'edit');

    if (!attachmentObjectPath(attachmentData, note.workspace)) {
        throw new HttpError(400, 'Attachment url must be a file uploaded to this workspace via /api/upload/note-attachment');
    }

    const attachment = {
        name: String(attachmentData.name).slice(0, 255),
        url: attachmentData.url,
        type: String(attachmentData.type).slice(0, 255),
        size: attachmentData.size,
        category: attachmentData.category,
        uploadedBy: userId,
        uploadedAt: new Date(),
    };
    note.attachments.push(attachment);
    await note.save();
    const saved = note.attachments[note.attachments.length - 1];

    notify.notifyAttachmentAdded(note._id, saved, note, io);

    return {
        message: 'Attachment added successfully',
        attachment: saved
    };
}

async function removeAttachment(userId, noteId, attachmentId, _req) {
    if (!isValidId(attachmentId)) throw new HttpError(400, 'Invalid attachment id');
    const note = await loadNote(noteId);
    await policy.assertNoteAccess(note, userId, 'edit');

    const attachment = note.attachments.id(attachmentId);
    if (!attachment) throw new HttpError(404, 'Attachment not found');

    // Only delete the stored object when it is a note upload of this workspace that
    // no other note still references.
    const objectPath = attachmentObjectPath(attachment, note.workspace);
    note.attachments.pull({ _id: attachmentId });
    await note.save();
    if (objectPath) {
        const stillUsed = await Note.exists({ _id: { $ne: note._id }, 'attachments.url': attachment.url });
        if (!stillUsed) await deleteObjectForAttachment(note, attachment);
    }

    return { message: 'Attachment deleted successfully' };
}

/** Returns { objectPath, fileName } for streaming via the upload service. */
async function downloadAttachment(userId, noteId, attachmentId) {
    if (!isValidId(attachmentId)) throw new HttpError(400, 'Invalid attachment id');
    const note = await loadNote(noteId);
    await policy.assertNoteAccess(note, userId, 'view');

    const attachment = note.attachments.id(attachmentId);
    if (!attachment) throw new HttpError(404, 'Attachment not found');

    const objectPath = attachmentObjectPath(attachment, note.workspace);
    if (!objectPath) throw new HttpError(404, 'Attachment file is not available');

    return { objectPath, fileName: attachment.name };
}

async function getVersions(userId, noteId) {
    const note = await loadNote(noteId, 'owner sharedWith isPublic allowEditing workspace versions');
    await policy.assertNoteAccess(note, userId, 'view');
    return { versions: note.versions || [] };
}

async function saveVersion(userId, noteId, snapshot) {
    const note = await loadNote(noteId, 'owner sharedWith allowEditing workspace');
    await policy.assertNoteAccess(note, userId, 'edit');

    const entry = {
        title: typeof snapshot.title === 'string' ? snapshot.title.slice(0, 500) : '',
        content: sanitizeNoteContent(typeof snapshot.content === 'string' ? snapshot.content : ''),
        savedAt: new Date(),
    };

    await Note.findByIdAndUpdate(note._id, {
        $push: {
            versions: {
                $each: [entry],
                $slice: -50,
            },
        },
    });

    return { version: entry };
}

/**
 * "Make a task" from a note: anyone who can see the note (and is in its workspace)
 * may. The task links to the note (linkedNote) and the note to the task (linkedTaskId);
 * a second attempt answers 409 with the existing task's id.
 */
async function makeTask(userId, noteId, taskData = {}, io) {
    const note = await loadNote(noteId, 'title workspace company owner sharedWith isPublic allowEditing channel linkedTaskId');
    await policy.assertNoteAccess(note, userId, 'view');
    const title = note.title || UNTITLED;
    const data = { ...taskData };
    if (typeof data.description !== 'string' || !data.description.trim()) data.description = `From note: ${title}`;
    const linked = require('../tasks/tasks.linked');
    const task = await linked.createLinkedTask({
        userId,
        source: {
            kind: 'note', id: note._id, title, workspaceId: note.workspace, companyId: note.company,
            channel: note.channel, linkedTaskId: note.linkedTaskId,
        },
        taskData: data,
        // Only link while the note still points where we checked (nothing, or a deleted task).
        claim: async (t) => {
            const r = await Note.updateOne({ _id: note._id, linkedTaskId: note.linkedTaskId || null }, { $set: { linkedTaskId: t._id } });
            return (r.modifiedCount ?? r.nModified ?? 0) > 0;
        },
        io,
    });
    if (io && note.workspace) {
        io.to(`workspace_${idOf(note.workspace)}`).emit('note:task_created', { noteId: idOf(note._id), taskId: idOf(task._id), taskTitle: task.title });
    }
    return { task: linked.briefTask(task) };
}

module.exports = {
    makeTask,
    createPage,
    pagesOf,
    getNotes,
    getNote,
    createNote,
    updateNote,
    deleteNote,
    shareNote,
    addAttachment,
    removeAttachment,
    downloadAttachment,
    getVersions,
    saveVersion,
    attachmentObjectPath,
    UNTITLED,
};
