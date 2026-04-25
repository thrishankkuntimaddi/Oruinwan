const mongoose = require("mongoose");

const SupportAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    url: { type: String, required: true },
    size: { type: Number },
    mimeType: { type: String }
  },
  { _id: false }
);

const SupportMessageSchema = new mongoose.Schema(
  {
    

    ticket: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportTicket",
      required: true,
      index: true
    },

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true
    },

    

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    senderRole: {
      type: String,
      enum: ["company", "platform"],
      required: true
    },

    

    
    content: {
      type: String,
      required: true,
      trim: true
    },

    attachments: [SupportAttachmentSchema],

    

    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User"
        },
        readAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    

    isInternalNote: {
      type: Boolean,
      default: false
    },

    

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

SupportMessageSchema.index({ ticket: 1, createdAt: 1 });

SupportMessageSchema.index({ company: 1, createdAt: -1 });

SupportMessageSchema.index({ sender: 1 });

SupportMessageSchema.statics.getTicketTimeline = async function (ticketId, options = {}) {
  const { limit = 50, before, after } = options;

  const query = { ticket: ticketId, deletedAt: null };

  
  if (before) {
    query._id = { $lt: before };
  } else if (after) {
    query._id = { $gt: after };
  }

  return this.find(query)
    .sort({ createdAt: 1 })
    .limit(limit)
    .populate('sender', 'username email profilePicture')
    .lean();
};

SupportMessageSchema.statics.markAsRead = async function (messageId, userId) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error('Message not found');
  }

  
  const alreadyRead = message.readBy.some(
    (read) => read.user.toString() === userId.toString()
  );

  if (!alreadyRead) {
    message.readBy.push({ user: userId, readAt: new Date() });
    await message.save();
  }

  return message;
};

SupportMessageSchema.statics.getUnreadCount = async function (ticketId, userId) {
  return this.countDocuments({
    ticket: ticketId,
    deletedAt: null,
    'readBy.user': { $ne: userId }
  });
};

module.exports = mongoose.model("SupportMessage", SupportMessageSchema);
