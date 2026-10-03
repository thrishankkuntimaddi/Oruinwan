const logger = require('../../../utils/logger');
const InternalMessage = require('../../../models/InternalMessage');
const mongoose = require('mongoose');
const identity = require('../../identity');
const { hydrate } = require('../../identity/hydrate');

// Users live in PostgreSQL, so InternalMessage's own populate() statics cannot
// resolve sender/recipient; these queries mirror them and hydrate instead.
const PERSON = { type: 'user', fields: ['username', 'email', 'profilePicture', 'companyRole'] };
const toOid = (id) => new mongoose.Types.ObjectId(String(id));

async function conversationBetween(userId1, userId2, limit = 50) {
    const docs = await InternalMessage.find({
        $or: [
            { sender: userId1, recipient: userId2 },
            { sender: userId2, recipient: userId1 },
        ],
    }).sort({ createdAt: 1 }).limit(limit);
    return docs;
}

async function adminInbox(adminId, companyId) {
    const admin = toOid(adminId);
    const conversations = await InternalMessage.aggregate([
        { $match: { companyId: toOid(companyId), $or: [{ sender: admin }, { recipient: admin }] } },
        { $sort: { createdAt: -1 } },
        {
            $group: {
                _id: { $cond: [{ $eq: ['$sender', admin] }, '$recipient', '$sender'] },
                lastMessage: { $first: '$$ROOT' },
                unreadCount: {
                    $sum: { $cond: [{ $and: [{ $eq: ['$recipient', admin] }, { $eq: ['$read', false] }] }, 1, 0] },
                },
            },
        },
        { $sort: { 'lastMessage.createdAt': -1 } },
    ]);
    await hydrate(conversations, { 'lastMessage.sender': PERSON, 'lastMessage.recipient': PERSON });
    return conversations;
}

async function withPeople(docs) {
    const plain = Array.isArray(docs) ? docs.map(d => (d.toJSON ? d.toJSON() : d)) : (docs.toJSON ? docs.toJSON() : docs);
    await hydrate(plain, { sender: PERSON, recipient: PERSON });
    return plain;
}

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

        
        if (!require('mongoose').Types.ObjectId.isValid(String(recipientId))) {
            return res.status(400).json({ message: 'Invalid recipient' });
        }
        const recipient = await identity.users.findById(recipientId);
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

        logger.info('[INTERNAL MESSAGE] Sending:', {
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

        const messageOut = await withPeople(message);

        
        if (req.app.get('io')) {
            const io = req.app.get('io');
            
            io.to(`user:${recipientId}`).emit('internal-message', messageOut);
        }

        logger.info('[INTERNAL MESSAGE] Created successfully:', message._id);

        return res.status(201).json({ message: messageOut });
    } catch (error) {
        logger.error('SEND INTERNAL MESSAGE ERROR:', error);
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

        const messages = await conversationBetween(currentUserId, userId, limit);

        
        const unreadMessages = messages.filter(
            msg => msg.recipient.toString() === currentUserId.toString() && !msg.read
        );

        if (unreadMessages.length > 0) {
            await Promise.all(unreadMessages.map(msg => msg.markAsRead()));
        }

        return res.json({ messages: await withPeople(messages) });
    } catch (error) {
        logger.error('GET CONVERSATION ERROR:', error);
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

        const conversations = await adminInbox(currentUserId, companyId);

        return res.json({ conversations });
    } catch (error) {
        logger.error('GET ADMIN INBOX ERROR:', error);
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
            .sort({ createdAt: -1 })
            .limit(20);

        const unreadCount = await InternalMessage.getUnreadCount(currentUserId);

        return res.json({ messages: await withPeople(messages), unreadCount });
    } catch (error) {
        logger.error('GET MANAGER INBOX ERROR:', error);
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
        logger.error('MARK AS READ ERROR:', error);
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
        logger.error('GET UNREAD COUNT ERROR:', error);
        return res.status(500).json({ message: 'Failed to get unread count' });
    }
};

module.exports = exports;
