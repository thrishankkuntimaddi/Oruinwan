// server/models/InternalMessage.js
// Internal messaging between Managers and Company Admins

const mongoose = require('mongoose');

const internalMessageSchema = new mongoose.Schema({
    companyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Company',
        required: true,
        index: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true
    },
    messageType: {
        type: String,
        enum: ['manager-to-admin', 'admin-to-manager'],
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    readAt: {
        type: Date
    },
    attachments: [{
        filename: String,
        url: String,
        size: Number,
        mimeType: String
    }],
    // Helpful for quick filtering
    isFromAdmin: {
        type: Boolean,
        default: false
    },
    // Department context (optional, helps with filtering)
    departmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Department'
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
internalMessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
internalMessageSchema.index({ companyId: 1, read: 1 });
internalMessageSchema.index({ recipient: 1, read: 1, createdAt: -1 });

// Virtual for conversation partner (from sender's perspective)
internalMessageSchema.virtual('conversationPartner').get(function () {
    return this.populated('sender') ? this.recipient : this.sender;
});

// Method to mark as read
internalMessageSchema.methods.markAsRead = async function () {
    if (!this.read) {
        this.read = true;
        this.readAt = new Date();
        await this.save();
    }
    return this;
};

// Static method to get conversation between two users
internalMessageSchema.statics.getConversation = async function (userId1, userId2, limit = 50) {
    return this.find({
        $or: [
            { sender: userId1, recipient: userId2 },
            { sender: userId2, recipient: userId1 }
        ]
    })
        .populate('sender', 'username email profilePicture companyRole')
        .populate('recipient', 'username email profilePicture companyRole')
        .sort({ createdAt: 1 })
        .limit(limit);
};

// Static method to get unread count for a user
internalMessageSchema.statics.getUnreadCount = async function (userId) {
    return this.countDocuments({
        recipient: userId,
        read: false
    });
};

// Static method to get admin inbox (all conversations with managers)
internalMessageSchema.statics.getAdminInbox = async function (adminId, companyId) {
    // Get latest message from each unique conversation
    const conversations = await this.aggregate([
        {
            $match: {
                companyId: mongoose.Types.ObjectId(companyId),
                $or: [
                    { sender: mongoose.Types.ObjectId(adminId) },
                    { recipient: mongoose.Types.ObjectId(adminId) }
                ]
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $group: {
                _id: {
                    $cond: [
                        { $eq: ['$sender', mongoose.Types.ObjectId(adminId)] },
                        '$recipient',
                        '$sender'
                    ]
                },
                lastMessage: { $first: '$$ROOT' },
                unreadCount: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $eq: ['$recipient', mongoose.Types.ObjectId(adminId)] },
                                    { $eq: ['$read', false] }
                                ]
                            },
                            1,
                            0
                        ]
                    }
                }
            }
        },
        {
            $sort: { 'lastMessage.createdAt': -1 }
        }
    ]);

    // Populate user details
    await this.populate(conversations, {
        path: 'lastMessage.sender lastMessage.recipient',
        select: 'username email profilePicture companyRole'
    });

    return conversations;
};

module.exports = mongoose.model('InternalMessage', internalMessageSchema);
