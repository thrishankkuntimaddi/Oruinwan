'use strict';

/**
 * "Make a task" from a note or a library file (tasks.linked.js through
 * notes.service.makeTask and files.service.makeTask). Models and the task store are
 * mocked; note / file access rules run for real.
 */

jest.mock('../../../../utils/historyLogger', () => ({ logAction: jest.fn().mockResolvedValue() }));
jest.mock('../../../modules/notifications/notificationService', () => ({ noteShared: jest.fn().mockResolvedValue() }));
jest.mock('../../../modules/uploads/upload.service', () => ({ deleteObject: jest.fn().mockResolvedValue(), streamGCSFile: jest.fn() }));
jest.mock('../tasks.query', () => ({
    create: jest.fn(),
    findById: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({}),
    logActivity: jest.fn().mockResolvedValue({}),
}));

const mongoose = require('mongoose');
const Note = require('../../../../models/Note');
const WorkspaceFile = require('../../files/WorkspaceFile');
const identity = require('../../../identity');
const plans = require('../../../shared/plans/planService');
const shared = require('../tasks.shared');
const Tasks = require('../tasks.query');
const notesService = require('../../notes/notes.service');
const filesService = require('../../files/files.service');

const oid = () => new mongoose.Types.ObjectId().toString();
const WS = oid();
const ALICE = oid(); // note owner
const BOB = oid(); // member
const CAROL = oid(); // not a member
const NOTE = oid();
const FILE = oid();
const TASK = oid();

const workspace = {
    _id: WS,
    name: 'Acme',
    members: [
        { user: ALICE, role: 'owner', status: 'active' },
        { user: BOB, role: 'member', status: 'active' },
    ],
};

function chain(value) {
    const q = {
        select: () => q, populate: () => q, sort: () => q, lean: () => q,
        then: (res, rej) => Promise.resolve(value).then(res, rej),
        catch: (rej) => Promise.resolve(value).catch(rej),
    };
    return q;
}

function io() {
    const emit = jest.fn();
    return { to: jest.fn(() => ({ emit })), emit };
}

