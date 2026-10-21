'use strict';

/** Knowledge categories: create, update, delete (pages become uncategorised) and reorder. */

const oid = (n) => n.toString(16).padStart(24, '0');
const MEMBER = oid(1);
const OUTSIDER = oid(2);
const WS = oid(50);
const OTHER_WS = oid(51);
const CAT = oid(200);
const CAT2 = oid(201);

function query(value) {
    const q = {
        select: jest.fn(() => q),
        sort: jest.fn(() => q),
        lean: jest.fn(() => Promise.resolve(value)),
        then: (res, rej) => Promise.resolve(value).then(res, rej),
    };
    return q;
}

jest.mock('../KnowledgePage', () => ({ updateMany: jest.fn(), findById: jest.fn(), find: jest.fn() }));
jest.mock('../PageLink', () => ({}));
jest.mock('../KnowledgeCategory', () => ({
    find: jest.fn(), findOne: jest.fn(), findById: jest.fn(), countDocuments: jest.fn(), create: jest.fn(), deleteOne: jest.fn(), bulkWrite: jest.fn(),
}));
jest.mock('../../ai/ai.summarizer.service', () => ({ summarizeDocument: jest.fn() }));
jest.mock('../../../identity/hydrate', () => ({ hydrate: jest.fn(async (doc) => doc) }));
jest.mock('../../../identity', () => ({ workspaces: { findById: jest.fn() } }));

const KnowledgePage = require('../KnowledgePage');
const KnowledgeCategory = require('../KnowledgeCategory');
const identity = require('../../../identity');
const service = require('../knowledge.service');

let category;
beforeEach(() => {
    jest.clearAllMocks();
    identity.workspaces.findById.mockImplementation(async (id) => (String(id) === WS
        ? { _id: WS, members: [{ user: MEMBER, status: 'active' }] }
        : { _id: id, members: [] }));
    category = { _id: CAT, workspaceId: WS, name: 'Guides', color: '#c8a274', save: jest.fn() };
    KnowledgeCategory.findById.mockImplementation(async (id) => (String(id) === CAT ? category : null));
    KnowledgeCategory.findOne.mockReturnValue(query(null));
    KnowledgeCategory.countDocuments.mockResolvedValue(2);
    KnowledgeCategory.create.mockImplementation(async (d) => d);
});

describe('categories', () => {
    it('create validates the name, rejects duplicates and defaults to the gold accent', async () => {
        await expect(service.createCategory(MEMBER, WS, { name: '  ' })).rejects.toMatchObject({ statusCode: 400 });
        const { category: c } = await service.createCategory(MEMBER, WS, { name: ' Policies ' });
        expect(c).toMatchObject({ name: 'Policies', color: '#c8a274', order: 2 });
        KnowledgeCategory.findOne.mockReturnValue(query({ _id: CAT2 }));
        await expect(service.createCategory(MEMBER, WS, { name: 'Policies' })).rejects.toMatchObject({ statusCode: 409 });
        await expect(service.createCategory(OUTSIDER, WS, { name: 'X' })).rejects.toMatchObject({ statusCode: 403 });
    });

    it('update changes name / color; outsiders and unknown ids get 404', async () => {
        await service.updateCategory(MEMBER, CAT, { name: 'How-tos', color: 'accent' });
        expect(category).toMatchObject({ name: 'How-tos', color: 'accent' });
        expect(category.save).toHaveBeenCalled();
        await expect(service.updateCategory(MEMBER, CAT, { color: 'url(javascript:1)' })).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.updateCategory(OUTSIDER, CAT, { name: 'x' })).rejects.toMatchObject({ statusCode: 404 });
        await expect(service.updateCategory(MEMBER, 'bad', { name: 'x' })).rejects.toMatchObject({ statusCode: 404 });
    });

    it('delete uncategorises its pages', async () => {
        KnowledgePage.updateMany.mockResolvedValue({ modifiedCount: 3 });
        const out = await service.deleteCategory(MEMBER, CAT);
        expect(KnowledgePage.updateMany).toHaveBeenCalledWith({ workspaceId: WS, categoryId: CAT }, { $set: { categoryId: null } });
        expect(KnowledgeCategory.deleteOne).toHaveBeenCalledWith({ _id: CAT });
        expect(out).toMatchObject({ pagesUncategorised: 3, categoryId: CAT });
    });

    it('reorder writes positions; unlisted categories keep their order after the listed ones', async () => {
        KnowledgeCategory.find
            .mockReturnValueOnce(query([{ _id: CAT }, { _id: CAT2 }, { _id: oid(202) }]))
            .mockReturnValueOnce(query([]));
        await service.reorderCategories(MEMBER, WS, [CAT2]);
        const ops = KnowledgeCategory.bulkWrite.mock.calls[0][0].map((o) => [o.updateOne.filter._id, o.updateOne.update.$set.order]);
        expect(ops).toEqual([[CAT2, 0], [CAT, 1], [oid(202), 2]]);

        KnowledgeCategory.find.mockReturnValueOnce(query([{ _id: CAT }]));
        await expect(service.reorderCategories(MEMBER, WS, [oid(999)])).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.reorderCategories(MEMBER, WS, [])).rejects.toMatchObject({ statusCode: 400 });
        await expect(service.reorderCategories(MEMBER, OTHER_WS, [CAT])).rejects.toMatchObject({ statusCode: 403 });
    });
});
