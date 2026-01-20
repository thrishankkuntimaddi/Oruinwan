/**
 * SupportMessage Model
 *
 * PURPOSE:
 * - Platform support communication
 * - Company ↔ Platform Admin conversations
 *
 * GUARANTEES:
 * - ❌ NOT end-to-end encrypted
 * - ❌ NOT used in workspace chat
 * - ❌ NOT used in Message.js pipeline
 * - ✅ Fully auditable by platform admins
 *
 * SCOPE:
 * - Used only inside SupportTicket flows
 * - Visible only in Admin / Support UI
 */

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
    /* ---------- Context ---------- */

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

    /* ---------- Sender ---------- */

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

    /* ---------- Message Content ---------- */

    /**
     * Plaintext by design
     * (Support communication must be auditable)
     */
    content: {
      type: String,
      required: true,
      trim: true
    },

    attachments: [SupportAttachmentSchema],

    /* ---------- Read Tracking ---------- */

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

    /* ---------- Moderation ---------- */

    isInternalNote: {
      type: Boolean,
      default: false
    },

    /* ---------- Soft Deletion ---------- */

    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

/* =======================
   Indexes (Performance)
======================= */

// Fast ticket timeline
SupportMessageSchema.index({ ticket: 1, createdAt: 1 });

// Company-level filtering
SupportMessageSchema.index({ company: 1, createdAt: -1 });

// Sender audit
SupportMessageSchema.index({ sender: 1 });

/* =======================
   Static Methods
======================= */

/**
 * Get paginated messages for a ticket
 * @param {ObjectId} ticketId - Ticket ID
 * @param {Object} options - { limit, before, after }
 */
SupportMessageSchema.statics.getTicketTimeline = async function (ticketId, options = {}) {
  const { limit = 50, before, after } = options;

  const query = { ticket: ticketId, deletedAt: null };

  // Cursor-based pagination
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

/**
 * Mark message as read by a user
 * @param {ObjectId} messageId - Message ID
 * @param {ObjectId} userId - User ID
 */
SupportMessageSchema.statics.markAsRead = async function (messageId, userId) {
  const message = await this.findById(messageId);

  if (!message) {
    throw new Error('Message not found');
  }

  // Check if already read by this user
  const alreadyRead = message.readBy.some(
    (read) => read.user.toString() === userId.toString()
  );

  if (!alreadyRead) {
    message.readBy.push({ user: userId, readAt: new Date() });
    await message.save();
  }

  return message;
};

/**
 * Get unread message count for a ticket (for a specific user)
 * @param {ObjectId} ticketId - Ticket ID
 * @param {ObjectId} userId - User ID
 */
SupportMessageSchema.statics.getUnreadCount = async function (ticketId, userId) {
  return this.countDocuments({
    ticket: ticketId,
    deletedAt: null,
    'readBy.user': { $ne: userId }
  });
};

/* =======================
   Export
======================= */

module.exports = mongoose.model("SupportMessage", SupportMessageSchema);
