'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../../../shared/middleware/auth');
const assistant = require('./ai-assistant.service');
const logger   = require('../../../../utils/logger');

router.post('/channel-summary', auth, async (req, res) => {
    try {
        const { channelId, workspaceId, limit } = req.body;
        if (!channelId || !workspaceId) {
            return res.status(400).json({ message: 'channelId and workspaceId are required' });
        }
        const result = await assistant.summarizeChannel(channelId, workspaceId, limit);
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Assistant] channel-summary error:', err.message);
        return res.status(500).json({ message: 'Channel summarisation failed', error: err.message });
    }
});

router.post('/action-items', auth, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) return res.status(400).json({ message: 'text is required' });
        const result = await assistant.extractActionItems(text);
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Assistant] action-items error:', err.message);
        return res.status(500).json({ message: 'Action item extraction failed', error: err.message });
    }
});

router.post('/smart-replies', auth, async (req, res) => {
    try {
        const { messages = [] } = req.body;
        const result = await assistant.generateSmartReplies(messages);
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Assistant] smart-replies error:', err.message);
        
        return res.json({ suggestions: ['Got it!', 'Thanks!', 'On it!'], fallback: true });
    }
});

module.exports = router;
