const logger = require('../../utils/logger');
const { query } = require('../shared/postgres');

const MENTION_REGEX = /@([a-zA-Z0-9_.-]+)/g;
const HERE_REGEX = /@here\b/i;
const CHANNEL_REGEX = /@channel\b/i;

function parseMentionHandles(text) {
    if (!text || typeof text !== 'string') {
        return { userHandles: [], isHere: false, isChannel: false };
    }

    const isHere = HERE_REGEX.test(text);
    const isChannel = CHANNEL_REGEX.test(text);

    const handles = new Set();
    let match;
    const regex = new RegExp(MENTION_REGEX.source, 'g');
    while ((match = regex.exec(text)) !== null) {
        const handle = match[1].toLowerCase();
        
        if (handle !== 'here' && handle !== 'channel') {
            handles.add(handle);
        }
    }

    return { userHandles: Array.from(handles), isHere, isChannel };
}

async function resolveHandlesToIds(handles, companyId, senderId) {
    if (!handles || handles.length === 0) return [];

    try {
        const { rows } = await query(
            `SELECT id FROM users WHERE lower(username) = ANY($1)
               AND company_id IS NOT DISTINCT FROM $2 AND is_active = true`,
            [handles.map(h => String(h).toLowerCase()), companyId ? String(companyId) : null]
        );

        return rows
            .map(u => String(u.id))
            .filter(id => id !== senderId?.toString()); 
    } catch (err) {
        logger.error('[mentionParser] resolveHandlesToIds error:', err.message);
        return [];
    }
}

async function extractMentions(text, companyId, senderId) {
    const { userHandles, isHere, isChannel } = parseMentionHandles(text);
    const mentionedUserIds = await resolveHandlesToIds(userHandles, companyId, senderId);
    return { mentionedUserIds, isHere, isChannel };
}

module.exports = { parseMentionHandles, resolveHandlesToIds, extractMentions };
