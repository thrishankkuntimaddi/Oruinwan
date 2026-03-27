// client/src/services/searchService.js
/**
 * Unified Search Service — Frontend
 * Wraps the /api/search v2 endpoint and manages recent searches in localStorage.
 */

import api from './api';

const RECENT_SEARCHES_KEY = 'chttrix_recent_searches';
const MAX_RECENT = 8;

// ─── API call ─────────────────────────────────────────────────────────────────

/**
 * Full search with all filters.
 * @param {string} query
 * @param {object} filters  - { type, from, to, channelId, tags, limit, offset, semantic }
 * @param {string} workspaceId
 * @returns {Promise<object>} - { messages, files, users, channels, tasks, notes, knowledge, total, query }
 */
export async function searchAll(query, filters = {}, workspaceId) {
    if (!query || !query.trim() || !workspaceId) {
        return { messages: [], files: [], users: [], channels: [], tasks: [], notes: [], knowledge: [], total: 0, query: '' };
    }

    const params = new URLSearchParams({ q: query.trim(), workspaceId });
    if (filters.type)      params.append('type',      filters.type);
    if (filters.from)      params.append('from',      filters.from);
    if (filters.to)        params.append('to',        filters.to);
    if (filters.channelId) params.append('channelId', filters.channelId);
    if (filters.tags && filters.tags.length > 0) params.append('tags', filters.tags.join(','));
    if (filters.limit  != null) params.append('limit',    String(filters.limit));
    if (filters.offset != null) params.append('offset',   String(filters.offset));
    if (filters.semantic != null) params.append('semantic', String(filters.semantic));

    const { data } = await api.get(`/api/search?${params.toString()}`);
    return data;
}

// ─── Recent Searches ──────────────────────────────────────────────────────────

export function getRecentSearches() {
    try {
        return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
    } catch {
        return [];
    }
}

export function saveRecentSearch(query) {
    if (!query || !query.trim()) return;
    const term    = query.trim();
    const recents = getRecentSearches().filter(q => q !== term);
    recents.unshift(term);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recents.slice(0, MAX_RECENT)));
}

export function clearRecentSearches() {
    localStorage.removeItem(RECENT_SEARCHES_KEY);
}
