'use strict';

/**
 * File library: access roles, tags, versions (upload / list / restore),
 * share permissions and comments. Models, storage and identity are mocked.
 */

jest.mock('../WorkspaceFile', () => ({ findById: jest.fn(), findOne: jest.fn(), find: jest.fn(), create: jest.fn(), aggregate: jest.fn() }));
jest.mock('../FileVersion', () => ({ create: jest.fn(), find: jest.fn(), findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../FileComment', () => ({ create: jest.fn(), find: jest.fn(), findOne: jest.fn() }));
jest.mock('../../../identity', () => ({ workspaces: { findById: jest.fn() } }));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (x) => x) }));
jest.mock('../../../modules/uploads/upload.service', () => ({
    uploadToGCS: jest.fn(async (f) => ({ url: `https://cdn/${f.originalname}`, gcsPath: `p/${f.originalname}`, size: f.size, mimeType: f.mimetype })),
}));

const WorkspaceFile = require('../WorkspaceFile');
const FileVersion = require('../FileVersion');
const FileComment = require('../FileComment');
const identity = require('../../../identity');
const { uploadToGCS } = require('../../../modules/uploads/upload.service');
const service = require('../files.service');
const { _parseTags } = require('../files.controller');

const oid = (n) => n.toString(16).padStart(24, '0');
const OWNER = oid(1);
const EDITOR = oid(2);
const VIEWER = oid(3);
const ADMIN = oid(4);
const SUSPENDED = oid(5);
const OUTSIDER = oid(6);
const DOWNLOADER = oid(7);
const WS = oid(30);
const FILE = oid(100);

const workspace = {
    _id: WS,
    members: [
        { user: OWNER, role: 'member', status: 'active' },
        { user: EDITOR, role: 'member', status: 'active' },
        { user: VIEWER, role: 'member', status: 'active' },
        { user: ADMIN, role: 'admin', status: 'active' },
        { user: DOWNLOADER, role: 'member', status: 'active' },
        { user: SUSPENDED, role: 'member', status: 'suspended' },
    ],
};

let file;
function makeFile(overrides = {}) {
    const f = {
        _id: FILE, workspaceId: WS, createdBy: OWNER, updatedBy: null, name: 'logo.png', url: 'https://cdn/v1.png', gcsPath: 'p/v1.png',
        size: 10, mimeType: 'image/png', tags: [], isDeleted: false, currentVersion: 1, currentVersionNote: '',
        permissions: [{ user: EDITOR, role: 'edit' }, { user: DOWNLOADER, role: 'download' }],
        ...overrides,
    };
    f.save = jest.fn().mockResolvedValue(f);
    return f;
}

const q = (value) => {
    const chain = { select: () => chain, sort: () => chain, lean: () => Promise.resolve(value && value.save ? { ...value } : value), then: (r, j) => Promise.resolve(value).then(r, j) };
    return chain;
};

beforeEach(() => {
    jest.clearAllMocks();
    file = makeFile();
    identity.workspaces.findById.mockImplementation(async (id) => (String(id) === WS ? workspace : null));
    WorkspaceFile.findById.mockImplementation((id) => q(String(id) === FILE ? file : null));
    WorkspaceFile.findOne.mockImplementation(() => q(null));
    FileVersion.create.mockImplementation(async (d) => ({ _id: oid(500), ...d }));
});

describe('access', () => {
    it('only active members see files; malformed ids are 404', async () => {
        await expect(service.getFile(OUTSIDER, FILE)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.getFile(SUSPENDED, FILE)).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.getFile(VIEWER, 'nope')).rejects.toMatchObject({ statusCode: 404 });
        const { file: out } = await service.getFile(VIEWER, FILE);
        expect(out.myRole).toBe('view');
    });

    it('ranks view < download < edit (download no longer passes an edit check)', async () => {
        await expect(service.updateFile(DOWNLOADER, FILE, { name: 'x' })).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.updateFile(VIEWER, FILE, { name: 'x' })).rejects.toMatchObject({ statusCode: 403 });
        await service.updateFile(EDITOR, FILE, { name: '  brand.png ' });
        expect(file.name).toBe('brand.png');
        expect(file.updatedBy).toBe(EDITOR);
    });

    it('deleted files are not editable', async () => {
        file.isDeleted = true;
        await expect(service.updateFile(OWNER, FILE, { name: 'x' })).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.tagFile(OWNER, FILE, ['a'])).rejects.toMatchObject({ statusCode: 404 });
    });

    it('owner or workspace admin deletes', async () => {
        await expect(service.deleteFile(EDITOR, FILE)).rejects.toMatchObject({ statusCode: 403 });
        await service.deleteFile(ADMIN, FILE);
        expect(file.isDeleted).toBe(true);
    });
});