let note;
let file;
beforeEach(() => {
    jest.restoreAllMocks();
    Tasks.create.mockReset().mockImplementation(async (data) => ({ _id: TASK, issueKey: 'ACM-7', ...data }));
    Tasks.findById.mockReset().mockResolvedValue(null);
    Tasks.deleteMany.mockClear();
    Tasks.logActivity.mockClear();
    jest.spyOn(identity.workspaces, 'findById').mockImplementation(async (id) => (String(id) === WS ? workspace : null));
    jest.spyOn(identity.workspaces, 'listMembers').mockResolvedValue([]);
    jest.spyOn(identity.users, 'findById').mockResolvedValue({ _id: ALICE, username: 'alice' });
    jest.spyOn(plans, 'assertCanCreateTasks').mockResolvedValue();
    jest.spyOn(shared, 'loadTaskForClient').mockResolvedValue({ _id: TASK, title: 'x' });

    note = { _id: NOTE, title: 'Launch plan', workspace: WS, owner: ALICE, sharedWith: [], isPublic: false, linkedTaskId: null };
    jest.spyOn(Note, 'findById').mockImplementation(() => chain(note));
    jest.spyOn(Note, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    file = { _id: FILE, name: 'budget.xlsx', url: '/api/v2/uploads/file?p=x', mimeType: 'application/vnd.ms-excel', size: 10, workspaceId: WS, createdBy: ALICE, access: 'workspace', permissions: [], isDeleted: false, linkedTaskId: null };
    jest.spyOn(WorkspaceFile, 'findById').mockImplementation(() => chain(file));
    jest.spyOn(WorkspaceFile, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
});

describe('notes → task', () => {
    test('creates a task linked to the note and links the note back', async () => {
        const sock = io();
        const { task } = await notesService.makeTask(ALICE, NOTE, { title: 'Launch plan', priority: 'urgent' }, sock);

        expect(task).toMatchObject({ _id: TASK, issueKey: 'ACM-7', title: 'Launch plan', priority: 'highest' });
        const data = Tasks.create.mock.calls[0][0];
        expect(data).toMatchObject({ linkedNote: NOTE, linkedFile: null, workspace: WS, createdBy: ALICE, assignedTo: [ALICE], visibility: 'private' });
        expect(data.description).toBe('From note: Launch plan');
        expect(Note.updateOne).toHaveBeenCalledWith({ _id: NOTE, linkedTaskId: null }, { $set: { linkedTaskId: TASK } });
        expect(Tasks.logActivity).toHaveBeenCalledWith(expect.objectContaining({
            task: TASK, action: 'created', metadata: expect.objectContaining({ source: 'note', noteId: NOTE }),
        }));
        expect(sock.to).toHaveBeenCalledWith(`workspace_${WS}`);
        expect(sock.emit).toHaveBeenCalledWith('note:task_created', { noteId: NOTE, taskId: TASK, taskTitle: 'Launch plan' });
        expect(sock.emit).toHaveBeenCalledWith('task-created', expect.anything());
    });

    test('a second attempt answers 409 with the existing task', async () => {
        note.linkedTaskId = TASK;
        Tasks.findById.mockResolvedValue({ _id: TASK });
        await expect(notesService.makeTask(ALICE, NOTE, { title: 'Again' })).rejects.toMatchObject({ statusCode: 409, taskId: TASK });
        expect(Tasks.create).not.toHaveBeenCalled();
    });

    test('a link to a permanently deleted task does not block a new one', async () => {
        const gone = oid();
        note.linkedTaskId = gone;
        await notesService.makeTask(ALICE, NOTE, { title: 'Again' });
        expect(Note.updateOne).toHaveBeenCalledWith({ _id: NOTE, linkedTaskId: gone }, { $set: { linkedTaskId: TASK } });
    });

    test('losing a race drops the new task and answers 409', async () => {
        Note.updateOne.mockResolvedValue({ modifiedCount: 0 });
        await expect(notesService.makeTask(ALICE, NOTE, { title: 'Race' })).rejects.toMatchObject({ statusCode: 409 });
        expect(Tasks.deleteMany).toHaveBeenCalledWith({ _id: TASK });
    });

    test('a member who cannot see a private note is refused', async () => {
        await expect(notesService.makeTask(BOB, NOTE, { title: 'Nope' })).rejects.toMatchObject({ statusCode: 403 });
        expect(Tasks.create).not.toHaveBeenCalled();
    });

    test('someone outside the workspace is refused', async () => {
        note.isPublic = true;
        await expect(notesService.makeTask(CAROL, NOTE, { title: 'Nope' })).rejects.toMatchObject({ statusCode: 403 });
    });

    test('a member can make a task from a note shared with them', async () => {
        note.sharedWith = [BOB];
        await notesService.makeTask(BOB, NOTE, { title: 'Shared', assigneeIds: [ALICE, BOB] });
        expect(Tasks.create.mock.calls[0][0]).toMatchObject({ createdBy: BOB, assignedTo: [ALICE, BOB] });
    });

    test('assignees must be workspace members', async () => {
        await expect(notesService.makeTask(ALICE, NOTE, { title: 'x', assigneeIds: [CAROL] })).rejects.toMatchObject({ statusCode: 400 });
    });

    test('a title is required', async () => {
        await expect(notesService.makeTask(ALICE, NOTE, { title: '  ' })).rejects.toMatchObject({ statusCode: 400 });
    });

    test('the plan task limit applies', async () => {
        plans.assertCanCreateTasks.mockRejectedValue(Object.assign(new Error('Task limit reached'), { code: 'PLAN_LIMIT', statusCode: 403 }));
        await expect(notesService.makeTask(ALICE, NOTE, { title: 'Over' })).rejects.toMatchObject({ code: 'PLAN_LIMIT' });
        expect(Tasks.create).not.toHaveBeenCalled();
        expect(Note.updateOne).not.toHaveBeenCalled();
    });
});

describe('files → task', () => {
    test('creates a task with the file attached and links the file back', async () => {
        const sock = io();
        const { task } = await filesService.makeTask(BOB, FILE, { title: 'budget' }, sock);

        expect(task).toMatchObject({ _id: TASK, title: 'budget' });
        const data = Tasks.create.mock.calls[0][0];
        expect(data).toMatchObject({ linkedFile: FILE, linkedNote: null, workspace: WS, createdBy: BOB, description: 'From file: budget.xlsx' });
        expect(data.attachments).toEqual([expect.objectContaining({ name: 'budget.xlsx', url: file.url, fileId: FILE })]);
        expect(WorkspaceFile.updateOne).toHaveBeenCalledWith({ _id: FILE, linkedTaskId: null }, { $set: { linkedTaskId: TASK } });
        expect(Tasks.logActivity).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ source: 'file', fileId: FILE }) }));
        expect(sock.emit).toHaveBeenCalledWith('file:task_created', { fileId: FILE, taskId: TASK, taskTitle: 'budget' });
    });

    test('a second attempt answers 409', async () => {
        file.linkedTaskId = TASK;
        Tasks.findById.mockResolvedValue({ _id: TASK });
        await expect(filesService.makeTask(ALICE, FILE, { title: 'x' })).rejects.toMatchObject({ statusCode: 409, taskId: TASK });
    });

    test('a restricted file the caller is not on answers 404', async () => {
        file.access = 'restricted';
        await expect(filesService.makeTask(BOB, FILE, { title: 'x' })).rejects.toMatchObject({ statusCode: 404 });
        expect(Tasks.create).not.toHaveBeenCalled();
    });

    test('someone outside the workspace is refused', async () => {
        await expect(filesService.makeTask(CAROL, FILE, { title: 'x' })).rejects.toMatchObject({ statusCode: 403 });
    });

    test('the plan task limit applies', async () => {
        plans.assertCanCreateTasks.mockRejectedValue(Object.assign(new Error('Task limit reached'), { code: 'PLAN_LIMIT', statusCode: 403 }));
        await expect(filesService.makeTask(ALICE, FILE, { title: 'x' })).rejects.toMatchObject({ code: 'PLAN_LIMIT' });
        expect(WorkspaceFile.updateOne).not.toHaveBeenCalled();
    });
});

describe('unlinkSources', () => {
    test('clears note and file links to deleted tasks', async () => {
        const n = jest.spyOn(Note, 'updateMany').mockResolvedValue({});
        const f = jest.spyOn(WorkspaceFile, 'updateMany').mockResolvedValue({});
        await require('../tasks.linked').unlinkSources([TASK]);
        expect(n).toHaveBeenCalledWith({ linkedTaskId: { $in: [TASK] } }, { $set: { linkedTaskId: null } });
        expect(f).toHaveBeenCalledWith({ linkedTaskId: { $in: [TASK] } }, { $set: { linkedTaskId: null } });
    });
});
