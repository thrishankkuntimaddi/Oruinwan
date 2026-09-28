'use strict';

jest.mock('../../../../utils/historyLogger', () => ({ logAction: jest.fn().mockResolvedValue() }));
jest.mock('../../../modules/notifications/notificationService', () => ({ noteShared: jest.fn().mockResolvedValue() }));
jest.mock('../../../modules/uploads/upload.service', () => ({ deleteObject: jest.fn().mockResolvedValue(), streamGCSFile: jest.fn() }));

const mongoose = require('mongoose');
const Note = require('../../../../models/Note');
const Workspace = require('../../../../models/Workspace');
const User = require('../../../../models/User');
const notificationService = require('../../../modules/notifications/notificationService');
const uploadService = require('../../../modules/uploads/upload.service');
const service = require('../notes.service');
const notify = require('../notes.notifications');
const { sanitizeNoteContent } = require('../notes.sanitize');

const oid = () => new mongoose.Types.ObjectId().toString();
const WS = oid();
const ALICE = oid(); // owner
const BOB = oid(); // member
const DAVE = oid(); // member
const CAROL = oid(); // not a member
const SUSPENDED = oid();

const workspace = {
    _id: WS,
    members: [
        { user: ALICE, role: 'owner', status: 'active' },
        { user: BOB, role: 'member', status: 'active' },
        { user: DAVE, role: 'member', status: 'active' },
        { user: SUSPENDED, role: 'member', status: 'suspended' },
    ],
};

function chain(value) {
    const q = {
        populate: () => q, select: () => q, sort: () => q, lean: () => q,
        then: (res, rej) => Promise.resolve(value).then(res, rej),
        catch: (rej) => Promise.resolve(value).catch(rej),
    };
    return q;
}

function makeNote(fields = {}) {
    const doc = new Note({ workspace: WS, owner: ALICE, title: 'T', content: '', ...fields });
    doc.save = jest.fn().mockResolvedValue(doc);
    return doc;
}

let findSpy;
beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(Workspace, 'findOne').mockImplementation(({ _id }) => chain(String(_id) === WS ? workspace : null));
    jest.spyOn(Workspace, 'find').mockImplementation(() => chain([{ _id: WS }]));
    findSpy = jest.spyOn(Note, 'find').mockImplementation(() => chain([]));
    jest.spyOn(User, 'findById').mockImplementation(() => chain({ username: 'alice' }));
});

function withNote(doc) {
    jest.spyOn(Note, 'findById').mockImplementation(() => chain(doc));
    return doc;
}

const io = () => {
    const emits = [];
    const room = (r) => ({
        emit: (e, p) => emits.push({ room: r, e, p }),
        except: () => ({ emit: (e, p) => emits.push({ room: r, e, p, except: true }) }),
    });
    return { to: room, emits };
};