describe('tags', () => {
    it('normalises, dedupes and validates', async () => {
        await service.tagFile(EDITOR, FILE, [' Brand ', 'brand', 'Q4', '']);
        expect(file.tags).toEqual(['brand', 'q4']);
        await expect(service.tagFile(EDITOR, FILE, [1])).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.tagFile(EDITOR, FILE, Array.from({ length: 31 }, (_, i) => `t${i}`))).rejects.toMatchObject({ statusCode: 400 });
    });

    it('lists workspace tags with counts', async () => {
        WorkspaceFile.aggregate.mockResolvedValue([{ _id: 'brand', count: 2 }]);
        expect(await service.getTags(VIEWER, WS)).toEqual({ tags: [{ tag: 'brand', count: 2 }] });
    });

    it('multipart tags parse as JSON array or comma list', () => {
        expect(_parseTags('["a","b"]')).toEqual(['a', 'b']);
        expect(_parseTags('a,b')).toEqual(['a', 'b']);
        expect(_parseTags(undefined)).toEqual([]);
        expect(() => _parseTags('[oops')).toThrow(/tags/);
    });
});

describe('versions', () => {
    it('upload snapshots the previous content, credited to whoever uploaded it', async () => {
        file.updatedBy = EDITOR;
        file.currentVersionNote = 'first cut';
        const res = await service.createVersion(OWNER, FILE, { originalname: 'v2.png', size: 20, mimetype: 'image/png' }, 'darker');
        expect(FileVersion.create).toHaveBeenCalledWith(expect.objectContaining({
            fileId: FILE, versionNumber: 1, url: 'https://cdn/v1.png', createdBy: EDITOR, changeNote: 'first cut',
        }));
        expect(res.version).toBe(2);
        expect(file).toMatchObject({ url: 'https://cdn/v2.png', currentVersion: 2, updatedBy: OWNER, currentVersionNote: 'darker' });
    });

    it('a failed upload leaves no stray snapshot', async () => {
        uploadToGCS.mockRejectedValueOnce(new Error('S3 down'));
        const prev = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            await expect(service.createVersion(OWNER, FILE, { originalname: 'v2.png', size: 1, mimetype: 'image/png' })).rejects.toThrow('S3 down');
        } finally { process.env.NODE_ENV = prev; }
        expect(FileVersion.create).not.toHaveBeenCalled();
        expect(file.currentVersion).toBe(1);
    });

    it('lists versions plus the current one', async () => {
        file.currentVersion = 3;
        FileVersion.find.mockReturnValue(q([{ versionNumber: 2 }, { versionNumber: 1 }]));
        const out = await service.getVersions(VIEWER, FILE);
        expect(out.currentVersion).toBe(3);
        expect(out.current).toMatchObject({ versionNumber: 3, isCurrent: true, url: file.url });
        expect(out.versions).toHaveLength(2);
    });

    it('restore makes an old version current and keeps what was there', async () => {
        file.currentVersion = 2;
        FileVersion.findById.mockResolvedValue({ _id: oid(501), fileId: FILE, versionNumber: 1, url: 'https://cdn/old.png', gcsPath: 'p/old', size: 5, mimeType: 'image/png' });
        const res = await service.restoreVersion(EDITOR, FILE, oid(501));
        expect(FileVersion.create).toHaveBeenCalledWith(expect.objectContaining({ versionNumber: 2, url: 'https://cdn/v1.png' }));
        expect(file).toMatchObject({ url: 'https://cdn/old.png', currentVersion: 3, currentVersionNote: 'Restored version 1' });
        expect(res.restoredFrom).toBe(1);
    });

    it('restore 404s a malformed or foreign version id', async () => {
        await expect(service.restoreVersion(OWNER, FILE, 'bad')).rejects.toMatchObject({ statusCode: 404 });
        FileVersion.findById.mockResolvedValue({ _id: oid(502), fileId: oid(999) });
        await expect(service.restoreVersion(OWNER, FILE, oid(502))).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.restoreVersion(VIEWER, FILE, oid(502))).rejects.toMatchObject({ statusCode: 403 });
    });
});

