/**
 * notifications.routes.js
 *
 * REST API for the per-user notification feed.
 *
 * GET    /api/notifications?workspaceId=&page=&limit=   — paginated feed
 * GET    /api/notifications/unread-count?workspaceId=   — fast unread count
 * GET    /api/notifications/preferences?workspaceId=    — get user preferences
 * PATCH  /api/notifications/preferences?workspaceId=    — update preferences
 * PATCH  /api/notifications/read-all?workspaceId=        — mark all read
 * PATCH  /api/notifications/:id/read                     — mark single read
 * DELETE /api/notifications/:id                          — dismiss single
 * DELETE /api/notifications?workspaceId=                 — clear all
 * POST   /api/notifications/test                         — (dev) fire test notification
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const Notification = require('../../models/Notification');
const prefService = require('./notificationPreferenceService');

// All routes require auth
router.use(requireAuth);

// GET /api/notifications — paginated feed
router.get('/', async (req, res) => {
    try {
        const { workspaceId, page = 1, limit = 30, type, unreadOnly } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

        const filter = {
            recipient: req.user.sub,
            workspaceId,
        };
        if (type) filter.type = type;
        if (unreadOnly === 'true') filter.read = false;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find(filter)
                .sort({ createdAt: -1 })
                .skip((Number(page) - 1) * Number(limit))
                .limit(Number(limit))
                .lean(),
            Notification.countDocuments(filter),
            Notification.countDocuments({ recipient: req.user.sub, workspaceId, read: false }),
        ]);

        res.json({
            notifications,
            total,
            unreadCount,
            page: Number(page),
            pages: Math.ceil(total / Number(limit)),
        });
    } catch (err) {
        console.error('[GET /notifications]', err);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

        const count = await Notification.countDocuments({
            recipient: req.user.sub,
            workspaceId,
            read: false,
        });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch count' });
    }
});

// PATCH /api/notifications/read-all
router.patch('/read-all', async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

        await Notification.updateMany(
            { recipient: req.user.sub, workspaceId, read: false },
            { $set: { read: true } }
        );
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark all read' });
    }
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', async (req, res) => {
    try {
        const notif = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.sub },
            { $set: { read: true } },
            { new: true }
        );
        if (!notif) return res.status(404).json({ message: 'Notification not found' });
        res.json({ notification: notif });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark read' });
    }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
    try {
        const notif = await Notification.findOneAndDelete({
            _id: req.params.id,
            recipient: req.user.sub,
        });
        if (!notif) return res.status(404).json({ message: 'Notification not found' });
        res.json({ message: 'Notification dismissed' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to dismiss' });
    }
});

// DELETE /api/notifications?workspaceId= — clear all
router.delete('/', async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

        await Notification.deleteMany({ recipient: req.user.sub, workspaceId });
        res.json({ message: 'All notifications cleared' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to clear' });
    }
});

// GET /api/notifications/preferences
router.get('/preferences', async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

        const prefs = await prefService.getUserPreferences(req.user.sub, workspaceId);
        res.json({ preferences: prefs });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch preferences' });
    }
});

// PATCH /api/notifications/preferences
router.patch('/preferences', async (req, res) => {
    try {
        const { workspaceId } = req.query;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

        const prefs = await prefService.updateUserPreferences(req.user.sub, workspaceId, req.body);
        res.json({ preferences: prefs });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update preferences' });
    }
});

// POST /api/notifications/test — dev-only trigger
router.post('/test', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: 'Not available in production' });
    }
    try {
        const { workspaceId, type = 'mention', title = 'Test Notification', body = 'This is a test' } = req.body;
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });

        const notifService = require('./notificationService');
        const notif = await notifService.create(req.app.get('io'), {
            recipient: req.user.sub,
            workspaceId,
            type,
            title,
            body,
            link: null,
            meta: { source: 'test' },
        });
        res.status(201).json({ notification: notif });
    } catch (err) {
        res.status(500).json({ message: 'Failed to send test notification' });
    }
});

module.exports = router;

