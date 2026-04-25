const mongoose = require('mongoose');

const internalMessageSchema = new mongoose.Schema(
  {
    

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
      default: false,
      index: true
    },

    readAt: {
      type: Date,
      default: null
    },

    

    attachments: [
      {
        filename: String,
        url: String,
        size: Number,
        mimeType: String
      }
    ],

    

    isFromAdmin: {
      type: Boolean,
      default: false
    },

    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      default: null
    },

    

    isSystemLocked: {
      type: Boolean,
      default: true 
    }
  },
  { timestamps: true }
);

internalMessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
internalMessageSchema.index({ recipient: 1, read: 1, createdAt: -1 });
internalMessageSchema.index({ companyId: 1, read: 1 });

internalMessageSchema.virtual('conversationPartner').get(function () {
  return this.sender.equals(this._viewerId)
    ? this.recipient
    : this.sender;
});

internalMessageSchema.methods.markAsRead = async function () {
  if (!this.read) {
    this.read = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

internalMessageSchema.statics.getConversation = async function (
  userId1,
  userId2,
  limit = 50
) {
  return this.find({
    $or: [
      { sender: userId1, recipient: userId2 },
      { sender: userId2, recipient: userId1 }
    ]
  })
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('sender', 'username email profilePicture companyRole')
    .populate('recipient', 'username email profilePicture companyRole');
};

internalMessageSchema.statics.getUnreadCount = async function (userId) {
  return this.countDocuments({
    recipient: userId,
    read: false
  });
};

internalMessageSchema.statics.getAdminInbox = async function (
  adminId,
  companyId
) {
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
    { $sort: { createdAt: -1 } },
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
    { $sort: { 'lastMessage.createdAt': -1 } }
  ]);

  await this.populate(conversations, {
    path: 'lastMessage.sender lastMessage.recipient',
    select: 'username email profilePicture companyRole'
  });

  return conversations;
};

module.exports = mongoose.model('InternalMessage', internalMessageSchema);