describe('share permissions', () => {
    it('owner grants, changes and revokes roles for active members only', async () => {
        await service.shareFile(OWNER, FILE, [{ user: VIEWER, role: 'download' }, { user: EDITOR, role: 'view' }, { user: DOWNLOADER, role: null }]);
        expect(file.permissions).toEqual([{ user: EDITOR, role: 'view' }, { user: VIEWER, role: 'download' }]);
        await expect(service.shareFile(OWNER, FILE, [{ user: OUTSIDER, role: 'view' }])).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.shareFile(OWNER, FILE, [{ user: VIEWER, role: 'admin' }])).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.shareFile(OWNER, FILE, [{ role: 'view' }])).rejects.toMatchObject({ statusCode: 400 });
    });

    it('only the owner or a workspace admin may share', async () => {
        await expect(service.shareFile(EDITOR, FILE, [{ user: VIEWER, role: 'edit' }])).rejects.toMatchObject({ statusCode: 403 });
        await service.shareFile(ADMIN, FILE, [{ user: VIEWER, role: 'edit' }]);
        expect(file.permissions).toContainEqual({ user: VIEWER, role: 'edit' });
    });
});

describe('comments', () => {
    it('any member comments; replies stay one level deep', async () => {
        FileComment.create.mockImplementation(async (d) => ({ ...d, _id: oid(600), toObject() { return { ...d, _id: oid(600) }; } }));
        await service.addComment(VIEWER, FILE, ' nice ', null);
        expect(FileComment.create).toHaveBeenLastCalledWith(expect.objectContaining({ content: 'nice', parentId: null, workspaceId: WS }));

        FileComment.findOne.mockReturnValue(q({ _id: oid(601), parentId: oid(600) }));
        await service.addComment(EDITOR, FILE, 'reply', oid(601));
        expect(FileComment.create).toHaveBeenLastCalledWith(expect.objectContaining({ parentId: oid(600) }));

        FileComment.findOne.mockReturnValue(q(null));
        await expect(service.addComment(EDITOR, FILE, 'x', oid(999))).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.addComment(EDITOR, FILE, '   ', null)).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.addComment(OUTSIDER, FILE, 'hi', null)).rejects.toMatchObject({ statusCode: 403 });
    });

    it('author edits; author, file owner or admin deletes', async () => {
        const comment = { _id: oid(600), author: VIEWER, content: 'a', save: jest.fn(), toObject() { return { ...this }; } };
        FileComment.findOne.mockResolvedValue(comment);
        await expect(service.updateComment(EDITOR, FILE, oid(600), 'b')).rejects.toMatchObject({ statusCode: 403 });
        await service.updateComment(VIEWER, FILE, oid(600), ' b ');
        expect(comment.content).toBe('b');
        expect(comment.editedAt).toBeInstanceOf(Date);

        await expect(service.deleteComment(EDITOR, FILE, oid(600))).rejects.toMatchObject({ statusCode: 403 });
        await service.deleteComment(OWNER, FILE, oid(600));
        expect(comment.isDeleted).toBe(true);
        FileComment.findOne.mockResolvedValue(null);
        await expect(service.deleteComment(OWNER, FILE, oid(600))).rejects.toMatchObject({ statusCode: 404 });
    });
});

