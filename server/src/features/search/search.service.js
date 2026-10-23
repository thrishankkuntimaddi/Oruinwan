'use strict';

const Channel      = require('../channels/channel.model.js');
const Message      = require('../../modules/messages/message.model.js');
const identity     = require('../../identity');
const wsQueries    = require('../../identity/queries/workspaces');
const { hydrate }  = require('../../identity/hydrate');
const Tasks        = require('../tasks/tasks.query');
const Note         = require('../../../models/Note');
const WorkspaceFile = require('../files/WorkspaceFile');
const KnowledgePage = require('../knowledge/KnowledgePage');
const DMSession    = require('../../../models/DMSession');
const logger       = require('../../../utils/logger');
const { safeRegex, escapeRegex } = require('../../shared/utils/escapeRegex');
const syntax       = require('./queryParser');

const gateway = require('../ai/ai.gatewayResolver');

// Users live in PostgreSQL; search results get their people attached with hydrate().
const PERSON = { type: 'user', fields: ['username', 'profilePicture'] };

function buildDateFilter(from, to) {
    if (!from && !to) return null;
    const filter = {};
    if (from) filter.$gte = new Date(from);
    if (to)   filter.$lte = new Date(to);
    return filter;
}
exports.buildDateFilter = buildDateFilter;

/**
 * Structured (operator) filters resolved to ids, passed to each search as
 * opts.meta: { fromIds, channelIds, dateRange, has, is }. Each field is
 * null/empty when its operator was not used.
 */
function addAnd(query, clause) {
    if (!clause) return;
    query.$and = [...(query.$and || []), clause];
}

function applyCommonMeta(query, meta, { fromField, channelField, dateField = 'createdAt' } = {}) {
    if (!meta) return;
    if (meta.fromIds && fromField) addAnd(query, { [fromField]: { $in: meta.fromIds } });
    if (meta.channelIds && channelField) addAnd(query, { [channelField]: { $in: meta.channelIds } });
    const range = syntax.dateRangeToMongo(meta.dateRange);
    if (range) addAnd(query, { [dateField]: range });
}

/** Text clause: $or of the fields matching the regex; nothing when there is no free text. */
function addText(query, searchRegex, fields) {
    if (!searchRegex) return;
    query.$or = fields.map(f => ({ [f]: searchRegex }));
}

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '…';
}

function stripMarkdown(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/^#{1,6}\s/gm, '')
        .replace(/\n+/g, ' ')
        .trim();
}

function extractSlateText(nodes) {
    if (!Array.isArray(nodes)) return '';
    return nodes.map(node => {
        if (node.text !== undefined) return node.text;
        if (node.children) return extractSlateText(node.children);
        return '';
    }).join(' ').replace(/\s+/g, ' ').trim();
}

function plainTextFromSlate(content) {
    if (!content) return '';
    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) return extractSlateText(parsed);
        } catch { /* not JSON */ }
        return stripMarkdown(content);
    }
    if (Array.isArray(content)) return extractSlateText(content);
    return String(content);
}

// ─── Semantic Re-ranking ──────────────────────────────────────────────────────

/**
 * Re-rank search results using Gemini AI.
 * If Gemini is unavailable or fails, returns the original order.
 *
 * @param {string} query        - Original search query
 * @param {Array}  results      - Up to 20 results with { id, type, title|text|name, preview|snippet }
 * @returns {Promise<Array>}    - Same results in re-ranked order with a relevanceScore field
 */
async function semanticRerank(query, results) {
    if (!results || results.length === 0) return results;

    // Skip re-ranking for very small result sets (already optimal)
    if (results.length <= 3) return results;


    try {
        // Build a compact representation for the prompt
        const candidates = results.slice(0, 20).map((r, i) => {
            const label = r.title || r.text || r.name || 'untitled';
            const preview = r.preview || r.snippet || r.description || '';
            return `${i}: [${r.type}] ${label} — ${truncateText(stripMarkdown(preview), 80)}`;
        });

        const head = results.slice(0, 20);
        const { scores } = await gateway.rerank({ query, docs: head.map((r, i) => ({ id: String(i), title: r.title || r.text || r.name || 'untitled', snippet: candidates[i] })) }, { userId: 'system' });
        const ranked = head.map((_, i) => i).sort((a, b) => (scores[b] || 0) - (scores[a] || 0));

        // Re-order results according to AI ranking
        const reranked = ranked
            .filter(i => typeof i === 'number' && i >= 0 && i < results.length)
            .map((i, rank) => ({ ...results[i], relevanceScore: results.length - rank }));

        // Append any results that AI didn't include (safety net)
        const included = new Set(ranked);
        for (let i = 0; i < results.length; i++) {
            if (!included.has(i)) reranked.push({ ...results[i], relevanceScore: 0 });
        }

        return reranked;
    } catch (err) {
        logger.warn('[SearchService] semanticRerank failed — using original order:', err.message);
        return results;
    }
}
exports.semanticRerank = semanticRerank;

