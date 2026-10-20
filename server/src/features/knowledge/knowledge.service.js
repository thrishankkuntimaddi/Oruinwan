const KnowledgePage = require('./KnowledgePage');
const PageLink = require('./PageLink');
const KnowledgeCategory = require('./KnowledgeCategory');
const { hydrate } = require('../../identity/hydrate');

const CREATOR = { type: 'user', fields: ['username', 'profilePicture', 'profile'] };

const aiSummarizer = require('../ai/ai.summarizer.service');
const mongoose = require('mongoose');

const notFound = () => Object.assign(new Error('Page not found'), { statusCode: 404 });

/** Only active members of a workspace read or change its pages. */
async function assertMember(workspaceId, userId) {
    if (!workspaceId || !mongoose.isValidObjectId(String(workspaceId))) {
        throw Object.assign(new Error('Invalid workspaceId'), { statusCode: 400 });
    }
    const ws = await require('../../identity').workspaces.findById(workspaceId);
    if (!ws || !ws.members.some(m => String(m.user) === String(userId) && m.status !== 'removed')) {
        throw Object.assign(new Error('Not a member of this workspace'), { statusCode: 403 });
    }
}

/** A page the user may see (a member of its workspace). Pages elsewhere answer "not found". */
async function loadPage(pageId, userId, { lean = false } = {}) {
    if (!mongoose.isValidObjectId(String(pageId))) throw notFound();
    const q = KnowledgePage.findById(pageId);
    const page = lean ? await q.lean() : await q;
    if (!page || page.isDeleted) throw notFound();
    try {
        await assertMember(page.workspaceId, userId);
    } catch (err) {
        if (err.statusCode === 403) throw notFound();
        throw err;
    }
    return page;
}

/** A parent page must be a live page in the same workspace. */
async function assertParent(parentId, workspaceId) {
    if (!parentId) return;
    if (!mongoose.isValidObjectId(String(parentId))) throw Object.assign(new Error('Invalid parent page'), { statusCode: 400 });
    const parent = await KnowledgePage.findOne({ _id: parentId, workspaceId, isDeleted: false }).select('_id').lean();
    if (!parent) throw Object.assign(new Error('Invalid parent page'), { statusCode: 400 });
}

async function createPage(userId, workspaceId, data) {
    await assertMember(workspaceId, userId);
    await assertParent(data.parentId, workspaceId);
    const page = await KnowledgePage.create({
        workspaceId,
        createdBy: userId,
        title: data.title || 'Untitled Page',
        content: data.content || '',
        parentId: data.parentId || null,
        categoryId: data.categoryId || null,
        tags: data.tags || [],
        isHandbook: data.isHandbook || false,
        icon: data.icon || '📄',
    });
    // Users live in PostgreSQL: attach the creator with hydrate instead of populate.
    const out = await hydrate(page.toObject(), { createdBy: CREATOR });
    return { page: out };
}

async function getPages(userId, workspaceId, filters = {}) {
    await assertMember(workspaceId, userId);
    const query = { workspaceId, isDeleted: false };
    if (filters.parentId !== undefined) {
        query.parentId = filters.parentId === 'root' ? null : filters.parentId;
    }
    if (filters.isHandbook !== undefined) query.isHandbook = filters.isHandbook === 'true';
    if (filters.categoryId) query.categoryId = filters.categoryId;

    const pages = await KnowledgePage.find(query)
        .sort({ createdAt: -1 })
        .lean();
    await hydrate(pages, { createdBy: CREATOR });

    return { pages };
}

async function getPage(userId, pageId) {
    const page = await loadPage(pageId, userId, { lean: true });
    await hydrate(page, { createdBy: CREATOR });
    return { page };
}

async function updatePage(userId, pageId, updates) {
    const page = await loadPage(pageId, userId);
    if (updates.parentId) {
        if (String(updates.parentId) === String(page._id)) throw Object.assign(new Error('A page cannot be its own parent'), { statusCode: 400 });
        await assertParent(updates.parentId, page.workspaceId);
    }

    
    if (updates.content !== undefined && updates.content !== page.content) {
        const snapshot = { content: page.content, savedBy: userId, savedAt: new Date() };
        page.versions = [snapshot, ...page.versions].slice(0, 50);
    }

    const allowed = ['title', 'content', 'tags', 'parentId', 'categoryId', 'isHandbook', 'icon'];
    allowed.forEach(key => {
        if (updates[key] !== undefined) page[key] = updates[key];
    });

    await page.save();
    return { page };
}

