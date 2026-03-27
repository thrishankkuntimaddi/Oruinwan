// server/src/features/ai/insights/ai-insights.routes.js
'use strict';

const express  = require('express');
const router   = express.Router();
const auth     = require('../../../shared/middleware/auth');
const insights = require('./ai-insights.service');
const logger   = require('../../../../utils/logger');

// GET /api/ai/insights/productivity?workspaceId=&days=
router.get('/insights/productivity', auth, async (req, res) => {
    try {
        const { workspaceId, days = 7 } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await insights.getProductivityInsights(workspaceId, Number(days));
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Insights] productivity error:', err.message);
        return res.status(500).json({ message: 'Could not load productivity insights', error: err.message });
    }
});

// GET /api/ai/insights/collaboration?workspaceId=&days=
router.get('/insights/collaboration', auth, async (req, res) => {
    try {
        const { workspaceId, days = 7 } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await insights.getCollaborationInsights(workspaceId, Number(days));
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Insights] collaboration error:', err.message);
        return res.status(500).json({ message: 'Could not load collaboration insights', error: err.message });
    }
});

// GET /api/ai/insights/engagement?workspaceId=&days=
router.get('/insights/engagement', auth, async (req, res) => {
    try {
        const { workspaceId, days = 7 } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await insights.getEngagementInsights(workspaceId, Number(days));
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Insights] engagement error:', err.message);
        return res.status(500).json({ message: 'Could not load engagement insights', error: err.message });
    }
});

// GET /api/ai/insights/anomalies?workspaceId=
router.get('/insights/anomalies', auth, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await insights.detectAnomalies(workspaceId);
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Insights] anomalies error:', err.message);
        return res.status(500).json({ message: 'Could not detect anomalies', error: err.message });
    }
});

module.exports = router;