describe('upload', () => {
    it('validates folder and tags before storing', async () => {
        WorkspaceFile.create.mockImplementation(async (d) => d);
        await expect(service.uploadFile(VIEWER, WS, { originalname: 'a.pdf', size: 1, mimetype: 'application/pdf' }, { folderId: 'zzz' }))
            .rejects.toMatchObject({ statusCode: 400 });
        expect(uploadToGCS).not.toHaveBeenCalled();
        const out = await service.uploadFile(VIEWER, WS, { originalname: 'a.pdf', size: 1, mimetype: 'application/pdf' }, { tags: ['Spec'] });
        expect(out).toMatchObject({ createdBy: VIEWER, updatedBy: VIEWER, tags: ['spec'], folderId: null });
    });
});

describe('restricted files', () => {
    beforeEach(() => {
        process.env.MEDIA_URL_SECRET = process.env.MEDIA_URL_SECRET || 'test-secret';
        file = makeFile({ access: 'restricted', permissions: [{ user: EDITOR, role: 'edit' }, { user: VIEWER, role: 'view' }] });
    });

    it('are hidden (404) from members not on the file, visible to grantees and admins', async () => {
        await expect(service.getFile(DOWNLOADER, FILE)).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.getComments(DOWNLOADER, FILE)).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.getFile(OUTSIDER, FILE)).rejects.toMatchObject({ statusCode: 404 });
        expect((await service.getFile(VIEWER, FILE)).file.myRole).toBe('view');
        expect((await service.getFile(ADMIN, FILE)).file._id).toBe(FILE);
    });

    it('listing filters restricted files for non-admins', async () => {
        WorkspaceFile.find.mockReturnValue(q([]));
        await service.getFiles(DOWNLOADER, WS);
        expect(WorkspaceFile.find.mock.calls[0][0].$or).toEqual([
            { access: { $ne: 'restricted' } }, { createdBy: DOWNLOADER }, { 'permissions.user': DOWNLOADER },
        ]);
        await service.getFiles(ADMIN, WS);
        expect(WorkspaceFile.find.mock.calls[1][0].$or).toBeUndefined();
    });

    it('download needs the download role; previews need any grant', async () => {
        await expect(service.getDownloadUrl(VIEWER, FILE)).rejects.toMatchObject({ statusCode: 403 });
        const out = await service.getDownloadUrl(EDITOR, FILE);
        expect(out.url).toMatch(/^\/api\/v2\/uploads\/file\?path=p%2Fv1\.png&u=/);
        expect(out.name).toBe('logo.png');

        WorkspaceFile.findOne.mockReturnValue(q({ ...file }));
        expect(await service.canReadLibraryObject('p/v1.png', VIEWER)).toBe(true);
        expect(await service.canReadLibraryObject('p/v1.png', DOWNLOADER)).toBe(false);
        expect(await service.canReadLibraryObject('p/v1.png', SUSPENDED)).toBe(false);
        WorkspaceFile.findOne.mockReturnValue(q(null));
        FileVersion.findOne = jest.fn(() => q(null));
        expect(await service.canReadLibraryObject('chat/x.png', VIEWER)).toBeNull();
    });

    it('owner switches access and removes people', async () => {
        file.access = 'workspace';
        await service.shareFile(OWNER, FILE, [], { access: 'restricted', remove: [VIEWER] });
        expect(file.access).toBe('restricted');
        expect(file.permissions).toEqual([{ user: EDITOR, role: 'edit' }]);
        await expect(service.shareFile(OWNER, FILE, [], { access: 'private' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.shareFile(OWNER, FILE, [], { remove: ['x'] })).rejects.toMatchObject({ statusCode: 400 });
    });

    it('a member removed from the workspace loses edit rights', async () => {
        file = makeFile();
        await expect(service.tagFile(SUSPENDED, FILE, ['a'])).rejects.toMatchObject({ statusCode: 403 });
        file.permissions.push({ user: SUSPENDED, role: 'edit' });
        await expect(service.restoreVersion(SUSPENDED, FILE, oid(501))).rejects.toMatchObject({ statusCode: 403 });
        await expect(service.createVersion(SUSPENDED, FILE, { originalname: 'x', size: 1, mimetype: 'image/png' })).rejects.toMatchObject({ statusCode: 403 });
    });
});
