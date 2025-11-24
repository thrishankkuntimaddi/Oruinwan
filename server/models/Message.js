// server/models/Message.js
const mongoose = require("mongoose");

const ReactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { _id: false }
);

const AttachmentSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["image", "video", "file"], required: true },
    url: { type: String, required: true },
    name: { type: String },
    size: { type: Number }
  },
  { _id: false }
);

/**
 * Message Schema - supports:
 *  - direct messages (receiverId)
 *  - channel messages (channelId)
 *  - replies (replyTo)
 *  - reactions (reactions[])
 *  - attachments (attachments[])
 *  - pinned messages (isPinned)
 *  - read receipts (readBy array)
 */
const MessageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // For DMs: set receiverId
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    // For channel messages: set channelId
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },

    text: { type: String, default: "" },

    attachments: [AttachmentSchema],

    // If this message is a reply to another message
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },

    isPinned: { type: Boolean, default: false },

    reactions: [ReactionSchema],

    // Users who have read the message (useful for DMs & channels)
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  {
    timestamps: true
  }
);

// Indexes to speed up common queries
MessageSchema.index({ channelId: 1, createdAt: -1 });
MessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });
MessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);
