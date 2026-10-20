'use strict';

/**
 * Knowledge pages belong to a workspace: only its active members list, read, create, edit or
 * delete them. A page in someone else's workspace answers "not found".
 */

const oid = (n) => n.toString(16).padStart(24, '0');
const MEMBER = oid(1);
const OUTSIDER = oid(2);
const WS = oid(50);
const OTHER_WS = oid(51);
const PAGE = oid(100);

function query(value) {
    const q = {
        select: jest.fn(() => q),
        sort: jest.fn(() => q),
        populate: jest.fn(() => q),
        lean: jest.fn(() => Promise.resolve(value)),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
    };
    return q;
}

jest.mock('../KnowledgePage', () => ({ findById: jest.fn(), findOne: jest.fn(), find: jest.fn(), create: jest.fn() }));
jest.mock('../PageLink', () => ({ find: jest.fn(), deleteMany: jest.fn().mockResolvedValue({}), updateOne: jest.fn(), deleteOne: jest.fn() }));
jest.mock('../KnowledgeCategory', () => ({ find: jest.fn(), countDocuments: jest.fn(), create: jest.fn() }));
jest.mock('../../ai/ai.summarizer.service', () => ({ summarizeDocument: jest.fn() }));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (doc) => doc) }));
jest.mock('../../../identity', () => ({ workspaces: { findById: jest.fn() } }));

const KnowledgePage = require('../KnowledgePage');
const identity = require('../../../identity');
const service = require('../knowledge.service');

const page = (over = {}) => {
    const doc = { _id: PAGE, workspaceId: WS, title: 'Handbook', content: '# Hi', isDeleted: false, versions: [], ...over };
    doc.save = jest.fn().mockResolvedValue(doc);
    return doc;
};

beforeEach(() => {
    jest.clearAllMocks();
    // OUTSIDER was a member once and was removed.
    identity.workspaces.findById.mockImplementation(async (id) =>
        (String(id) === WS ? { _id: WS, members: [{ user: MEMBER, status: 'active' }, { user: OUTSIDER, status: 'removed' }] } : null));
});

test('members list their workspace pages; others are refused', async () => {
    KnowledgePage.find.mockImplementation(() => query([page()]));
    await expect(service.getPages(MEMBER, WS)).resolves.toMatchObject({ pages: [{ title: 'Handbook' }] });
    await expect(service.getPages(OUTSIDER, WS)).rejects.toMatchObject({ statusCode: 403 });
    await expect(service.getPages(MEMBER, OTHER_WS)).rejects.toMatchObject({ statusCode: 403 });
});

test('a page outside your workspaces is not found, for reading, editing and deleting', async () => {
    KnowledgePage.findById.mockImplementation(() => query(page()));
    await expect(service.getPage(OUTSIDER, PAGE)).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.updatePage(OUTSIDER, PAGE, { content: 'pwned' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(service.deletePage(OUTSIDER, PAGE)).rejects.toMatchObject({ statusCode: 404 });
});

test('a malformed id is not found instead of a server error', async () => {
    await expect(service.getPage(MEMBER, 'nope')).rejects.toMatchObject({ statusCode: 404 });
    expect(KnowledgePage.findById).not.toHaveBeenCalled();
});

test('members edit pages and earlier content is kept as a version', async () => {
    const doc = page();
    KnowledgePage.findById.mockImplementation(() => query(doc));
    await service.updatePage(MEMBER, PAGE, { title: 'Team handbook', content: '# New', icon: '📘' });
    expect(doc).toMatchObject({ title: 'Team handbook', content: '# New', icon: '📘' });
    expect(doc.versions[0]).toMatchObject({ content: '# Hi', savedBy: MEMBER });
    expect(doc.save).toHaveBeenCalled();
});

test('members create pages; a parent must be a page of the same workspace', async () => {
    KnowledgePage.create.mockImplementation(async (d) => ({ toObject: () => ({ ...d, _id: oid(101) }) }));
    await expect(service.createPage(MEMBER, WS, { title: 'New', content: 'x' })).resolves.toMatchObject({ page: { title: 'New', workspaceId: WS } });
    await expect(service.createPage(OUTSIDER, WS, { title: 'New' })).rejects.toMatchObject({ statusCode: 403 });

    KnowledgePage.findOne.mockImplementation(() => query(null));
    await expect(service.createPage(MEMBER, WS, { title: 'Child', parentId: oid(200) })).rejects.toMatchObject({ statusCode: 400 });
    expect(KnowledgePage.findOne.mock.calls[0][0]).toMatchObject({ _id: oid(200), workspaceId: WS, isDeleted: false });
});
