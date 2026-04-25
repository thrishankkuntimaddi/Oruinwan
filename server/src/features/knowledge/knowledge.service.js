const KnowledgePage = require('./KnowledgePage');
const PageLink = require('./PageLink');
const KnowledgeCategory = require('./KnowledgeCategory');

const aiSummarizer = require('../ai/ai.summarizer.service');

async function createPage(userId, workspaceId, data) {
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
    await page.populate('createdBy', 'username firstName lastName avatarUrl profilePicture');
    return { page };
}

async function getPages(userId, workspaceId, filters = {}) {
    const query = { workspaceId, isDeleted: false };
    if (filters.parentId !== undefined) {
        query.parentId = filters.parentId === 'root' ? null : filters.parentId;
    }
    if (filters.isHandbook !== undefined) query.isHandbook = filters.isHandbook === 'true';
    if (filters.categoryId) query.categoryId = filters.categoryId;

    const pages = await KnowledgePage.find(query)
        .populate('createdBy', 'username firstName lastName avatarUrl')
        .sort({ createdAt: -1 })
        .lean();

    return { pages };
}

async function getPage(userId, pageId) {
    const page = await KnowledgePage.findById(pageId)
        .populate('createdBy', 'username firstName lastName avatarUrl profilePicture')
        .lean();
    if (!page || page.isDeleted) throw Object.assign(new Error('Page not found'), { statusCode: 404 });
    return { page };
}

async function updatePage(userId, pageId, updates) {
    const page = await KnowledgePage.findById(pageId);
    if (!page || page.isDeleted) throw Object.assign(new Error('Page not found'), { statusCode: 404 });

    
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
    const page = await KnowledgePage.findById(pageId);
    if (!page || page.isDeleted) throw Object.assign(new Error('Page not found'), { statusCode: 404 });
    page.isDeleted = true;
    await page.save();
    
    await PageLink.deleteMany({ $or: [{ fromPageId: pageId }, { toPageId: pageId }] });
    return { message: 'Page deleted' };
}

async function linkPages(userId, fromPageId, toPageId, workspaceId) {
    if (fromPageId === toPageId) {
        throw Object.assign(new Error('Cannot link a page to itself'), { statusCode: 400 });
    }
    
    await PageLink.updateOne(
        { fromPageId, toPageId },
        { $setOnInsert: { fromPageId, toPageId, workspaceId } },
        { upsert: true }
    );
    return { message: 'Pages linked' };
}

async function unlinkPages(userId, fromPageId, toPageId) {
    await PageLink.deleteOne({ fromPageId, toPageId });
    return { message: 'Link removed' };
}

async function getBacklinks(userId, pageId) {
    const links = await PageLink.find({ toPageId: pageId })
        .populate({ path: 'fromPageId', select: 'title icon workspaceId' })
        .lean();
    const backlinks = links.map(l => l.fromPageId).filter(Boolean);
    return { backlinks };
}

async function getGraph(userId, workspaceId) {
    const [pages, links] = await Promise.all([
        KnowledgePage.find({ workspaceId, isDeleted: false }).select('title icon').lean(),
        PageLink.find({ workspaceId }).lean(),
    ]);

    const nodes = pages.map(p => ({ id: p._id, label: p.title, icon: p.icon }));
    const edges = links.map(l => ({ from: l.fromPageId, to: l.toPageId }));
    return { nodes, edges };
}

async function generateSummary(userId, pageId) {
    const page = await KnowledgePage.findById(pageId);
    if (!page || page.isDeleted) throw Object.assign(new Error('Page not found'), { statusCode: 404 });

    
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

async function getCategories(workspaceId) {
    const categories = await KnowledgeCategory.find({ workspaceId })
        .sort({ order: 1, name: 1 })
        .lean();
    return { categories };
}

async function createCategory(userId, workspaceId, data) {
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
