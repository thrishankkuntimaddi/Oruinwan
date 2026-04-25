const InternalMessage = require('../../../models/InternalMessage');
const User = require('../../../models/User');
const _Department = require('../../../models/Department');

exports.sendMessage = async (req, res) => {
    try {
        const { recipientId, content, departmentId } = req.body;

        
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const senderId = req.user.sub;

        
        if (!recipientId || !content || !content.trim()) {
            return res.status(400).json({ message: 'Recipient and content are required' });
        }

        
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({ message: 'Recipient not found' });
        }

        
        const senderCompanyId = typeof req.user.companyId === 'object'
            ? req.user.companyId._id
            : req.user.companyId;
        const recipientCompanyId = typeof recipient.companyId === 'object'
            ? recipient.companyId._id
            : recipient.companyId;

        if (!senderCompanyId || !recipientCompanyId || senderCompanyId.toString() !== recipientCompanyId.toString()) {
            return res.status(403).json({ message: 'Cannot message users from other companies' });
        }

        
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

        
        if (req.app.get('io')) {
            const io = req.app.get('io');
            
            io.to(`user-${recipientId}`).emit('internal-message', message);
        }

        console.log('[INTERNAL MESSAGE] Created successfully:', message._id);

        return res.status(201).json({ message });
    } catch (error) {
        console.error('SEND INTERNAL MESSAGE ERROR:', error);
        return res.status(500).json({
            message: 'Failed to send message',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

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

        
        const unreadMessages = messages.filter(
            msg => msg.recipient.toString() === currentUserId.toString() && !msg.read
        );

        if (unreadMessages.length > 0) {
            await Promise.all(unreadMessages.map(msg => msg.markAsRead()));
        }

        return res.json({ messages });
    } catch (error) {
        console.error('GET CONVERSATION ERROR:', error);
        return res.status(500).json({ message: 'Failed to load conversation' });
    }
};

exports.getAdminInbox = async (req, res) => {
    try {
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        
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
    } catch (error) {
        console.error('GET ADMIN INBOX ERROR:', error);
        return res.status(500).json({ message: 'Failed to load inbox' });
    }
};

exports.getManagerInbox = async (req, res) => {
    try {
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;

        
        const messages = await InternalMessage.find({
            recipient: currentUserId,
            isFromAdmin: true
        })
            .populate('sender', 'username email profilePicture companyRole')
            .sort({ createdAt: -1 })
            .limit(20);

        const unreadCount = await InternalMessage.getUnreadCount(currentUserId);

        return res.json({ messages, unreadCount });
    } catch (error) {
        console.error('GET MANAGER INBOX ERROR:', error);
        return res.status(500).json({ message: 'Failed to load inbox' });
    }
};

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

        
        if (message.recipient.toString() !== currentUserId.toString()) {
            return res.status(403).json({ message: 'Cannot mark other users\' messages as read' });
        }

        await message.markAsRead();

        return res.json({ message });
    } catch (error) {
        console.error('MARK AS READ ERROR:', error);
        return res.status(500).json({ message: 'Failed to mark as read' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        if (!req.user || !req.user.sub) {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const currentUserId = req.user.sub;
        const count = await InternalMessage.getUnreadCount(currentUserId);

        return res.json({ count });
    } catch (error) {
        console.error('GET UNREAD COUNT ERROR:', error);
        return res.status(500).json({ message: 'Failed to get unread count' });
    }
};

module.exports = exports;
