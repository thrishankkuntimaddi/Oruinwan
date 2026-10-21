const KnowledgePage = require('./KnowledgePage');
const PageLink = require('./PageLink');
const KnowledgeCategory = require('./KnowledgeCategory');
const { hydrate } = require('../../identity/hydrate');

const CREATOR = { type: 'user', fields: ['username', 'profilePicture', 'profile'] };

const aiSummarizer = require('../ai/ai.summarizer.service');
const mongoose = require('mongoose');

const collab = () => require('../../modules/collab/collab.service');

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
    // Keep an open live editor (and its stored Yjs state) in step with this write.
    if (updates.content !== undefined) await collab().contentChanged('knowledge', page._id, page.content, { workspaceId: String(page.workspaceId) });
    return { page };
}

async function deletePage(userId, pageId) {
    const page = await loadPage(pageId, userId);
    page.isDeleted = true;
    await page.save();
    await collab().documentDeleted('knowledge', page._id);
    
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

const badRequest = (message) => Object.assign(new Error(message), { statusCode: 400 });
const COLOR_RE = /^(#[0-9a-f]{3,8}|[a-z][a-z0-9-]{0,40})$/i;

/** Validated category fields from client input; `partial` skips missing fields. */
function categoryFields(data = {}, { partial = false } = {}) {
    const out = {};
    if (!partial || data.name !== undefined) {
        if (typeof data.name !== 'string' || !data.name.trim()) throw badRequest('Category name is required');
        if (data.name.trim().length > 80) throw badRequest('Category name must be at most 80 characters');
        out.name = data.name.trim();
    }
    if (data.color !== undefined && data.color !== null) {
        // A hex colour or a theme token name.
        if (typeof data.color !== 'string' || !COLOR_RE.test(data.color)) throw badRequest('Invalid color');
        out.color = data.color;
    }
    if (data.icon !== undefined && data.icon !== null) {
        if (typeof data.icon !== 'string' || data.icon.length > 16) throw badRequest('Invalid icon');
        out.icon = data.icon;
    }
    return out;
}

async function createCategory(userId, workspaceId, data) {
    await assertMember(workspaceId, userId);
    const fields = categoryFields(data);
    const duplicate = await KnowledgeCategory.findOne({ workspaceId, name: fields.name }).select('_id').lean();
    if (duplicate) throw Object.assign(new Error('A category with this name already exists'), { statusCode: 409 });
    const count = await KnowledgeCategory.countDocuments({ workspaceId });
    const category = await KnowledgeCategory.create({
        workspaceId,
        name: fields.name,
        color: fields.color || '#c8a274',
        icon: fields.icon || '📂',
        order: count,
    });
    return { category };
}

/** A category the user may change (member of its workspace); elsewhere it is "not found". */
async function loadCategory(categoryId, userId) {
    const missing = () => Object.assign(new Error('Category not found'), { statusCode: 404 });
    if (!mongoose.isValidObjectId(String(categoryId))) throw missing();
    const category = await KnowledgeCategory.findById(categoryId);
    if (!category) throw missing();
    try {
        await assertMember(category.workspaceId, userId);
    } catch (err) {
        if (err.statusCode === 403) throw missing();
        throw err;
    }
    return category;
}

async function updateCategory(userId, categoryId, data) {
    const category = await loadCategory(categoryId, userId);
    const fields = categoryFields(data, { partial: true });
    if (fields.name && fields.name !== category.name) {
        const duplicate = await KnowledgeCategory.findOne({ workspaceId: category.workspaceId, name: fields.name, _id: { $ne: category._id } }).select('_id').lean();
        if (duplicate) throw Object.assign(new Error('A category with this name already exists'), { statusCode: 409 });
    }
    Object.assign(category, fields);
    await category.save();
    return { category };
}

/** Delete a category; its pages stay and become uncategorised. */
async function deleteCategory(userId, categoryId) {
    const category = await loadCategory(categoryId, userId);
    const res = await KnowledgePage.updateMany(
        { workspaceId: category.workspaceId, categoryId: category._id },
        { $set: { categoryId: null } }
    );
    await KnowledgeCategory.deleteOne({ _id: category._id });
    return {
        message: 'Category deleted',
        categoryId: String(category._id),
        workspaceId: String(category.workspaceId),
        pagesUncategorised: (res && res.modifiedCount) || 0,
    };
}

/** Set the order of a workspace's categories: `ids` lists category ids first to last. */
async function reorderCategories(userId, workspaceId, ids) {
    await assertMember(workspaceId, userId);
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !mongoose.isValidObjectId(String(id)))) {
        throw badRequest('order must be a non-empty array of category ids');
    }
    const unique = [...new Set(ids.map(String))];
    const existing = await KnowledgeCategory.find({ workspaceId }).sort({ order: 1, name: 1 }).select('_id').lean();
    const known = new Set(existing.map(c => String(c._id)));
    if (unique.some(id => !known.has(id))) throw badRequest('order contains a category from another workspace');
    // Categories left out keep their relative order after the listed ones.
    const rest = existing.map(c => String(c._id)).filter(id => !unique.includes(id));
    const ordered = [...unique, ...rest];
    await KnowledgeCategory.bulkWrite(ordered.map((id, i) => ({
        updateOne: { filter: { _id: id, workspaceId }, update: { $set: { order: i } } },
    })));
    return getCategories(workspaceId, userId);
}

module.exports = {
    createPage, getPages, getPage, updatePage, deletePage,
    linkPages, unlinkPages, getBacklinks, getGraph,
    generateSummary,
    searchKnowledge,
    getCategories, createCategory, updateCategory, deleteCategory, reorderCategories,
};
