'use strict';

/**
 * Legacy assistant endpoints, kept for the SDK and older clients. They now run
 * through the AI gateway and require workspace membership. Messages are E2EE,
 * so summaries work on transcripts the client decrypts and sends.
 */
const express = require('express');
const router = express.Router();
const { aiLimiter, requireAIAccess } = require('../ai.access');
const gateway = require('../ai.gatewayResolver');
const logger = require('../../../../utils/logger');

router.use(aiLimiter);

const ctx = (req) => ({ userId: req.user.sub, workspaceId: req.aiWorkspace?.id || null, ...(req.aiContext || {}) });
const clean = (list) => (Array.isArray(list) ? list : []).slice(-200)
    .filter(m => m && typeof (m.text ?? m.content) === 'string')
    .map(m => ({ sender: String(m.sender || m.senderName || 'User').slice(0, 80), text: String(m.text ?? m.content).slice(0, 4000), isMe: !!m.isMe }));

router.post('/channel-summary', requireAIAccess(), async (req, res) => {
    try {
        const messages = clean(req.body.messages);
        if (!messages.length) {
            return res.json({ summary: 'No messages to summarise. Open the channel so the client can decrypt and send the recent messages.', messageCount: 0, fallback: true });
        }
        const { text } = await gateway.conversation({ messages, mode: req.body.mode === 'bullets' ? 'bullets' : 'summary', title: req.body.channelName }, ctx(req));
        return res.json({ summary: text, messageCount: messages.length, fallback: false });
    } catch (err) {
        logger.error('[AI-Assistant] channel-summary error:', err.message);
        return res.status(502).json({ message: 'Channel summarisation failed' });
    }
});

router.post('/action-items', requireAIAccess({ optional: true }), async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ message: 'text is required' });
        const { tasks } = await gateway.extractTasks({ text: String(text).slice(0, 20_000) }, ctx(req));
        return res.json({ items: tasks.map(t => t.title), tasks, fallback: false });
    } catch (err) {
        logger.error('[AI-Assistant] action-items error:', err.message);
        return res.status(502).json({ message: 'Action item extraction failed' });
    }
});

router.post('/smart-reply', requireAIAccess({ optional: true }), smartReplies);

async function smartReplies(req, res) {
    try {
        const messages = clean(req.body.messages);
        if (!messages.length) return res.json({ suggestions: [] });
        const { suggestions } = await gateway.smartReplies({ messages }, ctx(req));
        return res.json({ suggestions });
    } catch (err) {
        logger.warn('[AI-Assistant] smart-reply error:', err.message);
        return res.json({ suggestions: [], fallback: true });
    }
}

module.exports = router;
