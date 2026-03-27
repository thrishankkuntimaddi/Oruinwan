// server/src/features/ai/knowledge/ai-knowledge.routes.js
'use strict';

const express   = require('express');
const router    = express.Router();
const auth      = require('../../../shared/middleware/auth');
const knowledge = require('./ai-knowledge.service');
const logger    = require('../../../../utils/logger');

// POST /api/ai/search
// Body: { query, workspaceId }
router.post('/search', auth, async (req, res) => {
    try {
        const { query, workspaceId } = req.body;
        if (!query)       return res.status(400).json({ message: 'query is required' });
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledge.search(query, workspaceId);
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Knowledge] search error:', err.message);
        return res.status(500).json({ message: 'Search failed', error: err.message });
    }
});

// POST /api/ai/ask
// Body: { question, workspaceId }
router.post('/ask', auth, async (req, res) => {
    try {
        const { question, workspaceId } = req.body;
        if (!question)    return res.status(400).json({ message: 'question is required' });
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledge.askQuestion(question, workspaceId);
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Knowledge] ask error:', err.message);
        return res.status(500).json({ message: 'Q&A failed', error: err.message });
    }
});

// POST /api/ai/meetings/query
// Body: { question, workspaceId }
router.post('/meetings/query', auth, async (req, res) => {
    try {
        const { question, workspaceId } = req.body;
        if (!question)    return res.status(400).json({ message: 'question is required' });
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledge.queryMeetings(question, workspaceId);
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Knowledge] meetings/query error:', err.message);
        return res.status(500).json({ message: 'Meeting query failed', error: err.message });
    }
});

module.exports = router;
