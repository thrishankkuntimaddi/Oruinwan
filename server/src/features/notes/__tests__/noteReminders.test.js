'use strict';

const oid = (n) => n.toString(16).padStart(24, '0');
const ME = oid(1);
const WS = oid(50);
const NOTE = oid(10);

const lean = (v) => ({ lean: async () => v, select: () => ({ lean: async () => v }) });

jest.mock('../noteReminder.model', () => ({ findOneAndUpdate: jest.fn(), find: jest.fn(), findOneAndDelete: jest.fn() }));
jest.mock('../../../../models/Note', () => ({ findById: jest.fn(), find: jest.fn() }));
jest.mock('../notes.policy', () => ({ assertNoteAccess: jest.fn(async () => true) }));
jest.mock('../../../modules/notifications/notificationService', () => ({ noteReminder: jest.fn(async () => null) }));

const NoteReminder = require('../noteReminder.model');
const Note = require('../../../../models/Note');
const policy = require('../notes.policy');
const notifications = require('../../../modules/notifications/notificationService');
const reminders = require('../noteReminders');

beforeEach(() => jest.clearAllMocks());

test('a reminder on a note I can open, in the future', async () => {
    Note.findById.mockReturnValue({ select: () => ({ lean: async () => ({ _id: NOTE, workspace: WS, title: 'Spec' }) }) });
    const at = new Date(Date.now() + 3600_000);
    NoteReminder.findOneAndUpdate.mockReturnValue(lean({ _id: oid(5), remindAt: at, note: 'Read again' }));
    const r = await reminders.remind(ME, NOTE, { remindAt: at.toISOString(), note: 'Read again' });
    expect(r).toMatchObject({ noteId: NOTE, noteTitle: 'Spec', note: 'Read again' });
    expect(policy.assertNoteAccess).toHaveBeenCalledWith(expect.anything(), ME, 'view');
});

test('a time in the past is refused', async () => {
    await expect(reminders.remind(ME, NOTE, { remindAt: new Date(Date.now() - 1000).toISOString() })).rejects.toMatchObject({ status: 400 });
});

test('due reminders become one notification each, claimed so they never fire twice', async () => {
    NoteReminder.find.mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: 'a', userId: ME, noteId: NOTE, workspaceId: WS, note: '' }, { _id: 'b', userId: ME, noteId: NOTE, workspaceId: WS }] }) }) });
    NoteReminder.findOneAndUpdate.mockResolvedValueOnce({ _id: 'a' }).mockResolvedValueOnce(null); // b was taken by another instance
    Note.findById.mockReturnValue({ select: () => ({ lean: async () => ({ title: 'Spec' }) }) });
    const n = await reminders.fireDue(null);
    expect(n).toBe(1);
    expect(notifications.noteReminder).toHaveBeenCalledWith(null, expect.objectContaining({ recipientId: ME, noteId: NOTE, noteTitle: 'Spec' }));
});
