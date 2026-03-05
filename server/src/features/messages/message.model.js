const mongoose = require("mongoose");

const ReactionSchema = new mongoose.Schema({
  emoji: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  type: { type: String, enum: ["image", "video", "file"], required: true },
  url: String, name: String, size: Number
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
  dm: { type: mongoose.Schema.Types.ObjectId, ref: "DMSession", default: null },
  platformSession: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformSession", default: null }, // Link to platform chat session
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Message type: 'message' (default) or 'system' (auto-generated events)
  type: {
    type: String,
    enum: ['message', 'system'],
    default: 'message'
  },

  // System event metadata (populated only when type === 'system')
  systemEvent: {
    type: String,
    enum: [
      'channel_created',
      'member_joined', 'member_left', 'member_removed', 'member_invited',
      'admin_assigned', 'admin_demoted',
      'channel_renamed', 'channel_privacy_changed',
      'messages_cleared',
      null
    ],
    default: null
  },
  systemData: { type: mongoose.Schema.Types.Mixed, default: null }, // Arbitrary metadata for system events

  // E2EE: Encrypted payload containing ciphertext, messageIv, and isEncrypted flag
  payload: {
    ciphertext: String,
    messageIv: String,
    attachments: [AttachmentSchema],
    isEncrypted: { type: Boolean, default: false }
  },

  text: { type: String, default: "" },
  attachments: [AttachmentSchema],

  // Threading support
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }, // Canonical thread field
  replyCount: { type: Number, default: 0, min: 0 }, // Number of replies to this message
  lastReplyAt: { type: Date, default: null }, // Timestamp of most recent reply

  reactions: [ReactionSchema],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // Pinning
  isPinned: { type: Boolean, default: false },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  pinnedAt: { type: Date, default: null },

  // Deletion tracking
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  deletedByName: { type: String, default: null },  // Store the deleter's name
  deletedAt: { type: Date, default: null },
  isDeletedUniversally: { type: Boolean, default: false },
  hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Local deletions only

  // Edit tracking
  editedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false },    // Soft delete flag (universal)
  version: { type: Number, default: 1 },           // Increments on each edit
}, { timestamps: true });

MessageSchema.index({ company: 1, channel: 1, createdAt: -1 });
MessageSchema.index({ company: 1, dm: 1, createdAt: -1 });
MessageSchema.index({ workspace: 1, createdAt: -1 }); // For dashboard activity queries
MessageSchema.index({ platformSession: 1, createdAt: -1 });
MessageSchema.index({ parentId: 1 }); // For thread lookups
MessageSchema.index({ createdAt: -1 });
// Compound indexes for GET /api/messages/missed range queries (_id > lastSeenMessageId).
// ObjectId is monotonically ordered so { channel|dm, _id } covers both membership filter
// and the "created after" range in a single index scan — no separate createdAt needed.
MessageSchema.index({ channel: 1, _id: 1 });
MessageSchema.index({ dm: 1, _id: 1 });

module.exports = mongoose.model("Message", MessageSchema);
