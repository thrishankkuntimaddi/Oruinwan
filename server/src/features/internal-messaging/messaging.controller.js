// server/controllers/internalMessagingController.js
// Handles internal messaging between Managers and Company Admins

const InternalMessage = require('../../../models/InternalMessage');
const User = require('../../../models/User');
const _Department = require('../../../models/_Department');

/**
 * Send a message (manager to admin or admin to manager)
 * POST /api/internal/messages
 */
exports.sendMessage = async (req, res) => {
    try {
        const { recipientId, content, departmentId } = req.body;

        // Validate user authentication
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const senderId = req.user.sub;

        // Validate required fields
        if (!recipientId || !content || !content.trim()) {
            return res.status(400).json({ message: 'Recipient and content are required' });
        }

        // Get recipient to determine message type
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        // Verify both users are in same company
        const senderCompanyId = typeof req.user.companyId === 'object'
            ? req.user.companyId._id
            : req.user.companyId;
        const recipientCompanyId = typeof recipient.companyId === 'object'
            ? recipient.companyId._id
            : recipient.companyId;

        if (!senderCompanyId || !recipientCompanyId || senderCompanyId.toString() !== recipientCompanyId.toString()) {
            return res.status(403).json({ message: 'Cannot message users from other companies' });
        }

        // Determine message type
        const senderIsAdmin = ['owner', 'admin'].includes(req.user.companyRole);
        const recipientIsAdmin = ['owner', 'admin'].includes(recipient.companyRole);

        let messageType;
        let isFromAdmin;

        if (senderIsAdmin && !recipientIsAdmin) {
            messageType = 'admin-to-manager';
            isFromAdmin = true;
        } else if (!senderIsAdmin && recipientIsAdmin) {
            messageType = 'manager-to-admin';
            isFromAdmin = false;
        } else {
            return res.status(400).json({ message: 'Invalid message direction. Use this endpoint for manager-admin communication only.' });
        }

        console.log('[INTERNAL MESSAGE] Sending:', {
            from: req.user.email,
            to: recipient.email,
            type: messageType
        });

        // Create message
        const message = await InternalMessage.create({
            companyId: senderCompanyId,
            sender: senderId,
            recipient: recipientId,
            content: content.trim(),
            messageType,
            isFromAdmin,
            departmentId: departmentId || null
        });

        await message.populate([
            { path: 'sender', select: 'username email profilePicture companyRole' },
            { path: 'recipient', select: 'username email profilePicture companyRole' }
        ]);

        // Emit socket event
        if (req.app.get('io')) {
            const io = req.app.get('io');
            // Send to recipient's room
            io.to(`user-${recipientId}`).emit('internal-message', message);
        }

        console.log('[INTERNAL MESSAGE] Created successfully:', message._id);

        return res.status(201).json({ message });
    } catch (_error) {
        console.error('SEND INTERNAL MESSAGE ERROR:', error);
        return res.status(500).json({
            message: 'Failed to send message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get conversation between current user and another user
 * GET /api/internal/messages/conversation/:userId
 */
exports.getConversation = async (req, res) => {
    try {
        const { userId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;

        const messages = await InternalMessage.getConversation(
            currentUserId,
            userId,
            limit
        );

        // Mark unread messages as read
        const unreadMessages = messages.filter(
            msg => msg.recipient.toString() === currentUserId.toString() && !msg.read
        );

        if (unreadMessages.length > 0) {
            await Promise.all(unreadMessages.map(msg => msg.markAsRead()));
        }

        return res.json({ messages });
    } catch (_error) {
        console.error('GET CONVERSATION ERROR:', error);
        return res.status(500).json({ message: 'Failed to load conversation' });
    }
};

/**
 * Get admin inbox (all conversations with managers)
 * GET /api/internal/messages/inbox
 */
exports.getAdminInbox = async (req, res) => {
    try {
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        // Verify user is admin
        if (!['owner', 'admin'].includes(req.user.companyRole)) {
            return res.status(403).json({ message: 'Admin access required' });
        }

        const currentUserId = req.user.sub;
        const companyId = typeof req.user.companyId === 'object'
            ? req.user.companyId._id
            : req.user.companyId;

        const conversations = await InternalMessage.getAdminInbox(
            currentUserId,
            companyId
        );

        return res.json({ conversations });
    } catch (_error) {
        console.error('GET ADMIN INBOX ERROR:', error);
        return res.status(500).json({ message: 'Failed to load inbox' });
    }
};

/**
 * Get manager's inbox (conversations with admins)
 * GET /api/internal/messages/manager-inbox
 */
exports.getManagerInbox = async (req, res) => {
    try {
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;

        // Get latest messages from admins
        const messages = await InternalMessage.find({
            recipient: currentUserId,
            isFromAdmin: true
        })
            .populate('sender', 'username email profilePicture companyRole')
            .sort({ createdAt: -1 })
            .limit(20);

        const unreadCount = await InternalMessage.getUnreadCount(currentUserId);

        return res.json({ messages, unreadCount });
    } catch (_error) {
        console.error('GET MANAGER INBOX ERROR:', error);
        return res.status(500).json({ message: 'Failed to load inbox' });
    }
};

/**
 * Mark message as read
 * PATCH /api/internal/messages/:messageId/read
 */
exports.markAsRead = async (req, res) => {
    try {
        const { messageId } = req.params;

        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;

        const message = await InternalMessage.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: 'Message not found' });
        }

        // Verify user is the recipient
        if (message.recipient.toString() !== currentUserId.toString()) {
            return res.status(403).json({ message: 'Cannot mark other users\' messages as read' });
        }

        await message.markAsRead();

        return res.json({ message });
    } catch (_error) {
        console.error('MARK AS READ ERROR:', error);
        return res.status(500).json({ message: 'Failed to mark as read' });
    }
};

/**
 * Get unread count for current user
 * GET /api/internal/messages/unread-count
 */
exports.getUnreadCount = async (req, res) => {
    try {
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;
        const count = await InternalMessage.getUnreadCount(currentUserId);

        return res.json({ count });
    } catch (_error) {
        console.error('GET UNREAD COUNT ERROR:', error);
        return res.status(500).json({ message: 'Failed to get unread count' });
    }
};

module.exports = exports;
