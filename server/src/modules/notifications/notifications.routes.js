const logger = require('../../../utils/logger');
const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const Notification = require('./notification.model');
const prefService = require('./notificationPreferenceService');
const { isValidId, assertWorkspaceMember, sendAccessError } = require('../../shared/utils/workspaceAccess');
const { emitToUser } = require('./notificationService');

router.use(requireAuth);

/** 400 unless ?workspaceId= is present and a well-formed ObjectId. */
function requireWorkspaceIdParam(req, res, next) {
    const { workspaceId } = req.query;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });
    if (!isValidId(workspaceId)) return res.status(400).json({ message: 'Invalid workspaceId' });
    return next();
}

/** Caller must be an active member of ?workspaceId= (or body.workspaceId). */
async function requireMembership(req, res, next) {
    try {
        const workspaceId = req.query.workspaceId || req.body?.workspaceId;
        await assertWorkspaceMember(workspaceId, req.user.sub);
        return next();
    } catch (err) {
        return sendAccessError(res, err, next);
    }
}

function requireValidNotificationId(req, res, next) {
    if (!isValidId(req.params.id)) return res.status(400).json({ message: 'Invalid notification id' });
    return next();
}

function sync(req, event, payload) {
    try {
        emitToUser(req.app.get('io'), req.user.sub, event, payload);
    } catch (err) {
        logger.warn({ err: err.message }, `[notifications] ${event} emit failed`);
    }
}

router.get('/', requireWorkspaceIdParam, async (req, res) => {
    try {
        const { workspaceId, type, unreadOnly } = req.query;
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));

        const filter = {
            recipient: req.user.sub,
            workspaceId,
        };
        if (typeof type === 'string' && type) filter.type = type;
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
        logger.error('[GET /notifications]', err);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
});

router.get('/unread-count', requireWorkspaceIdParam, async (req, res) => {
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

router.patch('/read-all', requireWorkspaceIdParam, async (req, res) => {
    try {
        const { workspaceId } = req.query;

        await Notification.updateMany(
            { recipient: req.user.sub, workspaceId, read: false },
            { $set: { read: true } }
        );
        sync(req, 'notification:read-all', { workspaceId: String(workspaceId) });
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark all read' });
    }
});

router.patch('/:id/read', requireValidNotificationId, async (req, res) => {
    try {
        const notif = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user.sub },
            { $set: { read: true } },
            { new: true }
        );
        if (!notif) return res.status(404).json({ message: 'Notification not found' });
        sync(req, 'notification:read', { ids: [String(notif._id)], workspaceId: String(notif.workspaceId) });
        res.json({ notification: notif });
    } catch (err) {
        res.status(500).json({ message: 'Failed to mark read' });
    }
});

router.delete('/:id', requireValidNotificationId, async (req, res) => {
    try {
        const notif = await Notification.findOneAndDelete({
            _id: req.params.id,
            recipient: req.user.sub,
        });
        if (!notif) return res.status(404).json({ message: 'Notification not found' });
        sync(req, 'notification:deleted', { ids: [String(notif._id)], workspaceId: String(notif.workspaceId) });
        res.json({ message: 'Notification dismissed' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to dismiss' });
    }
});

router.delete('/', requireWorkspaceIdParam, async (req, res) => {
    try {
        const { workspaceId } = req.query;

        await Notification.deleteMany({ recipient: req.user.sub, workspaceId });
        sync(req, 'notification:cleared', { workspaceId: String(workspaceId) });
        res.json({ message: 'All notifications cleared' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to clear' });
    }
});

router.get('/preferences', requireWorkspaceIdParam, requireMembership, async (req, res) => {
    try {
        const { workspaceId } = req.query;

        const prefs = await prefService.getUserPreferences(req.user.sub, workspaceId);
        res.json({ preferences: prefs });
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch preferences' });
    }
});

router.patch('/preferences', requireWorkspaceIdParam, requireMembership, async (req, res) => {
    try {
        const { workspaceId } = req.query;

        const prefs = await prefService.updateUserPreferences(req.user.sub, workspaceId, req.body || {});
        res.json({ preferences: prefs });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update preferences' });
    }
});

router.post('/test', async (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ message: 'Not available in production' });
    }
    try {
        const { workspaceId, type = 'mention', title = 'Test Notification', body = 'This is a test' } = req.body || {};
        if (!workspaceId) return res.status(400).json({ message: 'workspaceId required' });
        await assertWorkspaceMember(workspaceId, req.user.sub);

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
        if (err && err.status && err.status < 500) return sendAccessError(res, err);
        res.status(500).json({ message: 'Failed to send test notification' });
    }
});

module.exports = router;
module.exports.requireWorkspaceIdParam = requireWorkspaceIdParam;
