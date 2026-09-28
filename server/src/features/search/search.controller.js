'use strict';

const logger     = require('../../../utils/logger');
const searchSvc  = require('./search.service');
const { safeRegex } = require('../../shared/utils/escapeRegex');
const { isValidId } = require('../../shared/utils/workspaceAccess');

// Workspace membership (active member, 400 on malformed id, 403 otherwise) is
// enforced by requireWorkspaceAccess in search.routes.js before these run.

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

        const { tags, limit = 10, offset = 0 } = req.query;

        if (!workspaceId) {
            return res.status(400).json({ message: 'workspaceId is required' });
        }

        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            return res.json({
                messages: [], files: [], users: [], channels: [],
                tasks: [], notes: [], knowledge: [], query: '', total: 0,
            });
        }

        if (channelId && !isValidId(channelId)) {
            return res.status(400).json({ message: 'Invalid channelId' });
        }
        if ((from && isNaN(Date.parse(from))) || (to && isNaN(Date.parse(to)))) {
            return res.status(400).json({ message: 'Invalid date filter' });
        }

        // Parse tags (strings only)
        const tagList = tags
            ? (Array.isArray(tags) ? tags : String(tags).split(','))
                .filter(t => typeof t === 'string').map(t => t.trim()).filter(Boolean)
            : [];

        const results = await searchSvc.searchAll({
            query:       String(q).trim(),
            workspaceId,
            userId,
            type:        type || 'all',
            from,
            to,
            channelId,
            tags:        tagList,
            limit:       Math.min(Number(limit) || 10, 50),
            offset:      Math.max(Number(offset) || 0, 0),
            semantic:    String(semantic).toLowerCase() !== 'false' && semantic !== '0',
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
 * Maintained for backward compatibility with existing client calls. Uses the
 * same (visibility-filtered, regex-escaped) search functions as /api/search.
 */
exports.universalSearch = async (req, res) => {
    try {
        const userId = req.user.sub;
        const { workspaceId, query } = req.query;

        if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return res.json({ channels: [], contacts: [], messages: [] });
        }

        const searchTerm  = query.trim();
        const searchRegex = safeRegex(searchTerm);
        const scopes      = await searchSvc.accessibleScopes(workspaceId, userId);
        const opts        = { limit: 10, offset: 0, scopes };

        const [channels, contacts, messages, tasks, notes, files, knowledge] = await Promise.all([
            searchSvc.searchChannels(workspaceId, userId, searchRegex, opts),
            searchSvc.searchContacts(workspaceId, userId, searchRegex, opts),
            searchSvc.searchMessages(workspaceId, userId, searchRegex, { ...opts, limit: 3 }),
            searchSvc.searchTasks(workspaceId, userId, searchRegex, opts),
            searchSvc.searchNotes(workspaceId, userId, searchRegex, opts),
            searchSvc.searchFiles(workspaceId, searchRegex, opts),
            searchSvc.searchKnowledge(workspaceId, searchRegex, opts),
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

        const searchTerm  = typeof query === 'string' ? query.trim() : '';
        const searchRegex = safeRegex(searchTerm);
        const contacts    = await searchSvc.searchContacts(workspaceId, userId, searchRegex, { limit: 10, offset: 0 });
        return res.json({ contacts });
    } catch (err) {
        logger.error('SEARCH CONTACTS ERROR:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
