'use strict';

const express   = require('express');
const router    = express.Router();
const { aiLimiter, requireAIAccess } = require('../ai.access');
const member = [aiLimiter, requireAIAccess()];
const ctx = (req) => ({ userId: req.user.sub, workspaceId: req.aiWorkspace.id, ...(req.aiContext || {}) });
const knowledge = require('./ai-knowledge.service');
const logger    = require('../../../../utils/logger');

router.post('/search', ...member, async (req, res) => {
    try {
        const { query, workspaceId } = req.body;
        if (!query)       return res.status(400).json({ message: 'query is required' });
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        // Meaning-based search over what this user can see; keyword search if the engine is unreachable.
        try {
            const results = await require('../ai.knowledge.service').search(req.aiWorkspace.id, req.user.sub, String(query).slice(0, 500), { k: 10, minScore: 0.45 });
            return res.json({ results });
        } catch (err) {
            logger.warn('[AI-Knowledge] semantic search unavailable, using keyword search:', err.message);
        }
        const result = await knowledge.search(query, workspaceId, ctx(req));
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Knowledge] search error:', err.message);
        return res.status(500).json({ message: 'Search failed', });
    }
});

router.post('/ask', ...member, async (req, res) => {
    try {
        const { question, workspaceId } = req.body;
        if (!question)    return res.status(400).json({ message: 'question is required' });
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledge.askQuestion(question, workspaceId, ctx(req));
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Knowledge] ask error:', err.message);
        return res.status(500).json({ message: 'Q&A failed', });
    }
});

router.post('/meetings/query', ...member, async (req, res) => {
    try {
        const { question, workspaceId } = req.body;
        if (!question)    return res.status(400).json({ message: 'question is required' });
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await knowledge.queryMeetings(question, workspaceId, ctx(req));
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Knowledge] meetings/query error:', err.message);
        return res.status(500).json({ message: 'Meeting query failed', });
    }
});

module.exports = router;
