import api from './api';
import { searchLocalMessages } from '../utils/localMessageIndex';

const RECENT_SEARCHES_KEY = 'chttrix_recent_searches';
const MAX_RECENT = 8;

const EMPTY = () => ({ messages: [], files: [], users: [], channels: [], tasks: [], notes: [], knowledge: [], total: 0, query: '' });

/** Plain-text preview: drops markdown markers, links and code fences. */
export function stripMarkdown(text = '') {
    return String(text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]*)`/g, '$1')
        .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
        .replace(/(\*\*|__|~~|\*|_)(\S(?:.*?\S)?)\1/g, '$2')
        .replace(/<@[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Local (decrypted in this session) matches, shaped like server message results. */
function toServerShape(m) {
    const isChannel = !!m.channelId;
    return {
        ...m,
        id: m.id || m._id,
        type: 'message',
        preview: stripMarkdown(m.text).slice(0, 120),
        sender: m.sender ? { id: m.sender._id || m.sender.id, name: m.sender.username || m.sender.name } : null,
        parent: {
            id: isChannel ? m.channelId : m.dmId,
            type: isChannel ? 'channel' : 'dm',
            name: isChannel ? m.channelName : m.dmName,
        },
    };
}

/**
 * GET /api/search. `filters.type` uses the server's singular names
 * ('message', 'file', 'user', …). Pass `signal` to cancel superseded requests.
 */
export async function searchAll(query, filters = {}, workspaceId, { signal } = {}) {
    if (!query || !query.trim() || !workspaceId) return EMPTY();

    const params = new URLSearchParams({ q: query.trim(), workspaceId });
    if (filters.type)      params.append('type',      filters.type);
    if (filters.from)      params.append('from',      filters.from);
    if (filters.to)        params.append('to',        filters.to);
    if (filters.channelId) params.append('channelId', filters.channelId);
    if (filters.tags && filters.tags.length > 0) params.append('tags', filters.tags.join(','));
    if (filters.limit  != null) params.append('limit',    String(filters.limit));
    if (filters.offset != null) params.append('offset',   String(filters.offset));
    if (filters.semantic != null) params.append('semantic', String(filters.semantic));

    const { data: raw } = await api.get(`/api/search?${params.toString()}`, { signal });
    const data = { ...EMPTY(), ...(raw || {}) };
    data.messages = (data.messages || []).map(m => ({ ...m, preview: stripMarkdown(m.preview || m.text).slice(0, 120) }));

    // Encrypted message text is only readable here: add matches from conversations
    // decrypted in this session to whatever the server found (first page only).
    const wantsMessages = !filters.type || filters.type === 'all' || filters.type === 'message';
    if (wantsMessages && !filters.offset) {
        const local = searchLocalMessages(query, workspaceId, filters.limit || 20).map(toServerShape);
        if (local.length) {
            const key = m => String(m.id || m._id);
            const seen = new Set(data.messages.map(key));
            const extra = local.filter(m => !seen.has(key(m)));
            data.messages = [...extra, ...data.messages];
            data.total = (data.total || 0) + extra.length;
        }
    }
    return data;
}

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
