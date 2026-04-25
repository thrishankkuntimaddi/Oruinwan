const express = require('express');
const router = express.Router();
const requireAuth = require('../../shared/middleware/auth');
const platformSupportController = require('./platform-support.controller');

router.get('/tickets/:ticketId/messages', requireAuth, platformSupportController.getTicketMessages);

router.post('/tickets/:ticketId/messages', requireAuth, platformSupportController.sendTicketMessage);

router.patch('/messages/:messageId/read', requireAuth, platformSupportController.markMessageAsRead);

router.get('/messages/me', requireAuth, async (req, res) => {
    try {
        const userId = req.user.sub || req.user._id;
        if (!userId) return res.status(401).json({ message: 'Authentication required' });

        
        const ticket = await require('../../../models/SupportTicket').findOne({
            creatorId: userId,
            subject: 'Live Chat Support'
        }).sort({ createdAt: -1 }).lean();

        if (!ticket) {
            return res.json({ messages: [] });
        }

        const messages = await require('../../../models/SupportMessage').find({
            ticket: ticket._id,
            deletedAt: null
        })
            .populate('sender', 'username email profilePicture')
            .sort({ createdAt: 1 })
            .lean();

        return res.json({ messages });
    } catch (error) {
        console.error('GET MY MESSAGES ERROR:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.get('/messages/:companyId', requireAuth, platformSupportController.getMessages);

router.post('/messages', requireAuth, platformSupportController.sendMessage);

router.get('/tickets/:companyId', requireAuth, platformSupportController.getTickets);

router.post('/tickets', requireAuth, platformSupportController.createTicket);

router.put('/tickets/:ticketId', requireAuth, platformSupportController.updateTicket);

module.exports = router;
