// server/src/features/search/search.service.js
/**
 * Unified Search Service
 *
 * Centralises all search DB logic and provides semantic re-ranking
 * via the existing Gemini AI core — no vector DB required.
 *
 * Exports:
 *   buildDateFilter(from, to)                               – shared date-range helper
 *   semanticRerank(query, results)                          – AI-powered result re-ranking
 *   searchAll(params)                                       – run all search types in parallel
 */

'use strict';

const Channel      = require('../channels/channel.model.js');
const User         = require('../../../models/User');
const Message      = require('../messages/message.model.js');
const Workspace    = require('../../../models/Workspace');
const Task         = require('../../../models/Task');
const Note         = require('../../../models/Note');
const WorkspaceFile = require('../files/WorkspaceFile');
const KnowledgePage = require('../knowledge/KnowledgePage');
const logger       = require('../../../utils/logger');

// ─── Gemini client (lazy, shared with ai-core) ────────────────────────────────
let _model = null;
function _getModel() {
    if (!_model) {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY || '';
        _model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.0-flash' });
    }
    return _model;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a createdAt filter from ISO date strings.
 * @param {string} [from] - ISO date string
 * @param {string} [to]   - ISO date string
 * @returns {object|null}  MongoDB filter object or null
 */
function buildDateFilter(from, to) {
    if (!from && !to) return null;
    const filter = {};
    if (from) filter.$gte = new Date(from);
    if (to)   filter.$lte = new Date(to);
    return filter;
}
exports.buildDateFilter = buildDateFilter;

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

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
    if (!apiKey) {
        logger.debug('[SearchService] semanticRerank: No AI key — skipping re-ranking');
        return results;
    }

    try {
        // Build a compact representation for the prompt
        const candidates = results.slice(0, 20).map((r, i) => {
            const label = r.title || r.text || r.name || 'untitled';
            const preview = r.preview || r.snippet || r.description || '';
            return `${i}: [${r.type}] ${label} — ${truncateText(stripMarkdown(preview), 80)}`;
        });

        const prompt = [
            `You are a relevance ranking engine for a team workspace search.`,
            `User query: "${query}"`,
            ``,
            `Rank the following results from MOST to LEAST relevant.`,
            `Return ONLY a JSON array of the original indices in ranked order, e.g. [2,0,4,1,3].`,
            `Do not include any explanation.`,
            ``,
            `Results:`,
            ...candidates,
        ].join('\n');

        const model = _getModel();
        const result = await model.generateContent(prompt);
        let raw = result.response.text().trim()
            .replace(/^```(?:json)?/m, '').replace(/```$/m, '').trim();

        const ranked = JSON.parse(raw);
        if (!Array.isArray(ranked)) throw new Error('Not an array');

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

async function searchChannels(workspaceId, userId, searchRegex, { dateFilter, limit, offset } = {}) {
    try {
        const query = {
            workspace: workspaceId,
            $or: [{ name: searchRegex }, { description: searchRegex }],
            $and: [{ $or: [{ isPrivate: false }, { 'members.user': userId }] }],
        };
        if (dateFilter) query.createdAt = dateFilter;

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
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return [];

        let userQuery;
        if (workspace.company) {
            userQuery = {
                companyId: workspace.company,
                _id: { $ne: userId },
                $or: [{ username: searchRegex }, { name: searchRegex }, { email: searchRegex }],
            };
        } else {
            const memberIds = (workspace.members || []).map(m => m.user || m).filter(Boolean);
            userQuery = {
                _id: { $in: memberIds, $ne: userId },
                $or: [{ username: searchRegex }, { name: searchRegex }, { email: searchRegex }],
            };
        }

        const contacts = await User.find(userQuery)
            .select('username name email profilePicture isOnline userStatus')
            .skip(offset || 0)
            .limit(limit || 10)
            .lean();

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

async function searchMessages(workspaceId, userId, searchRegex, { dateFilter, channelId, limit, offset } = {}) {
    try {
        const query = {
            workspace: workspaceId,
            text: searchRegex,
            $or: [{ channel: { $exists: true } }, { dm: { $exists: true } }],
        };
        if (dateFilter) query.createdAt = dateFilter;
        if (channelId)  query.channel = channelId;

        const messages = await Message.find(query)
            .sort({ createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .populate('sender', 'username profilePicture')
            .populate('channel', 'name isPrivate members')
            .populate({ path: 'dm', populate: { path: 'participants', select: 'username' } })
            .lean();

        const accessible = messages.filter(msg => {
            if (msg.channel) {
                return msg.channel.members?.some(m => {
                    const mid = m.user ? m.user.toString() : m.toString();
                    return mid === userId.toString();
                });
            } else if (msg.dm) {
                return msg.dm.participants?.some(p => p._id.toString() === userId.toString());
            }
            return false;
        });

        return accessible.map(msg => {
            const isChannel = !!msg.channel;
            const parentName = isChannel
                ? msg.channel.name
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
                createdAt: msg.createdAt,
            };
        });
    } catch (err) {
        logger.error('searchMessages error:', err);
        return [];
    }
}

async function searchTasks(workspaceId, userId, searchRegex, { dateFilter, tags, limit, offset } = {}) {
    try {
        const query = {
            workspace: workspaceId,
            deleted: false,
            $or: [{ title: searchRegex }, { description: searchRegex }, { tags: searchRegex }],
            $and: [{ $or: [{ visibility: 'workspace' }, { createdBy: userId }, { assignedTo: userId }] }],
        };
        if (dateFilter) query.createdAt = dateFilter;
        if (tags && tags.length > 0) query.tags = { $in: tags };

        const tasks = await Task.find(query)
            .select('title description status priority dueDate visibility createdBy assignedTo tags createdAt')
            .populate('createdBy', 'username profilePicture')
            .populate('assignedTo', 'username profilePicture')
            .sort({ createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .lean();

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

async function searchNotes(workspaceId, userId, searchRegex, { dateFilter, tags, limit, offset } = {}) {
    try {
        const query = {
            workspace: workspaceId,
            isArchived: false,
            $or: [{ title: searchRegex }, { content: searchRegex }, { tags: searchRegex }],
            $and: [{ $or: [{ owner: userId }, { isPublic: true }, { sharedWith: userId }] }],
        };
        if (dateFilter) query.createdAt = dateFilter;
        if (tags && tags.length > 0) query.tags = { $in: tags };

        const notes = await Note.find(query)
            .select('title content type isPublic owner tags createdAt isPinned')
            .populate('owner', 'username profilePicture')
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .lean();

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

async function searchFiles(workspaceId, searchRegex, { dateFilter, tags, limit, offset } = {}) {
    try {
        const query = {
            workspaceId,
            isDeleted: false,
            $or: [{ name: searchRegex }, { description: searchRegex }, { tags: searchRegex }],
        };
        if (dateFilter) query.createdAt = dateFilter;
        if (tags && tags.length > 0) query.tags = { $in: tags };

        const files = await WorkspaceFile.find(query)
            .select('name description mimeType size url tags createdBy createdAt')
            .populate('createdBy', 'username profilePicture')
            .sort({ createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .lean();

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

async function searchKnowledge(workspaceId, searchRegex, { dateFilter, tags, limit, offset } = {}) {
    try {
        const query = {
            workspaceId,
            isDeleted: false,
            $or: [{ title: searchRegex }, { content: searchRegex }, { tags: searchRegex }],
        };
        if (dateFilter) query.createdAt = dateFilter;
        if (tags && tags.length > 0) query.tags = { $in: tags };

        const pages = await KnowledgePage.find(query)
            .select('title icon content tags summary createdBy createdAt')
            .populate('createdBy', 'username profilePicture')
            .sort({ createdAt: -1 })
            .skip(offset || 0)
            .limit(limit || 10)
            .lean();

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

// ─── Main searchAll ───────────────────────────────────────────────────────────

/**
 * Run all search types in parallel with optional filters and pagination.
 *
 * @param {object}  params
 * @param {string}  params.query          - Search query string
 * @param {string}  params.workspaceId    - Target workspace
 * @param {string}  params.userId         - Requesting user (for access control)
 * @param {string}  [params.type]         - Filter to one type: message|file|user|channel|task|note|knowledge
 * @param {string}  [params.from]         - ISO date — createdAt >= from
 * @param {string}  [params.to]           - ISO date — createdAt <= to
 * @param {string}  [params.channelId]    - Filter messages to a specific channel
 * @param {string[]}[params.tags]         - Filter by tags
 * @param {number}  [params.limit=10]     - Results per type
 * @param {number}  [params.offset=0]     - Offset for pagination
 * @param {boolean} [params.semantic=true]- Enable AI re-ranking
 * @returns {Promise<object>}             - { messages, files, users, channels, tasks, notes, knowledge, query, total }
 */
async function searchAll(params) {
    const {
        query,
        workspaceId,
        userId,
        type,
        from,
        to,
        channelId,
        tags,
        limit = 10,
        offset = 0,
        semantic = true,
    } = params;

    if (!query || query.trim().length === 0) {
        return { messages: [], files: [], users: [], channels: [], tasks: [], notes: [], knowledge: [], query: '', total: 0 };
    }

    const searchTerm  = query.trim();
    const searchRegex = new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const dateFilter  = buildDateFilter(from, to);
    const pagination  = { limit: Math.min(limit, 50), offset: Math.max(offset, 0) };
    const tagList     = Array.isArray(tags) ? tags : (tags ? [tags] : []);
    const opts        = { dateFilter, channelId, tags: tagList, ...pagination };

    // Determine which search types to run
    const runAll      = !type || type === 'all';
    const runMessages = runAll || type === 'message';
    const runFiles    = runAll || type === 'file';
    const runUsers    = runAll || type === 'user' || type === 'contact';
    const runChannels = runAll || type === 'channel';
    const runTasks    = runAll || type === 'task';
    const runNotes    = runAll || type === 'note';
    const runKnowledge= runAll || type === 'knowledge';

    const [messages, files, users, channels, tasks, notes, knowledge] = await Promise.all([
        runMessages  ? searchMessages(workspaceId, userId, searchRegex, opts) : Promise.resolve([]),
        runFiles     ? searchFiles(workspaceId, searchRegex, opts)            : Promise.resolve([]),
        runUsers     ? searchContacts(workspaceId, userId, searchRegex, opts) : Promise.resolve([]),
        runChannels  ? searchChannels(workspaceId, userId, searchRegex, opts) : Promise.resolve([]),
        runTasks     ? searchTasks(workspaceId, userId, searchRegex, opts)    : Promise.resolve([]),
        runNotes     ? searchNotes(workspaceId, userId, searchRegex, opts)    : Promise.resolve([]),
        runKnowledge ? searchKnowledge(workspaceId, searchRegex, opts)        : Promise.resolve([]),
    ]);

    // For global (all-type) search, apply semantic re-ranking across the combined top results
    let allResults = { messages, files, users, channels, tasks, notes, knowledge };

    if (semantic && runAll) {
        const combined = [...messages, ...files, ...users, ...channels, ...tasks, ...notes, ...knowledge];
        const reranked  = await semanticRerank(searchTerm, combined);

        // Re-bucket results by type after re-ranking
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

    return { ...allResults, query: searchTerm, total };
}
exports.searchAll = searchAll;
