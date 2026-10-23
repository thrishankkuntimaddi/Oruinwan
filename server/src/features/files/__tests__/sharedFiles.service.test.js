'use strict';

/**
 * GET /api/v2/files/shared: chat attachments from conversations the caller can read
 * plus library files, with access control, filters, merge-sorting and pagination.
 * Models and identity are mocked; the Mongo queries the service builds are asserted.
 */

jest.mock('../../channels/channel.model.js', () => ({ find: jest.fn() }));
jest.mock('../../../../models/DMSession', () => ({ find: jest.fn() }));
jest.mock('../../../modules/messages/message.model.js', () => ({ aggregate: jest.fn() }));
jest.mock('../WorkspaceFile', () => ({ find: jest.fn(), countDocuments: jest.fn() }));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (x) => x) }));
jest.mock('../../../modules/messages/groupDM.service', () => ({
    groupDisplayName: (s) => s.name || 'Group',
    memberSinceFor: (s, u) => (s.isGroup ? (s.memberSince || []).find((m) => String(m.user) === String(u))?.at || null : null),
}));

const Channel = require('../../channels/channel.model.js');
const DMSession = require('../../../../models/DMSession');
const Message = require('../../../modules/messages/message.model.js');
const WorkspaceFile = require('../WorkspaceFile');
const svc = require('../sharedFiles.service');

const oid = (n) => n.toString(16).padStart(24, '0');
const ME = oid(1);
const BOB = oid(2);
const WS = oid(30);
const CH_GENERAL = oid(40);
const CH_SECRET = oid(41);
const DM_BOB = oid(50);
const GROUP = oid(51);
const JOINED = new Date('2026-01-10T00:00:00Z');

const lean = (value) => ({ select: () => ({ lean: async () => value }) });
const findChain = (value) => {
    const chain = { sort: () => chain, limit: () => chain, collation: () => chain, lean: async () => value };
    return chain;
};

const member = jest.fn(async () => ({ isAdmin: false }));
const deps = { assertWorkspaceMember: member };

function msgRow(id, conv, at, attachment, extra = {}) {
    return { _id: oid(id), [conv.startsWith('ch') ? 'channel' : 'dm']: conv === 'ch' ? CH_GENERAL : conv === 'dm' ? DM_BOB : GROUP, sender: BOB, createdAt: new Date(at), attachments: attachment, index: 0, parentId: null, ...extra };
}

beforeEach(() => {
    jest.clearAllMocks();
    member.mockResolvedValue({ isAdmin: false });
    Channel.find.mockReturnValue(lean([{ _id: CH_GENERAL, name: 'general', isPrivate: false, members: [{ user: ME, joinedAt: JOINED }, { user: BOB }] }]));
    DMSession.find.mockReturnValue(lean([
        { _id: DM_BOB, isGroup: false, participants: [{ _id: ME, username: 'me' }, { _id: BOB, username: 'bob' }], clearedAt: [] },
        { _id: GROUP, isGroup: true, name: 'Launch crew', participants: [ME, BOB], memberSince: [{ user: ME, at: new Date('2026-03-01T00:00:00Z') }] },
    ]));
    Message.aggregate.mockImplementation(async (pipeline) => (pipeline.some((s) => s.$count) ? [{ n: 2 }] : [
        msgRow(100, 'ch', '2026-05-02T00:00:00Z', { name: 'spec.pdf', mimeType: 'application/pdf', size: 300, url: '/api/v2/uploads/file?path=a', type: 'file' }),
        msgRow(101, 'dm', '2026-05-04T00:00:00Z', { name: 'photo.png', mimeType: 'image/png', size: 900, url: '/api/v2/uploads/file?path=b', type: 'image' }, { parentId: oid(99) }),
    ]));
    WorkspaceFile.find.mockReturnValue(findChain([
        { _id: oid(200), name: 'brand.zip', mimeType: 'application/zip', size: 5000, url: '/api/v2/uploads/file?path=c', createdBy: ME, createdAt: new Date('2026-05-03T00:00:00Z'), tags: ['brand'] },
    ]));
    WorkspaceFile.countDocuments.mockResolvedValue(1);
});

