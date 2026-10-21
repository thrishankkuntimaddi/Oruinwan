const express  = require('express');
const router   = express.Router();
const logger   = require('../../../utils/logger');
const service  = require('./automation.service');
const templates = require('./automation.templates');

const mongoose = require('mongoose');
const { workspaces } = require('../../identity');

async function _requireWorkspaceAdmin(userId, workspaceId, res) {
    const ws = await workspaces.findById(workspaceId);
    if (!ws) {
        res.status(404).json({ message: 'Workspace not found' });
        return false;
    }
    const member = ws.members.find(m => m.user === String(userId) && m.status === 'active');
    if (!member || !['admin', 'owner'].includes(member.role)) {
        res.status(403).json({ message: 'Only workspace admins can manage automations' });
        return false;
    }
    return true;
}

async function _requireWorkspaceMember(userId, workspaceId, res) {
    if (!mongoose.Types.ObjectId.isValid(String(workspaceId))) {
        res.status(400).json({ message: 'Invalid workspaceId' });
        return false;
    }
    const ws = await workspaces.findById(workspaceId);
    if (!ws) {
        res.status(404).json({ message: 'Workspace not found' });
        return false;
    }
    const isMember = ws.isMember(userId);
    if (!isMember) {
        res.status(403).json({ message: 'Not a member of this workspace' });
        return false;
    }
    return true;
}

router.get('/templates', (req, res) => {
    res.json({ templates });
});

// Next run times for a schedule, so the editor can show "Next: Mon 09:00".
router.get('/schedule/preview', (req, res) => {
    try {
        const { expression, type, timezone } = req.query;
        const count = Math.min(Math.max(parseInt(req.query.count, 10) || 5, 1), 20);
        const runs = service.previewSchedule({ expression, type, timezone }, count);
        const { normalizeSchedule } = require('./automation.schedule');
        res.json({ schedule: normalizeSchedule({ expression, type, timezone }), nextRuns: runs });
    } catch (err) {
        res.status(err.statusCode || 400).json({ message: err.message });
    }
});

// "Run now" (executes the steps) or "Test" (dryRun: conditions + interpolated step configs, nothing executed).
router.post('/:id/run', async (req, res) => {
    try {
        const { workspaceId, eventData, dryRun } = req.body || {};
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        if (!(await _requireWorkspaceAdmin(req.user.sub, workspaceId, res))) return;
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return res.status(404).json({ message: 'Automation not found' });

        const run = await service.runNow(req.params.id, workspaceId, req.user.sub, { eventData, dryRun: Boolean(dryRun) }, req.app?.get?.('io'));
        res.status(dryRun ? 200 : 201).json({ run });
    } catch (err) {
        logger.error('[AutomationRoutes] POST /:id/run error:', err.message);
        res.status(err.statusCode || 500).json({ message: err.message });
    }
});

router.get('/:id/runs', async (req, res) => {
    try {
        const { workspaceId, limit, before } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });
        if (!(await _requireWorkspaceMember(req.user.sub, workspaceId, res))) return;
        if (!mongoose.Types.ObjectId.isValid(String(req.params.id))) return res.status(404).json({ message: 'Automation not found' });
        const runs = await service.getRuns(req.params.id, workspaceId, { limit, before });
        res.json({ runs });
    } catch (err) {
        logger.error('[AutomationRoutes] GET /:id/runs error:', err.message);
        res.status(err.statusCode || 500).json({ message: err.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const { workspaceId, name, trigger, actions } = req.body;

        if (!workspaceId || !name || !trigger || !actions?.length) {
            return res.status(400).json({
                message: 'workspaceId, name, trigger, and at least one action are required'
            });
        }

        const isAdmin = await _requireWorkspaceAdmin(req.user.sub, workspaceId, res);
        if (!isAdmin) return;

        const automation = await service.createAutomation(req.user.sub, req.body);
        res.status(201).json({ automation });
    } catch (err) {
        logger.error('[AutomationRoutes] POST / error:', err.message);
        res.status(err.statusCode || 500).json({ message: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const { workspaceId, page = 1, limit = 20 } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

        if (!(await _requireWorkspaceMember(req.user.sub, workspaceId, res))) return;

        const result = await service.getAutomations(workspaceId, {
            page:  parseInt(page, 10),
            limit: parseInt(limit, 10)
        });
        res.json(result);
    } catch (err) {
        logger.error('[AutomationRoutes] GET / error:', err.message);
        res.status(err.statusCode || 500).json({ message: err.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

        if (!(await _requireWorkspaceMember(req.user.sub, workspaceId, res))) return;

        const automation = await service.getAutomation(req.params.id, workspaceId);
        res.json({ automation });
    } catch (err) {
        logger.error('[AutomationRoutes] GET /:id error:', err.message);
        res.status(err.statusCode || 500).json({ message: err.message });
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const { workspaceId } = req.body;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

        const isAdmin = await _requireWorkspaceAdmin(req.user.sub, workspaceId, res);
        if (!isAdmin) return;

        const automation = await service.updateAutomation(req.params.id, workspaceId, req.body);
        res.json({ automation });
    } catch (err) {
        logger.error('[AutomationRoutes] PATCH /:id error:', err.message);
        res.status(err.statusCode || 500).json({ message: err.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

        const isAdmin = await _requireWorkspaceAdmin(req.user.sub, workspaceId, res);
        if (!isAdmin) return;

        await service.deleteAutomation(req.params.id, workspaceId);
        res.json({ message: 'Automation deleted' });
    } catch (err) {
        logger.error('[AutomationRoutes] DELETE /:id error:', err.message);
        res.status(err.statusCode || 500).json({ message: err.message });
    }
});

module.exports = router;
