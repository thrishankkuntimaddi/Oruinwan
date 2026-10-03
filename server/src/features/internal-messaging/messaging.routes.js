const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const internalMessagingController = require('./messaging.controller');
const identity = require('../../identity');

// The access token carries no companyId (and its role can be stale), so load
// company, role and email from the database. req.user.sub is kept.
async function hydrateUser(req, res, next) {
    try {
        const u = await identity.users.findById(req.user.sub);
        if (!u) return res.status(401).json({ message: 'User not found' });
        const coOwner = u.coOwnerOf && u.companyId && String(u.coOwnerOf) === String(u.companyId);
        req.user.companyId = u.companyId ? String(u.companyId) : null;
        req.user.companyRole = coOwner ? 'owner' : (u.companyRole || 'member');
        req.user.email = u.email;
        next();
    } catch (err) {
        next(err);
    }
}

router.use(requireAuth, hydrateUser);

router.post('/messages', internalMessagingController.sendMessage);

router.get('/messages/conversation/:userId', internalMessagingController.getConversation);

router.get('/messages/inbox', internalMessagingController.getAdminInbox);

router.get('/messages/manager-inbox', internalMessagingController.getManagerInbox);

router.patch('/messages/:messageId/read', internalMessagingController.markAsRead);

router.get('/messages/unread-count', internalMessagingController.getUnreadCount);

module.exports = router;
