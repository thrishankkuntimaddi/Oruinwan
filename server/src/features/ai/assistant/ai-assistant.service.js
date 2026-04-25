'use strict';

const Message       = require('../../messages/message.model');
const aiCore        = require('../ai-core.service');

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

async function extractActionItems(text) {
    return aiCore.extractTasks(text);
}

async function generateSmartReplies(messages) {
    return aiCore.generateReplies(messages);
}

module.exports = { summarizeChannel, extractActionItems, generateSmartReplies };
