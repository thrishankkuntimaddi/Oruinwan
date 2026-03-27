// server/src/features/ai/assistant/ai-assistant.service.js
'use strict';

const Message       = require('../../messages/message.model');
const aiCore        = require('../ai-core.service');

// ─── Channel Summarization ────────────────────────────────────────────────────

/**
 * Fetch the last N plaintext messages from a channel, concatenate, and summarise.
 * Only non-deleted, non-encrypted messages with text are included.
 *
 * @param {string} channelId
 * @param {string} workspaceId
 * @param {number} [limit=50]
 * @returns {Promise<{ summary: string, messageCount: number, fallback: boolean }>}
 */
async function summarizeChannel(channelId, workspaceId, limit = 50) {
    const messages = await Message.find({
        channel:             channelId,
        workspace:           workspaceId,
        isDeleted:           { $ne: true },
        isDeletedUniversally:{ $ne: true },
        type:                { $in: ['message', 'checklist'] },
        text:                { $exists: true, $ne: '' },
    })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('text sender createdAt')
        .populate('sender', 'username firstName lastName')
        .lean();

    if (!messages.length) {
        return { summary: 'No messages to summarise in this channel.', messageCount: 0, fallback: false };
    }

    // Reverse so they read oldest → newest
    const ordered = [...messages].reverse();
    const text = ordered.map(m => {
        const name = m.sender?.username || m.sender?.firstName || 'User';
        return `${name}: ${m.text}`;
    }).join('\n');

    const { summary, fallback } = await aiCore.summarize(text, {
        title:   `Channel conversation (${messages.length} messages)`,
        type:    'generic',
        noCache: false,
    });

    return { summary, messageCount: messages.length, fallback };
}

// ─── Action Item Extraction ───────────────────────────────────────────────────

/**
 * Extract action items from arbitrary text (message body, meeting transcript, etc.)
 * @param {string} text
 * @returns {Promise<{ items: string[], fallback: boolean }>}
 */
async function extractActionItems(text) {
    return aiCore.extractTasks(text);
}

// ─── Smart Replies ────────────────────────────────────────────────────────────

/**
 * Generate 3 smart reply suggestions given recent messages.
 * @param {Array<{sender: string, text: string}>} messages
 * @returns {Promise<{ suggestions: string[], fallback: boolean }>}
 */
async function generateSmartReplies(messages) {
    return aiCore.generateReplies(messages);
}

module.exports = { summarizeChannel, extractActionItems, generateSmartReplies };
