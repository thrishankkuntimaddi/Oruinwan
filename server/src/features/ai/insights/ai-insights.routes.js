'use strict';

const express  = require('express');
const router   = express.Router();
const { requireAIAccess } = require('../ai.access');
const auth = requireAIAccess();
const insights = require('./ai-insights.service');
const logger   = require('../../../../utils/logger');

router.get('/insights/productivity', auth, async (req, res) => {
    try {
        const { workspaceId, days = 7 } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await insights.getProductivityInsights(workspaceId, Number(days));
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Insights] productivity error:', err.message);
        return res.status(500).json({ message: 'Could not load productivity insights', });
    }
});

// Collaboration and engagement insights were removed on purpose: they counted and ranked
// people's messages. Conversations are private, so there's nothing to report there.
router.get(['/insights/collaboration', '/insights/engagement'], auth, (req, res) => res.status(410).json({ message: 'Message activity insights are not available: conversations are private.' }));

router.get('/insights/anomalies', auth, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        const result = await insights.detectAnomalies(workspaceId);
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Insights] anomalies error:', err.message);
        return res.status(500).json({ message: 'Could not detect anomalies', });
    }
});

module.exports = router;
