'use strict';

const mongoose = require('mongoose');

/** "Remind me about this note" at a time: a notification (and phone push) for that person. */
const NoteReminderSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', required: true },
        workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
        remindAt: { type: Date, required: true, index: true },
        note: { type: String, default: '' },
        delivered: { type: Boolean, default: false, index: true },
        deliveredAt: { type: Date, default: null },
    },
    { timestamps: true }
);
NoteReminderSchema.index({ userId: 1, noteId: 1 }, { unique: true });

module.exports = mongoose.models.NoteReminder || mongoose.model('NoteReminder', NoteReminderSchema);