describe('listSharedFiles', () => {
    it('requires an active workspace membership', async () => {
        member.mockRejectedValueOnce(Object.assign(new Error('Not a member of this workspace'), { statusCode: 403 }));
        await expect(svc.listSharedFiles(ME, WS, {}, deps)).rejects.toMatchObject({ statusCode: 403 });
        expect(Message.aggregate).not.toHaveBeenCalled();
    });

    it('merges chat attachments and library files newest first, with where and who', async () => {
        const out = await svc.listSharedFiles(ME, WS, {}, deps);
        expect(out.items.map((i) => i.name)).toEqual(['photo.png', 'brand.zip', 'spec.pdf']);
        expect(out.total).toBe(3);
        expect(out.hasMore).toBe(false);
        const photo = out.items[0];
        expect(photo).toMatchObject({ source: 'dm', kind: 'image', messageId: oid(101), parentId: oid(99), conversation: { id: DM_BOB, type: 'dm', name: 'bob' } });
        expect(out.items[1]).toMatchObject({ source: 'library', fileId: oid(200), kind: 'other', conversation: null });
        expect(out.items[2].conversation).toMatchObject({ type: 'channel', name: 'general' });
        expect(out.conversations.map((c) => c.name)).toEqual(['general', 'bob', 'Launch crew']);
    });

    it('only reads conversations the user belongs to, from when they could read them', async () => {
        await svc.listSharedFiles(ME, WS, {}, deps);
        expect(Channel.find).toHaveBeenCalledWith({ workspace: WS, 'members.user': ME });
        expect(DMSession.find).toHaveBeenCalledWith({ workspace: WS, participants: ME });
        const match = Message.aggregate.mock.calls[0][0][0].$match;
        const scopes = match.$or.map((c) => ({ conv: String(c.channel || c.dm), since: c.createdAt }));
        expect(scopes).toEqual([
            { conv: CH_GENERAL, since: { $gte: JOINED } },
            { conv: DM_BOB, since: undefined },
            { conv: GROUP, since: { $gt: new Date('2026-03-01T00:00:00Z') } },
        ]);
        // deleted for everyone, removed, hidden for me, system lines: out
        expect(match.isDeleted).toEqual({ $ne: true });
        expect(match.isDeletedUniversally).toEqual({ $ne: true });
        expect(String(match.hiddenFor.$ne)).toBe(ME);
        expect(match.type).toEqual({ $ne: 'system' });
    });

    it('hides restricted library files from non-admins who are not on them', async () => {
        await svc.listSharedFiles(ME, WS, {}, deps);
        const q = WorkspaceFile.find.mock.calls[0][0];
        expect(JSON.stringify(q)).toContain('restricted');
        member.mockResolvedValueOnce({ isAdmin: true });
        await svc.listSharedFiles(ME, WS, {}, deps);
        expect(JSON.stringify(WorkspaceFile.find.mock.calls[1][0])).not.toContain('restricted');
    });

    it('a conversation the user cannot read answers an empty list without querying', async () => {
        const out = await svc.listSharedFiles(ME, WS, { conversationId: CH_SECRET }, deps);
        expect(out.items).toEqual([]);
        expect(out.total).toBe(0);
        expect(Message.aggregate).not.toHaveBeenCalled();
        expect(WorkspaceFile.find).not.toHaveBeenCalled();
    });

    it('filters by source', async () => {
        await svc.listSharedFiles(ME, WS, { source: 'library' }, deps);
        expect(Message.aggregate).not.toHaveBeenCalled();
        jest.clearAllMocks();
        Channel.find.mockReturnValue(lean([{ _id: CH_GENERAL, name: 'general', members: [{ user: ME }] }]));
        DMSession.find.mockReturnValue(lean([]));
        await svc.listSharedFiles(ME, WS, { source: 'channels' }, deps);
        expect(WorkspaceFile.find).not.toHaveBeenCalled();
        expect(Message.aggregate.mock.calls[0][0][0].$match.$or).toHaveLength(1);
    });

    it('paginates the merged list', async () => {
        const page1 = await svc.listSharedFiles(ME, WS, { limit: 2 }, deps);
        expect(page1.items.map((i) => i.name)).toEqual(['photo.png', 'brand.zip']);
        expect(page1.hasMore).toBe(true);
        const page2 = await svc.listSharedFiles(ME, WS, { limit: 2, offset: 2 }, deps);
        expect(page2.items.map((i) => i.name)).toEqual(['spec.pdf']);
        expect(page2.hasMore).toBe(false);
        const limitStage = Message.aggregate.mock.calls.find((c) => c[0].some((s) => s.$limit))[0].find((s) => s.$limit);
        expect(limitStage.$limit).toBe(2);
    });

    it('sorts by name and size', async () => {
        const byName = await svc.listSharedFiles(ME, WS, { sort: 'name' }, deps);
        expect(byName.items.map((i) => i.name)).toEqual(['brand.zip', 'photo.png', 'spec.pdf']);
        const bySize = await svc.listSharedFiles(ME, WS, { sort: 'size' }, deps);
        expect(bySize.items.map((i) => i.size)).toEqual([5000, 900, 300]);
    });

    it('passes the name search and kind into the queries (regex-escaped)', async () => {
        await svc.listSharedFiles(ME, WS, { q: 'a.b(', kind: 'image' }, deps);
        const pipeline = Message.aggregate.mock.calls[0][0];
        const after = pipeline[3].$match;
        expect(after['attachments.name'].source).toBe('a\\.b\\(');
        expect(after.$or).toBeDefined();
        expect(JSON.stringify(WorkspaceFile.find.mock.calls[0][0])).toContain('mimeType');
    });

    it('rejects malformed ids', async () => {
        await expect(svc.listSharedFiles(ME, WS, { conversationId: 'x' }, deps)).rejects.toMatchObject({ statusCode: 400 });
        await expect(svc.listSharedFiles(ME, WS, { sharedBy: 'x' }, deps)).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe('helpers', () => {
    it('classifies files', () => {
        expect(svc.kindOf({ mimeType: 'image/jpeg' })).toBe('image');
        expect(svc.kindOf({ mimeType: '', name: 'clip.MOV' })).toBe('media');
        expect(svc.kindOf({ type: 'voice' })).toBe('media');
        expect(svc.kindOf({ mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })).toBe('document');
        expect(svc.kindOf({ name: 'notes.txt' })).toBe('document');
        expect(svc.kindOf({ mimeType: 'application/zip', name: 'a.zip' })).toBe('other');
    });

    it('parses and clamps options', () => {
        expect(svc.parseOptions({ limit: '1000', offset: '-3', sort: 'weird', kind: 'nope', source: 'x' }))
            .toMatchObject({ limit: 100, offset: 0, sort: 'newest', kind: 'all', source: 'all' });
    });

    it('kind filters for "other" exclude every known kind', () => {
        const other = svc.kindMatch('other', 'attachments.');
        expect(other.$nor.length).toBeGreaterThan(4);
        expect(svc.kindMatch('all')).toEqual({});
    });
});