describe('NO1 attachment schema', () => {
    test('attachments are subdocuments with a `type` field, not strings', () => {
        const n = new Note({
            workspace: WS, owner: ALICE, title: 'a',
            attachments: [{ name: 'a.png', url: '/u', type: 'image/png', size: 3, category: 'image' }],
        });
        expect(n.attachments[0].type).toBe('image/png');
        expect(n.attachments[0].name).toBe('a.png');
        expect(n.attachments[0]._id).toBeDefined();
    });

    test('attachmentObjectPath rejects traversal and foreign workspaces', () => {
        const ok = `/api/v2/uploads/file?path=${encodeURIComponent(`notes/${WS}/2026-09-28/1b2c3d4e-aaaa-bbbb-cccc-111122223333.png`)}`;
        expect(service.attachmentObjectPath({ url: ok }, WS)).toMatch(/^notes\//);
        expect(service.attachmentObjectPath({ url: `/api/v2/uploads/file?path=${encodeURIComponent(`notes/${WS}/../../etc/passwd`)}` }, WS)).toBeNull();
        expect(service.attachmentObjectPath({ url: '/../../../.env' }, WS)).toBeNull();
        expect(service.attachmentObjectPath({ url: ok }, oid())).toBeNull();
    });

    test('download refuses a legacy/traversal url with 404, never builds a disk path', async () => {
        const n = withNote(makeNote({ attachments: [{ name: 'x', url: '../../server.js', type: 't', size: 1, category: 'document' }] }));
        await expect(service.downloadAttachment(ALICE, String(n._id), String(n.attachments[0]._id)))
            .rejects.toMatchObject({ status: 404 });
    });

    test('addAttachment requires an uploaded note file of this workspace', async () => {
        const n = withNote(makeNote());
        await expect(service.addAttachment(ALICE, String(n._id), { name: 'x', url: '/etc/passwd', type: 't', size: 1, category: 'document' }))
            .rejects.toMatchObject({ status: 400 });
    });

    test('removeAttachment deletes the stored object by path', async () => {
        const url = `/api/v2/uploads/file?path=${encodeURIComponent(`notes/${WS}/2026-09-28/1b2c3d4e-aaaa-bbbb-cccc-111122223333.png`)}`;
        const n = withNote(makeNote({ attachments: [{ name: 'x', url, type: 'image/png', size: 1, category: 'image' }] }));
        jest.spyOn(Note, 'exists').mockResolvedValue(null);
        await service.removeAttachment(ALICE, String(n._id), String(n.attachments[0]._id));
        expect(uploadService.deleteObject).toHaveBeenCalledWith(`notes/${WS}/2026-09-28/1b2c3d4e-aaaa-bbbb-cccc-111122223333.png`);
        expect(n.attachments).toHaveLength(0);
    });
});

describe('NO2/NO3 visibility', () => {
    test('getNotes with workspaceId includes public notes, requires membership', async () => {
        await service.getNotes(BOB, { workspaceId: WS });
        const q = findSpy.mock.calls[0][0];
        expect(q.workspace).toBe(WS);
        expect(q.$or).toEqual(expect.arrayContaining([{ isPublic: true }, { owner: BOB }, { sharedWith: BOB }]));
        await expect(service.getNotes(CAROL, { workspaceId: WS })).rejects.toMatchObject({ status: 403 });
        await expect(service.getNotes(SUSPENDED, { workspaceId: WS })).rejects.toMatchObject({ status: 403 });
        await expect(service.getNotes(BOB, { workspaceId: 'bad' })).rejects.toMatchObject({ status: 400 });
    });

    test('getNotes without workspaceId is limited to member workspaces', async () => {
        await service.getNotes(BOB, {});
        expect(findSpy.mock.calls[0][0].workspace).toEqual({ $in: [WS] });
    });

    test('public note visible to members only', async () => {
        const n = withNote(makeNote({ isPublic: true }));
        await expect(service.getNote(BOB, String(n._id))).resolves.toBeDefined();
        await expect(service.getNote(CAROL, String(n._id))).rejects.toMatchObject({ status: 403 });
        expect(n.canView(CAROL, { isWorkspaceMember: false })).toBe(false);
        expect(n.canView(BOB, { isWorkspaceMember: true })).toBe(true);
    });

    test('private note hidden from unshared members', async () => {
        const n = withNote(makeNote());
        await expect(service.getNote(BOB, String(n._id))).rejects.toMatchObject({ status: 403 });
    });

    test('malformed / missing note id', async () => {
        await expect(service.getNote(BOB, 'nope')).rejects.toMatchObject({ status: 400 });
        jest.spyOn(Note, 'findById').mockImplementation(() => chain(null));
        await expect(service.getNote(BOB, oid())).rejects.toMatchObject({ status: 404 });
    });

    test('socket events for public notes go to workspace:<id>', () => {
        const s = io();
        notify.notifyNoteCreated({ _id: 'n', workspace: WS, isPublic: true, owner: ALICE, sharedWith: [] }, s);
        expect(s.emits[0].room).toBe(`workspace:${WS}`);
    });
});

describe('NO3 sharing', () => {
    test('only active workspace members can be shared with', async () => {
        const n = withNote(makeNote());
        await expect(service.shareNote(ALICE, String(n._id), [CAROL], null, {})).rejects.toMatchObject({ status: 400 });
        await expect(service.shareNote(ALICE, String(n._id), [SUSPENDED], null, {})).rejects.toMatchObject({ status: 400 });
        await expect(service.shareNote(ALICE, String(n._id), ['bad'], null, {})).rejects.toMatchObject({ status: 400 });
        expect(n.save).not.toHaveBeenCalled();
    });

    test('non-owner cannot share', async () => {
        const n = withNote(makeNote({ sharedWith: [BOB] }));
        await expect(service.shareNote(BOB, String(n._id), [DAVE], null, {})).rejects.toMatchObject({ status: 403 });
    });

    test('share adds members, sets allowEditing, does not notify the owner', async () => {
        const n = withNote(makeNote());
        await service.shareNote(ALICE, String(n._id), [BOB, ALICE], null, {}, { allowEditing: true });
        expect(n.sharedWith.map(String)).toEqual([BOB]);
        expect(n.allowEditing).toBe(true);
        expect(notificationService.noteShared).toHaveBeenCalledTimes(1);
        expect(notificationService.noteShared.mock.calls[0][1].recipientIds).toEqual([BOB]);
    });
});

describe('NO4 update/delete', () => {
    test('empty title is stored as Untitled', async () => {
        const n = withNote(makeNote());
        await service.updateNote(ALICE, String(n._id), { title: '   ' }, null);
        expect(n.title).toBe('Untitled');
    });

    test('shared editor with allowEditing can edit content but not owner fields', async () => {
        const n = withNote(makeNote({ sharedWith: [BOB], allowEditing: true }));
        await service.updateNote(BOB, String(n._id), { content: 'hi' }, null);
        expect(n.content).toBe('hi');
        await expect(service.updateNote(BOB, String(n._id), { isPublic: true }, null)).rejects.toMatchObject({ status: 403 });
    });

    test('shared viewer without allowEditing cannot edit', async () => {
        const n = withNote(makeNote({ sharedWith: [BOB], allowEditing: false }));
        await expect(service.updateNote(BOB, String(n._id), { content: 'x' }, null)).rejects.toMatchObject({ status: 403 });
    });

    test('delete archives by default, permanent deletes (owner only)', async () => {
        const n = withNote(makeNote({ sharedWith: [BOB], allowEditing: true }));
        const del = jest.spyOn(Note, 'findByIdAndDelete').mockResolvedValue(n);
        await expect(service.deleteNote(BOB, String(n._id), true, null)).rejects.toMatchObject({ status: 403 });
        const a = await service.deleteNote(ALICE, String(n._id), false, null);
        expect(a.archived).toBe(true);
        expect(n.isArchived).toBe(true);
        expect(del).not.toHaveBeenCalled();
        const p = await service.deleteNote(ALICE, String(n._id), true, null);
        expect(p.permanent).toBe(true);
        expect(del).toHaveBeenCalled();
    });
});

describe('NO5 content sanitising', () => {
    test('text blocks are sanitised on update, code blocks untouched', async () => {
        const n = withNote(makeNote());
        const blocks = [
            { id: 1, type: 'text', content: '<b>x</b><img src=x onerror=alert(1)><script>alert(1)</script>' },
            { id: 2, type: 'code', content: '<script>ok in code</script>' },
            { id: 3, type: 'image', content: 'javascript:alert(1)' },
        ];
        await service.updateNote(ALICE, String(n._id), { content: JSON.stringify(blocks) }, null);
        const saved = JSON.parse(n.content);
        expect(saved[0].content).toBe('<b>x</b><img src="x">');
        expect(saved[1].content).toBe('<script>ok in code</script>');
        expect(saved[2].content).toBe('');
    });

    test('non-JSON content is sanitised as HTML', () => {
        expect(sanitizeNoteContent('<p onclick="x">a</p><iframe src="//e"></iframe>')).toBe('<p>a</p>');
    });
});
