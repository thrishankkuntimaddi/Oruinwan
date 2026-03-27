/**
 * automation.routes.js
 *
 * REST API for Workflow Automations.
 *
 * All routes require authentication (applied at mount level in server.js).
 * Write operations (POST/PATCH/DELETE) are restricted to workspace admins.
 *
 * Endpoints:
 *   GET    /api/v2/automations/templates   — list predefined templates
 *   POST   /api/v2/automations             — create automation
 *   GET    /api/v2/automations             — list automations (?workspaceId=)
 *   GET    /api/v2/automations/:id         — get single automation
 *   PATCH  /api/v2/automations/:id         — update / toggle isActive
 *   DELETE /api/v2/automations/:id         — soft-delete
 */

const express  = require('express');
const router   = express.Router();
const logger   = require('../../../utils/logger');
const service  = require('./automation.service');
const templates = require('./automation.templates');

const Workspace = require('../../../models/Workspace');

// ─── Helper: verify requester is workspace admin/owner ───────────────────────

async function _requireWorkspaceAdmin(userId, workspaceId, res) {
    const ws = await Workspace.findById(workspaceId).select('members').lean();
    if (!ws) {
        res.status(404).json({ message: 'Workspace not found' });
        return false;
    }
    const member = ws.members.find(m => {
        const id = m.user?._id?.toString() || m.user?.toString() || m.toString();
        return id === userId.toString();
    });
    if (!member || !['admin', 'owner'].includes(member.role)) {
        res.status(403).json({ message: 'Only workspace admins can manage automations' });
        return false;
    }
    return true;
}

// ─── GET /templates ───────────────────────────────────────────────────────────

router.get('/templates', (req, res) => {
    res.json({ templates });
});

// ─── POST / — create ─────────────────────────────────────────────────────────

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

// ─── GET / — list ─────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
    try {
        const { workspaceId, page = 1, limit = 20 } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

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

// ─── GET /:id — single ────────────────────────────────────────────────────────

router.get('/:id', async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

        const automation = await service.getAutomation(req.params.id, workspaceId);
        res.json({ automation });
    } catch (err) {
        logger.error('[AutomationRoutes] GET /:id error:', err.message);
        res.status(err.statusCode || 500).json({ message: err.message });
    }
});

// ─── PATCH /:id — update / toggle ────────────────────────────────────────────

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

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

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
