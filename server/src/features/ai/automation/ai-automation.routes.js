'use strict';

const express    = require('express');
const router     = express.Router();
const { aiLimiter, requireAIAccess } = require('../ai.access');
const auth = [aiLimiter, requireAIAccess()];
const automation = require('./ai-automation.service');
const logger     = require('../../../../utils/logger');

router.post('/command', auth, async (req, res) => {
    try {
        const { command, workspaceId } = req.body;
        if (!command)     return res.status(400).json({ message: 'command is required' });
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

        const result = await automation.parseCommand(command, req.user.sub, workspaceId, { req, ...(req.aiContext || {}) });
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Automation] /command error:', err.message);
        return res.status(500).json({ message: 'Command execution failed', });
    }
});

router.post('/generate-tasks', auth, async (req, res) => {
    try {
        const { text, workspaceId } = req.body;
        if (!text)        return res.status(400).json({ message: 'text is required' });
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

        const result = await automation.generateTasksFromText(text, workspaceId, req.user.sub, req.aiContext || {});
        return res.json(result);
    } catch (err) {
        logger.error('[AI-Automation] /generate-tasks error:', err.message);
        return res.status(500).json({ message: 'Task generation failed', });
    }
});

module.exports = router;
