'use strict';

/** REST writes to knowledge pages keep live collaborative editors (collab module) in step. */

const oid = (n) => n.toString(16).padStart(24, '0');
const MEMBER = oid(1);
const WS = oid(50);
const PAGE = oid(100);

jest.mock('../KnowledgePage', () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock('../PageLink', () => ({ deleteMany: jest.fn().mockResolvedValue({}) }));
jest.mock('../../ai/ai.summarizer.service', () => ({ summarizeDocument: jest.fn() }));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (doc) => doc) }));
jest.mock('../../../identity', () => ({ workspaces: { findById: jest.fn() } }));
jest.mock('../../../modules/collab/collab.service', () => ({
    contentChanged: jest.fn().mockResolvedValue(),
    documentDeleted: jest.fn().mockResolvedValue(),
}));

const KnowledgePage = require('../KnowledgePage');
const identity = require('../../../identity');
const collab = require('../../../modules/collab/collab.service');
const service = require('../knowledge.service');

const page = () => {
    const doc = { _id: PAGE, workspaceId: WS, title: 'T', content: 'old', isDeleted: false, versions: [] };
    doc.save = jest.fn().mockResolvedValue(doc);
    return doc;
};

beforeEach(() => {
    jest.clearAllMocks();
    identity.workspaces.findById.mockResolvedValue({ _id: WS, members: [{ user: MEMBER, status: 'active' }] });
});

test('a content update is merged into the live document; a title change is not', async () => {
    const p = page();
    KnowledgePage.findById.mockResolvedValue(p);
    await service.updatePage(MEMBER, PAGE, { title: 'New' });
    expect(collab.contentChanged).not.toHaveBeenCalled();
    await service.updatePage(MEMBER, PAGE, { content: 'new body' });
    expect(collab.contentChanged).toHaveBeenCalledWith('knowledge', PAGE, 'new body', { workspaceId: WS });
});

test('deleting a page closes live sessions', async () => {
    KnowledgePage.findById.mockResolvedValue(page());
    await service.deletePage(MEMBER, PAGE);
    expect(collab.documentDeleted).toHaveBeenCalledWith('knowledge', PAGE);
});
