/**
 * notifications.routes.js
 *
 * REST API for the per-user notification feed.
 *
 * GET    /api/notifications?workspaceId=&page=&limit=   — paginated feed
 * GET    /api/notifications/unread-count?workspaceId=   — fast unread count
 * PATCH  /api/notifications/read-all?workspaceId=        — mark all read
 * PATCH  /api/notifications/:id/read                     — mark single read  
 * DELETE /api/notifications/:id                          — dismiss single
 * DELETE /api/notifications?workspaceId=                 — clear all
 */

const express = require('express');
const router = express.Router();
const requireAuth = require('../../../middleware/auth');
const Notification = require('../../models/Notification');

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

module.exports = router;
