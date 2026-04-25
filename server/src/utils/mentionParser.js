const User = require('../../models/User');

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
        const users = await User.find({
            username: { $in: handles.map(h => new RegExp(`^${h}$`, 'i')) },
            companyId,
            isActive: { $ne: false },
        }).select('_id').lean();

        return users
            .map(u => u._id.toString())
            .filter(id => id !== senderId?.toString()); 
    } catch (err) {
        console.error('[mentionParser] resolveHandlesToIds error:', err.message);
        return [];
    }
}

async function extractMentions(text, companyId, senderId) {
    const { userHandles, isHere, isChannel } = parseMentionHandles(text);
    const mentionedUserIds = await resolveHandlesToIds(userHandles, companyId, senderId);
    return { mentionedUserIds, isHere, isChannel };
}

module.exports = { parseMentionHandles, resolveHandlesToIds, extractMentions };
