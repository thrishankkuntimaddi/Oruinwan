// server/src/utils/mentionParser.js
//
// Parses mentions from plaintext message content.
// Called server-side on the mentionText field (NOT the ciphertext).
// Returns structured mention data for notification triggering.

const User = require('../../models/User');

const MENTION_REGEX = /@([a-zA-Z0-9_.-]+)/g;
const HERE_REGEX = /@here\b/i;
const CHANNEL_REGEX = /@channel\b/i;

/**
 * Parse raw text and return mention handles + broadcast flags.
 * Pure function — no DB access.
 *
 * @param {string} text  Plaintext message content
 * @returns {{ userHandles: string[], isHere: boolean, isChannel: boolean }}
 */
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
        // Skip broadcast keywords — they are not user handles
        if (handle !== 'here' && handle !== 'channel') {
            handles.add(handle);
        }
    }

    return { userHandles: Array.from(handles), isHere, isChannel };
}

/**
 * Resolve mention handles → User ObjectIds within a given company.
 * Looks up users by their `username` field (case-insensitive).
 *
 * @param {string[]} handles   Array of usernames extracted by parseMentionHandles
 * @param {string}   companyId  Company scope to limit the user lookup
 * @param {string}   senderId   Exclude the sender from their own mentions
 * @returns {Promise<string[]>}  Array of User ObjectId strings
 */
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
            .filter(id => id !== senderId?.toString()); // Don't notify yourself
    } catch (err) {
        console.error('[mentionParser] resolveHandlesToIds error:', err.message);
        return [];
    }
}

/**
 * Full pipeline: text → user ObjectIds.
 * Combines parseMentionHandles + resolveHandlesToIds in one call.
 *
 * @param {string} text
 * @param {string} companyId
 * @param {string} senderId
 * @returns {Promise<{ mentionedUserIds: string[], isHere: boolean, isChannel: boolean }>}
 */
async function extractMentions(text, companyId, senderId) {
    const { userHandles, isHere, isChannel } = parseMentionHandles(text);
    const mentionedUserIds = await resolveHandlesToIds(userHandles, companyId, senderId);
    return { mentionedUserIds, isHere, isChannel };
}

module.exports = { parseMentionHandles, resolveHandlesToIds, extractMentions };