async function deletePage(userId, pageId) {
    const page = await loadPage(pageId, userId);
    page.isDeleted = true;
    await page.save();
    
    await PageLink.deleteMany({ $or: [{ fromPageId: pageId }, { toPageId: pageId }] });
    return { message: 'Page deleted' };
}

async function linkPages(userId, fromPageId, toPageId, workspaceId) {
    if (fromPageId === toPageId) {
        throw Object.assign(new Error('Cannot link a page to itself'), { statusCode: 400 });
    }
    const [from, to] = await Promise.all([loadPage(fromPageId, userId, { lean: true }), loadPage(toPageId, userId, { lean: true })]);
    if (String(from.workspaceId) !== String(to.workspaceId)) throw notFound();
    workspaceId = from.workspaceId;
    
    await PageLink.updateOne(
        { fromPageId, toPageId },
        { $setOnInsert: { fromPageId, toPageId, workspaceId } },
        { upsert: true }
    );
    return { message: 'Pages linked' };
}

async function unlinkPages(userId, fromPageId, toPageId) {
    await loadPage(fromPageId, userId, { lean: true });
    await PageLink.deleteOne({ fromPageId, toPageId });
    return { message: 'Link removed' };
}

async function getBacklinks(userId, pageId) {
    await loadPage(pageId, userId, { lean: true });
    const links = await PageLink.find({ toPageId: pageId })
        .populate({ path: 'fromPageId', select: 'title icon workspaceId' })
        .lean();
    const backlinks = links.map(l => l.fromPageId).filter(Boolean);
    return { backlinks };
}

async function getGraph(userId, workspaceId) {
    await assertMember(workspaceId, userId);
    const [pages, links] = await Promise.all([
        KnowledgePage.find({ workspaceId, isDeleted: false }).select('title icon').lean(),
        PageLink.find({ workspaceId }).lean(),
    ]);

    const nodes = pages.map(p => ({ id: p._id, label: p.title, icon: p.icon }));
    const edges = links.map(l => ({ from: l.fromPageId, to: l.toPageId }));
    return { nodes, edges };
}

async function generateSummary(userId, pageId) {
    const page = await loadPage(pageId, userId);

    
    const { summary, cached, fallback } = await aiSummarizer.summarizeDocument(
        page.content,
        { title: page.title, type: 'wiki' }
    );

    
    if (page.summary !== summary) {
        page.summary = summary;
        await page.save();
    }

    return { summary, cached, fallback };
}

async function searchKnowledge(userId, workspaceId, query) {
    await assertMember(workspaceId, userId);
    if (!query || query.trim().length === 0) return { results: [] };

    const pages = await KnowledgePage.find({
        workspaceId,
        isDeleted: false,
        $text: { $search: query },
    }, { score: { $meta: 'textScore' } })
        .sort({ score: { $meta: 'textScore' } })
        .limit(20)
        .select('title icon content tags createdAt')
        .lean();

    const results = pages.map(p => ({
        id: p._id,
        type: 'knowledge',
        title: p.title,
        icon: p.icon,
        snippet: p.content.substring(0, 150).replace(/[#*>`_]/g, ''),
        tags: p.tags,
        createdAt: p.createdAt,
    }));
    return { results };
}

// ── Categories ────────────────────────────────────────────────────────────────

async function getCategories(workspaceId, userId) {
    await assertMember(workspaceId, userId);
    const categories = await KnowledgeCategory.find({ workspaceId })
        .sort({ order: 1, name: 1 })
        .lean();
    return { categories };
}

async function createCategory(userId, workspaceId, data) {
    await assertMember(workspaceId, userId);
    const count = await KnowledgeCategory.countDocuments({ workspaceId });
    const category = await KnowledgeCategory.create({
        workspaceId,
        name: data.name,
        color: data.color || '#6366f1',
        icon: data.icon || '📂',
        order: count,
    });
    return { category };
}

module.exports = {
    createPage, getPages, getPage, updatePage, deletePage,
    linkPages, unlinkPages, getBacklinks, getGraph,
    generateSummary,
    searchKnowledge,
    getCategories, createCategory,
};
