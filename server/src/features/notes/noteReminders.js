'use strict';

// Note reminders (docs/api/conversation-prefs.md → Notes).
//   POST   /api/v2/notes/:id/remind      { remindAt, note? }  → { reminder }   (one per person per note)
//   GET    /api/v2/notes/reminders?workspaceId=               → { reminders: [{ id, noteId, noteTitle, remindAt, note }] }
//   DELETE /api/v2/notes/reminders/:id
// Due reminders become a 'note_reminder' notification (Activity, plus a phone push).

const NoteReminder = require('./noteReminder.model');
const Note = require('../../../models/Note');
const policy = require('./notes.policy');
const { isValidId, HttpError } = require('../../shared/utils/workspaceAccess');

async function remind(userId, noteId, { remindAt, note = '' } = {}) {
    if (!isValidId(noteId)) throw new HttpError(400, 'Invalid note id');
    const when = new Date(remindAt);
    if (Number.isNaN(when.getTime()) || when.getTime() <= Date.now()) throw new HttpError(400, 'Pick a time in the future');
    const doc = await Note.findById(noteId).select('owner workspace isPublic sharedWith allowEditing meeting title').lean();
    if (!doc) throw new HttpError(404, 'Note not found');
    await policy.assertNoteAccess(doc, userId, 'view');
    const r = await NoteReminder.findOneAndUpdate(
        { userId, noteId },
        { $set: { remindAt: when, note: String(note || '').trim().slice(0, 300), delivered: false, deliveredAt: null, workspaceId: doc.workspace } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();
    return { id: String(r._id), noteId: String(noteId), noteTitle: doc.title, remindAt: r.remindAt, note: r.note };
}

async function list(userId, workspaceId) {
    const q = { userId, delivered: false };
    if (workspaceId) {
        if (!isValidId(workspaceId)) throw new HttpError(400, 'Invalid workspace');
        q.workspaceId = workspaceId;
    }
    const rows = await NoteReminder.find(q).sort({ remindAt: 1 }).lean();
    const titles = new Map((await Note.find({ _id: { $in: rows.map((r) => r.noteId) } }).select('title').lean()).map((n) => [String(n._id), n.title]));
    return rows.map((r) => ({ id: String(r._id), noteId: String(r.noteId), noteTitle: titles.get(String(r.noteId)) || 'Note', remindAt: r.remindAt, note: r.note }));
}

async function cancel(userId, id) {
    if (!isValidId(id)) throw new HttpError(404, 'Reminder not found');
    const r = await NoteReminder.findOneAndDelete({ _id: id, userId });
    if (!r) throw new HttpError(404, 'Reminder not found');
    return { ok: true };
}

/** The job: due reminders → notifications. Claimed one by one so nothing fires twice. */
async function fireDue(io, now = new Date()) {
    const due = await NoteReminder.find({ delivered: false, remindAt: { $lte: now } }).sort({ remindAt: 1 }).limit(200).lean();
    let fired = 0;
    for (const r of due) {
        const claimed = await NoteReminder.findOneAndUpdate({ _id: r._id, delivered: false }, { $set: { delivered: true, deliveredAt: now } });
        if (!claimed) continue;
        const note = await Note.findById(r.noteId).select('title').lean();
        if (!note) continue;
        await require('../../modules/notifications/notificationService').noteReminder(io, {
            recipientId: String(r.userId), workspaceId: String(r.workspaceId), noteId: String(r.noteId), noteTitle: note.title || 'Note', text: r.note,
        }).catch(() => {});
        fired += 1;
    }
    return fired;
}

module.exports = { remind, list, cancel, fireDue };