// ─── Individual Search Functions ─────────────────────────────────────────────

async function searchChannels(workspaceId, userId, searchRegex, { dateFilter, limit, offset, meta } = {}) {
    try {
        const query = {
            workspace: workspaceId,
            $and: [{ $or: [{ isPrivate: false }, { 'members.user': userId }] }],
        };
        addText(query, searchRegex, ['name', 'description']);
        if (dateFilter) query.createdAt = dateFilter;
        applyCommonMeta(query, meta, { fromField: 'createdBy' });

        const channels = await Channel.find(query)
            .select('name description isPrivate isDefault members createdAt')
            .sort({ createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .lean();

        return channels.map(ch => ({
            id: ch._id,
            type: 'channel',
            name: ch.name,
            description: ch.description || '',
            isPrivate: ch.isPrivate,
            isDefault: ch.isDefault,
            memberCount: ch.members?.length || 0,
            icon: ch.isPrivate ? '🔒' : '#',
            createdAt: ch.createdAt,
        }));
    } catch (err) {
        logger.error('searchChannels error:', err);
        return [];
    }
}

async function searchContacts(workspaceId, userId, searchRegex, { limit, offset } = {}) {
    try {
        const workspace = await identity.workspaces.findById(workspaceId);
        if (!workspace) return [];

        // safeRegex() escaped the term for MongoDB; PostgreSQL gets the plain text back.
        const text = searchRegex instanceof RegExp
            ? (searchRegex.source === '(?:)' ? '' : searchRegex.source.replace(/\\(.)/g, '$1'))
            : String(searchRegex || '');
        const contacts = await wsQueries.searchPeople(workspace, userId, text, { limit: limit || 10, offset: offset || 0 });

        return contacts.map(user => ({
            id: user._id,
            type: 'contact',
            name: user.username || user.name || user.email,
            email: user.email,
            profilePicture: user.profilePicture,
            isOnline: user.isOnline || false,
            userStatus: user.userStatus || 'active',
        }));
    } catch (err) {
        logger.error('searchContacts error:', err);
        return [];
    }
}

/**
 * Channels (the caller is a member of) and DM sessions (the caller participates
 * in) inside the workspace. Used to apply visibility in the DB query itself so
 * skip/limit paginate over results the caller may actually see.
 */
async function accessibleScopes(workspaceId, userId) {
    const [channels, dms] = await Promise.all([
        Channel.find({ workspace: workspaceId, 'members.user': userId }).select('_id').lean(),
        DMSession.find({ workspace: workspaceId, participants: userId }).select('_id').lean(),
    ]);
    return {
        channelIds: (channels || []).map(c => c._id),
        dmIds: (dms || []).map(d => d._id),
    };
}
exports.accessibleScopes = accessibleScopes;

async function searchMessages(workspaceId, userId, searchRegex, { dateFilter, channelId, limit, offset, scopes, meta } = {}) {
    try {
        const { channelIds, dmIds } = scopes || await accessibleScopes(workspaceId, userId);
        let channelScope = channelIds;
        if (channelId) {
            channelScope = channelIds.filter(id => String(id) === String(channelId));
        }
        // in:#channel narrows to those channels (DMs drop out); still only ones the caller is in.
        if (meta?.channelIds) {
            const wanted = new Set(meta.channelIds.map(String));
            channelScope = channelScope.filter(id => wanted.has(String(id)));
        }
        const parentScope = [{ channel: { $in: channelScope } }];
        if (!channelId && !meta?.channelIds) parentScope.push({ dm: { $in: dmIds } });

        const query = {
            workspace: workspaceId,
            isDeleted: { $ne: true },
            isDeletedUniversally: { $ne: true },
            hiddenFor: { $ne: userId },
            deletedFor: { $ne: userId },
            $or: parentScope,
        };
        // Message bodies are end-to-end encrypted: free text only ever matches
        // plaintext (system/bot) messages; operators match metadata.
        if (searchRegex) query.text = searchRegex;
        if (dateFilter) query.createdAt = dateFilter;
        applyCommonMeta(query, meta, { fromField: 'sender' });
        for (const h of meta?.has || []) {
            if (h === 'file') addAnd(query, { 'attachments.0': { $exists: true } });
            if (h === 'image') addAnd(query, { 'attachments.type': 'image' });
            if (h === 'link') addAnd(query, { 'linkPreview.url': { $exists: true, $nin: [null, ''] } });
        }
        for (const v of meta?.is || []) {
            if (v === 'pinned') addAnd(query, { isPinned: true });
            if (v === 'thread') addAnd(query, { $or: [{ parentId: { $ne: null } }, { replyCount: { $gt: 0 } }] });
        }

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .populate('channel', 'name isPrivate')
            .populate('dm')
            .lean();
        await hydrate(messages, { sender: PERSON, 'dm.participants': { type: 'user', fields: ['username'] } });

        return messages.filter(msg => msg.channel || msg.dm).map(msg => {
            const isChannel = !!msg.channel;
            const parentName = isChannel
                ? msg.channel.name
                : msg.dm?.isGroup
                    ? require('../../modules/messages/groupDM.service').groupDisplayName(msg.dm, userId)
                    : msg.dm?.participants?.find(p => p._id.toString() !== userId.toString())?.username || 'Unknown';
            return {
                id: msg._id,
                type: 'message',
                text: msg.text,
                preview: truncateText(stripMarkdown(msg.text), 120),
                sender: msg.sender
                    ? { id: msg.sender._id, name: msg.sender.username, profilePicture: msg.sender.profilePicture }
                    : null,
                parent: {
                    id: isChannel ? msg.channel._id : msg.dm?._id,
                    type: isChannel ? 'channel' : 'dm',
                    name: parentName,
                },
                isEncrypted: !!msg.payload?.isEncrypted,
                isPinned: !!msg.isPinned,
                parentId: msg.parentId || null,
                replyCount: msg.replyCount || 0,
                attachmentCount: (msg.attachments || []).length,
                createdAt: msg.createdAt,
            };
        });
    } catch (err) {
        logger.error('searchMessages error:', err);
        return [];
    }
}

async function searchTasks(workspaceId, userId, searchRegex, { dateFilter, tags, limit, offset, scopes, meta } = {}) {
    try {
        const { channelIds } = scopes || await accessibleScopes(workspaceId, userId);
        const query = {
            workspace: workspaceId,
            deleted: { $ne: true },
            deletedFor: { $ne: userId },
            $and: [{ $or: [
                { visibility: 'workspace' },
                { visibility: 'channel', channel: { $in: channelIds } },
                { createdBy: userId },
                { assignedTo: userId },
            ] }],
        };
        addText(query, searchRegex, ['title', 'description', 'tags']);
        if (dateFilter) query.createdAt = dateFilter;
        if (tags && tags.length > 0) query.tags = { $in: tags };
        applyCommonMeta(query, meta, { fromField: 'createdBy', channelField: 'channel' });

        const tasks = await Tasks.find(query, {
            select: 'title description status priority dueDate visibility createdBy assignedTo tags createdAt',
            sort: { createdAt: -1 },
            skip: offset || 0,
            limit: limit || 10,
        });
        await hydrate(tasks, { createdBy: PERSON, assignedTo: PERSON });

        return tasks
            .filter(t => t.createdBy != null)
            .map(t => ({
                id: t._id,
                type: 'task',
                title: t.title,
                description: truncateText(t.description || '', 100),
                status: t.status,
                priority: t.priority,
                dueDate: t.dueDate,
                visibility: t.visibility,
                tags: t.tags || [],
                createdBy: { id: t.createdBy._id, name: t.createdBy.username, profilePicture: t.createdBy.profilePicture },
                assignedTo: (t.assignedTo || []).filter(u => u != null).map(u => ({ id: u._id, name: u.username, profilePicture: u.profilePicture })),
                createdAt: t.createdAt,
            }));
    } catch (err) {
        logger.error('searchTasks error:', err);
        return [];
    }
}

async function searchNotes(workspaceId, userId, searchRegex, { dateFilter, tags, limit, offset, meta } = {}) {
    try {
        const query = {
            workspace: workspaceId,
            isArchived: false,
            $and: [{ $or: [{ owner: userId }, { isPublic: true }, { sharedWith: userId }] }],
        };
        addText(query, searchRegex, ['title', 'content', 'tags']);
        if (dateFilter) query.createdAt = dateFilter;
        if (tags && tags.length > 0) query.tags = { $in: tags };
        applyCommonMeta(query, meta, { fromField: 'owner', channelField: 'channel' });
        for (const h of meta?.has || []) {
            if (h === 'file') addAnd(query, { 'attachments.0': { $exists: true } });
            if (h === 'image') addAnd(query, { 'attachments.category': 'image' });
        }
        if ((meta?.is || []).includes('pinned')) addAnd(query, { isPinned: true });

        const notes = await Note.find(query)
            .select('title content type isPublic owner tags createdAt isPinned')
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .lean();
        await hydrate(notes, { owner: PERSON });

        return notes
            .filter(n => n.owner != null)
            .map(n => ({
                id: n._id,
                type: 'note',
                title: n.title,
                preview: truncateText(plainTextFromSlate(n.content), 120),
                noteType: n.type,
                isPublic: n.isPublic,
                isPinned: n.isPinned,
                tags: n.tags || [],
                owner: { id: n.owner._id, name: n.owner.username, profilePicture: n.owner.profilePicture },
                createdAt: n.createdAt,
            }));
    } catch (err) {
        logger.error('searchNotes error:', err);
        return [];
    }
}

async function searchFiles(workspaceId, searchRegex, { dateFilter, tags, limit, offset, meta } = {}) {
    try {
        const query = {
            workspaceId,
            isDeleted: false,
        };
        addText(query, searchRegex, ['name', 'description', 'tags']);
        if (dateFilter) query.createdAt = dateFilter;
        if (tags && tags.length > 0) query.tags = { $in: tags };
        applyCommonMeta(query, meta, { fromField: 'createdBy' });
        if ((meta?.has || []).includes('image')) addAnd(query, { mimeType: /^image\// });

        const files = await WorkspaceFile.find(query)
            .select('name description mimeType size url tags createdBy createdAt')
            .sort({ createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .lean();
        await hydrate(files, { createdBy: PERSON });

        return files.map(f => ({
            id: f._id,
            type: 'file',
            name: f.name,
            description: truncateText(f.description || '', 100),
            mimeType: f.mimeType,
            size: f.size,
            url: f.url,
            tags: f.tags || [],
            createdBy: f.createdBy
                ? { id: f.createdBy._id, name: f.createdBy.username, profilePicture: f.createdBy.profilePicture }
                : null,
            createdAt: f.createdAt,
        }));
    } catch (err) {
        logger.error('searchFiles error:', err);
        return [];
    }
}

async function searchKnowledge(workspaceId, searchRegex, { dateFilter, tags, limit, offset, meta } = {}) {
    try {
        const query = {
            workspaceId,
            isDeleted: false,
        };
        addText(query, searchRegex, ['title', 'content', 'tags']);
        if (dateFilter) query.createdAt = dateFilter;
        if (tags && tags.length > 0) query.tags = { $in: tags };
        applyCommonMeta(query, meta, { fromField: 'createdBy' });

        const pages = await KnowledgePage.find(query)
            .select('title icon content tags summary createdBy createdAt')
            .sort({ createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .lean();
        await hydrate(pages, { createdBy: PERSON });

        return pages.map(p => ({
            id: p._id,
            type: 'knowledge',
            title: p.title,
            icon: p.icon || '📄',
            snippet: truncateText((p.summary || p.content || '').replace(/[#*>`_\[\]]/g, ''), 120),
            tags: p.tags || [],
            createdBy: p.createdBy
                ? { id: p.createdBy._id, name: p.createdBy.username, profilePicture: p.createdBy.profilePicture }
                : null,
            createdAt: p.createdAt,
        }));
    } catch (err) {
        logger.error('searchKnowledge error:', err);
        return [];
    }
}

const EMPTY_BUCKETS = () => ({ messages: [], files: [], users: [], channels: [], tasks: [], notes: [], knowledge: [] });

/** The `syntax` block echoed in responses so clients can show chips/warnings. */
function syntaxSummary(parsed) {
    return { text: parsed.text, filters: parsed.filters, warnings: parsed.warnings };
}
exports.syntaxSummary = syntaxSummary;

/**
 * Resolve operator values to ids. from:me → caller; from:@name → that user
 * (unknown names resolve to no ids, so nothing matches). in:#name → channels
 * of that name the caller can see (public or member).
 */
async function resolveMeta(workspaceId, userId, parsed) {
    const f = parsed.filters;
    const meta = { fromIds: null, channelIds: null, dateRange: parsed.dateRange, has: f.has, is: f.is };

    if (f.from.length) {
        const ids = await Promise.all(f.from.map(async (name) => {
            if (name === 'me') return String(userId);
            try {
                const u = await identity.users.findByUsername(name);
                return u ? String(u._id || u.id) : null;
            } catch (err) {
                logger.warn('[SearchService] from: lookup failed:', err.message);
                return null;
            }
        }));
        meta.fromIds = ids.filter(Boolean);
    }

    if (f.in.length) {
        const channels = await Channel.find({
            workspace: workspaceId,
            $or: f.in.map(name => ({ name: new RegExp(`^${escapeRegex(name)}$`, 'i') })),
            $and: [{ $or: [{ isPrivate: false }, { 'members.user': userId }] }],
        }).select('_id').lean();
        meta.channelIds = (channels || []).map(c => c._id);
    }
    return meta;
}
exports.resolveMeta = resolveMeta;

const PARAM_TYPE_TO_KIND = { message: 'message', file: 'file', user: 'user', contact: 'user', channel: 'channel', task: 'task', note: 'note', knowledge: 'knowledge', page: 'knowledge' };

/**
 * Run the per-kind searches for a parsed query.
 * params: { workspaceId, userId, type, from, to, channelId, tags, limit, offset, limits: { [kind]: n } }
 */
async function runStructured(parsed, { workspaceId, userId, type, from, to, channelId, tags, limit = 10, offset = 0, limits = {} }) {
    let kinds = syntax.applicableKinds(parsed);
    if (type && type !== 'all') {
        const k = PARAM_TYPE_TO_KIND[type];
        kinds = k ? kinds.filter(x => x === k) : [];
    }
    const searchRegex = syntax.textRegex(parsed);
    const dateFilter  = buildDateFilter(from, to);
    const pagination  = { limit: Math.min(limit, 50), offset: Math.max(offset, 0) };
    const tagList     = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    const run = (k) => kinds.includes(k);
    const scopes      = (run('message') || run('task')) ? await accessibleScopes(workspaceId, userId) : null;
    const meta        = parsed.hasFilters ? await resolveMeta(workspaceId, userId, parsed) : null;
    const opts        = { dateFilter, channelId, tags: tagList, scopes, meta, ...pagination };
    const o = (k) => (limits[k] ? { ...opts, limit: limits[k] } : opts);
    // People search needs a name, unless the query explicitly asks for type:person.
    const peopleRegex = parsed.text ? safeRegex(parsed.text) : (parsed.filters.types.includes('user') ? safeRegex('') : null);

    const [messages, files, users, channels, tasks, notes, knowledge] = await Promise.all([
        run('message')   ? searchMessages(workspaceId, userId, searchRegex, o('message')) : [],
        run('file')      ? searchFiles(workspaceId, searchRegex, o('file'))               : [],
        run('user') && peopleRegex ? searchContacts(workspaceId, userId, peopleRegex, o('user')) : [],
        run('channel')   ? searchChannels(workspaceId, userId, searchRegex, o('channel')) : [],
        run('task')      ? searchTasks(workspaceId, userId, searchRegex, o('task'))       : [],
        run('note')      ? searchNotes(workspaceId, userId, searchRegex, o('note'))       : [],
        run('knowledge') ? searchKnowledge(workspaceId, searchRegex, o('knowledge'))      : [],
    ]);
    return { buckets: { messages, files, users, channels, tasks, notes, knowledge }, kinds };
}
exports.runStructured = runStructured;

async function searchAll(params) {
    const { query, semantic = true, type } = params;
    const raw = typeof query === 'string' ? query.trim() : '';

    const parsed = syntax.parseQuery(raw);
    if (!parsed.text && !parsed.hasFilters) {
        return { ...EMPTY_BUCKETS(), query: '', total: 0, syntax: syntaxSummary(parsed) };
    }

    const { buckets } = await runStructured(parsed, params);
    let allResults = buckets;

    const runAll = (!type || type === 'all') && parsed.filters.types.length !== 1;
    if (semantic && runAll && parsed.text) {
        const combined = Object.values(buckets).flat();
        const reranked  = await semanticRerank(parsed.text, combined);
        const bucket = (typeName) => reranked.filter(r => r.type === typeName);
        allResults = {
            messages:  bucket('message'),
            files:     bucket('file'),
            users:     bucket('contact'),
            channels:  bucket('channel'),
            tasks:     bucket('task'),
            notes:     bucket('note'),
            knowledge: bucket('knowledge'),
        };
    }

    const total = Object.values(allResults).reduce((s, arr) => s + arr.length, 0);
    return { ...allResults, query: raw, total, syntax: syntaxSummary(parsed) };
}
exports.searchAll = searchAll;

exports.searchMessages  = searchMessages;
exports.searchFiles     = searchFiles;
exports.searchContacts  = searchContacts;
exports.searchChannels  = searchChannels;
exports.searchTasks     = searchTasks;
exports.searchNotes     = searchNotes;
exports.searchKnowledge = searchKnowledge;
