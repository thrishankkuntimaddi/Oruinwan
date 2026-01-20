const mongoose = require("mongoose");

/* ---------- Sub Schemas ---------- */

const ReactionSchema = new mongoose.Schema({
  emoji: { type: String, required: true },
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  kind: {
    type: String,
    enum: ["image", "video", "audio", "document", "contact"],
    required: true
  },
  url: String,
  name: String,
  size: Number,
  mimeType: String,
  duration: Number, // audio / video
  metadata: mongoose.Schema.Types.Mixed
}, { _id: false });

/* ---------- Message Schema ---------- */

const MessageSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace" },

  channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
  dm: { type: mongoose.Schema.Types.ObjectId, ref: "DMSession", default: null },

  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  /** 🔑 Unified Event System */
  type: {
    type: String,
    enum: ["message", "poll", "meeting", "system"],
    default: "message"
  },

  payload: {
    text: { type: String, default: "" }, // Plaintext (for non-encrypted messages)
    attachments: [AttachmentSchema],
    poll: { type: mongoose.Schema.Types.ObjectId, ref: "Poll", default: null },
    meeting: mongoose.Schema.Types.Mixed,

    // End-to-End Encryption Fields
    ciphertext: { type: String }, // Encrypted message content (Base64)
    messageIv: { type: String }, // Initialization vector for AES (Base64)
    isEncrypted: { type: Boolean, default: false } // Backward compatibility flag
  },

  /** Threads */
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },

  /** Reactions */
  reactions: [ReactionSchema],

  /** Read Receipts */
  readBy: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    readAt: { type: Date, default: Date.now }
  }],

  /** Pinning */
  isPinned: { type: Boolean, default: false },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  pinnedAt: Date,

  /** Deletion */
  deletedForEveryone: { type: Boolean, default: false },
  deletedAt: Date,
  hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]

}, { timestamps: true });

/* ---------- Indexes ---------- */
MessageSchema.index({ channel: 1, createdAt: -1 });
MessageSchema.index({ dm: 1, createdAt: -1 });
MessageSchema.index({ parentId: 1 });

// Cursor-based pagination indexes (for efficient _id queries)
MessageSchema.index({ dm: 1, _id: -1 });
MessageSchema.index({ channel: 1, _id: -1 });

module.exports = mongoose.model("Message", MessageSchema);
