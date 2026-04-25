'use strict';

const Workspace  = require('../../../models/Workspace');
const logger     = require('../../../utils/logger');
const searchSvc  = require('./search.service');

const Channel       = require('../channels/channel.model.js');
const User          = require('../../../models/User');
const Message       = require('../messages/message.model.js');
const Task          = require('../../../models/Task');
const Note          = require('../../../models/Note');
const WorkspaceFile = require('../files/WorkspaceFile');
const KnowledgePage = require('../knowledge/KnowledgePage');

function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength) + '…';
}
function stripMarkdown(text) {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1').replace(/_([^_]+)_/g, '$1')
        .replace(/~~([^~]+)~~/g, '$1').replace(/`([^`]+)`/g, '$1')
        .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^#{1,6}\s/gm, '')
        .replace(/\n+/g, ' ').trim();
}
function plainTextFromSlate(content) {
    if (!content) return '';
    if (typeof content === 'string') {
        try { const p = JSON.parse(content); if (Array.isArray(p)) return extractSlateText(p); } catch { /* ignore */ }
        return stripMarkdown(content);
    }
    if (Array.isArray(content)) return extractSlateText(content);
    return String(content);
}
function extractSlateText(nodes) {
    if (!Array.isArray(nodes)) return '';
    return nodes.map(n => n.text !== undefined ? n.text : (n.children ? extractSlateText(n.children) : '')).join(' ').replace(/\s+/g, ' ').trim();
}

// ─── v2: Unified Search ───────────────────────────────────────────────────────

/**
 * GET /api/search
 * Query params:
 *   q           - search term (required)
 *   workspaceId - workspace to scope the search (required)
 *   type        - filter to one type: message | file | user | channel | task | note | knowledge | all (default: all)
 *   from        - ISO date filter (createdAt >= from)
 *   to          - ISO date filter (createdAt <= to)
 *   channelId   - scope message search to a channel
 *   tags        - comma-separated tag list
 *   limit       - results per type (default 10, max 50)
 *   offset      - pagination offset (default 0)
 *   semantic    - 'true'|'false' — enable AI re-ranking (default: true)
 */
exports.search = async (req, res) => {
    try {
        const userId = req.user.sub;
        const {
            q,
            workspaceId,
            type,
            from,
            to,
            channelId,
            semantic = 'true',
        } = req.query;

        let { tags, limit = 10, offset = 0 } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ message: 'workspaceId is required' });
        }

        if (!q || q.trim().length === 0) {
            return res.json({
                messages: [], files: [], users: [], channels: [],
                tasks: [], notes: [], knowledge: [], query: '', total: 0,
            });
        }

        // Validate workspace access
        const workspace = await Workspace.findById(workspaceId).select('_id').lean();
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        // Parse tags
        const tagList = tags
            ? (Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean))
            : [];

        const results = await searchSvc.searchAll({
            query:       q.trim(),
            workspaceId,
            userId,
            type:        type || 'all',
            from,
            to,
            channelId,
            tags:        tagList,
            limit:       Math.min(Number(limit) || 10, 50),
            offset:      Math.max(Number(offset) || 0, 0),
            semantic:    semantic !== 'false',
        });

        return res.json(results);
    } catch (err) {
        logger.error('[SearchCtrl] /api/search error:', err);
        return res.status(500).json({ message: 'Search failed' });
    }
};

// ─── Legacy: Universal Search ─────────────────────────────────────────────────

/**
 * GET /api/search/universal
 * Maintained for backward compatibility with existing client calls.
 */
exports.universalSearch = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, query } = req.query;

        logger.debug('🔍 [UNIVERSAL SEARCH] Request received:', { userId, workspaceId, query });

        if (!workspaceId) {
            return res.status(400).json({ message: 'Workspace ID is required' });
        }

        if (!query || query.trim().length === 0) {
            return res.json({ channels: [], contacts: [], messages: [] });
        }

        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const searchTerm  = query.trim();
        const searchRegex = new RegExp(searchTerm, 'i');

        const [channels, contacts, messages, tasks, notes, files, knowledge] = await Promise.all([
            legacySearchChannels(workspaceId, userId, searchRegex),
            legacySearchContacts(workspaceId, userId, searchRegex),
            legacySearchMessages(workspaceId, userId, searchRegex),
            legacySearchTasks(workspaceId, userId, searchRegex),
            legacySearchNotes(workspaceId, userId, searchRegex),
            legacySearchFiles(workspaceId, searchRegex),
            legacySearchKnowledgePages(workspaceId, searchRegex),
        ]);

        return res.json({ channels, contacts, messages, tasks, notes, files, knowledge, query: searchTerm });
    } catch (err) {
        logger.error('UNIVERSAL SEARCH ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

// ─── Legacy: Contacts Search ──────────────────────────────────────────────────

exports.searchContactsHandler = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, query } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ message: 'Workspace ID is required' });
        }

        const searchTerm  = (query || '').trim();
        const searchRegex = new RegExp(searchTerm, 'i');
        const contacts    = await legacySearchContacts(workspaceId, userId, searchRegex);
        return res.json({ contacts });
    } catch (err) {
        logger.error('SEARCH CONTACTS ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

// ─── Legacy internal functions ────────────────────────────────────────────────
// Kept for /universal endpoint backward-compat (thin wrappers)

async function legacySearchChannels(workspaceId, userId, searchRegex) {
    try {
        const channels = await Channel.find({
            workspace: workspaceId,
            $or: [{ name: searchRegex }, { description: searchRegex }],
            $and: [{ $or: [{ isPrivate: false }, { 'members.user': userId }] }],
        }).select('name description isPrivate isDefault members createdAt').limit(10).lean();

        return channels.map(ch => ({
            id: ch._id, type: 'channel', name: ch.name,
            description: ch.description || '', isPrivate: ch.isPrivate,
            isDefault: ch.isDefault, memberCount: ch.members?.length || 0,
            icon: ch.isPrivate ? '🔒' : '#',
        }));
    } catch (err) { logger.error('Legacy searchChannels error:', err); return []; }
}

async function legacySearchContacts(workspaceId, userId, searchRegex) {
    try {
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) return [];
        let q;
        if (workspace.company) {
            q = { companyId: workspace.company, _id: { $ne: userId }, $or: [{ username: searchRegex }, { name: searchRegex }, { email: searchRegex }] };
        } else {
            const memberIds = (workspace.members || []).map(m => m.user || m).filter(Boolean);
            q = { _id: { $in: memberIds, $ne: userId }, $or: [{ username: searchRegex }, { name: searchRegex }, { email: searchRegex }] };
        }
        const contacts = await User.find(q).select('username name email profilePicture isOnline userStatus').limit(10).lean();
        return contacts.map(u => ({ id: u._id, type: 'contact', name: u.username || u.name || u.email, email: u.email, profilePicture: u.profilePicture, isOnline: u.isOnline || false, userStatus: u.userStatus || 'active' }));
    } catch (err) { logger.error('Legacy searchContacts error:', err); return []; }
}

async function legacySearchMessages(workspaceId, userId, searchRegex) {
    try {
        const messages = await Message.find({
            workspace: workspaceId, text: searchRegex,
            $or: [{ channel: { $exists: true } }, { dm: { $exists: true } }],
        }).sort({ createdAt: -1 }).limit(3)
            .populate('sender', 'username profilePicture')
            .populate('channel', 'name isPrivate members')
            .populate({ path: 'dm', populate: { path: 'participants', select: 'username' } })
            .lean();

        const accessible = messages.filter(msg => {
            if (msg.channel) return msg.channel.members?.some(m => (m.user ? m.user.toString() : m.toString()) === userId.toString());
            if (msg.dm) return msg.dm.participants?.some(p => p._id.toString() === userId.toString());
            return false;
        });

        return accessible.map(msg => {
            const isChannel  = !!msg.channel;
            const parentName = isChannel ? msg.channel.name : msg.dm?.participants?.find(p => p._id.toString() !== userId.toString())?.username || 'Unknown';
            return { id: msg._id, type: 'message', text: msg.text, sender: { id: msg.sender._id, name: msg.sender.username, profilePicture: msg.sender.profilePicture }, parent: { id: isChannel ? msg.channel._id : msg.dm._id, type: isChannel ? 'channel' : 'dm', name: parentName }, createdAt: msg.createdAt, preview: truncateText(stripMarkdown(msg.text), 120) };
        });
    } catch (err) { logger.error('Legacy searchMessages error:', err); return []; }
}

async function legacySearchTasks(workspaceId, userId, searchRegex) {
    try {
        const tasks = await Task.find({
            workspace: workspaceId, deleted: false,
            $or: [{ title: searchRegex }, { description: searchRegex }, { tags: searchRegex }],
            $and: [{ $or: [{ visibility: 'workspace' }, { createdBy: userId }, { assignedTo: userId }] }],
        }).select('title description status priority dueDate visibility createdBy assignedTo tags createdAt')
            .populate('createdBy', 'username profilePicture').populate('assignedTo', 'username profilePicture')
            .sort({ createdAt: -1 }).limit(10).lean();

        return tasks.filter(t => t.createdBy != null).map(t => ({
            id: t._id, type: 'task', title: t.title,
            description: truncateText(t.description || '', 100),
            status: t.status, priority: t.priority, dueDate: t.dueDate, visibility: t.visibility,
            createdBy: { id: t.createdBy._id, name: t.createdBy.username, profilePicture: t.createdBy.profilePicture },
            assignedTo: (t.assignedTo || []).filter(u => u != null).map(u => ({ id: u._id, name: u.username, profilePicture: u.profilePicture })),
            tags: t.tags || [], createdAt: t.createdAt,
        }));
    } catch (err) { logger.error('Legacy searchTasks error:', err); return []; }
}

async function legacySearchNotes(workspaceId, userId, searchRegex) {
    try {
        const notes = await Note.find({
            workspace: workspaceId, isArchived: false,
            $or: [{ title: searchRegex }, { content: searchRegex }, { tags: searchRegex }],
            $and: [{ $or: [{ owner: userId }, { isPublic: true }, { sharedWith: userId }] }],
        }).select('title content type isPublic owner tags createdAt isPinned')
            .populate('owner', 'username profilePicture')
            .sort({ isPinned: -1, createdAt: -1 }).limit(10).lean();

        return notes.filter(n => n.owner != null).map(n => ({
            id: n._id, type: 'note', title: n.title,
            preview: truncateText(plainTextFromSlate(n.content), 120),
            noteType: n.type, isPublic: n.isPublic, isPinned: n.isPinned,
            owner: { id: n.owner._id, name: n.owner.username, profilePicture: n.owner.profilePicture },
            tags: n.tags || [], createdAt: n.createdAt,
        }));
    } catch (err) { logger.error('Legacy searchNotes error:', err); return []; }
}

async function legacySearchFiles(workspaceId, searchRegex) {
    try {
        const files = await WorkspaceFile.find({
            workspaceId, isDeleted: false,
            $or: [{ name: searchRegex }, { description: searchRegex }, { tags: searchRegex }],
        }).select('name description mimeType size url tags createdBy createdAt')
            .populate('createdBy', 'username profilePicture').sort({ createdAt: -1 }).limit(10).lean();

        return files.map(f => ({
            id: f._id, type: 'file', name: f.name,
            description: truncateText(f.description || '', 100),
            mimeType: f.mimeType, size: f.size, url: f.url, tags: f.tags || [],
            createdBy: f.createdBy ? { id: f.createdBy._id, name: f.createdBy.username, profilePicture: f.createdBy.profilePicture } : null,
            createdAt: f.createdAt,
        }));
    } catch (err) { logger.error('Legacy searchFiles error:', err); return []; }
}

async function legacySearchKnowledgePages(workspaceId, searchRegex) {
    try {
        const pages = await KnowledgePage.find({
            workspaceId, isDeleted: false,
            $or: [{ title: searchRegex }, { content: searchRegex }, { tags: searchRegex }],
        }).select('title icon content tags summary createdBy createdAt')
            .populate('createdBy', 'username profilePicture').sort({ createdAt: -1 }).limit(10).lean();

        return pages.map(p => ({
            id: p._id, type: 'knowledge', title: p.title, icon: p.icon || '📄',
            snippet: truncateText((p.summary || p.content || '').replace(/[#*>`_\[\]]/g, ''), 120),
            tags: p.tags || [],
            createdBy: p.createdBy ? { id: p.createdBy._id, name: p.createdBy.username, profilePicture: p.createdBy.profilePicture } : null,
            createdAt: p.createdAt,
        }));
    } catch (err) { logger.error('Legacy searchKnowledgePages error:', err); return []; }
}
