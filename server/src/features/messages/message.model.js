const mongoose = require("mongoose");

const ReactionSchema = new mongoose.Schema({
  emoji: String,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { _id: false });

const AttachmentSchema = new mongoose.Schema({
  type: { type: String, enum: ['image', 'video', 'file', 'audio', 'voice'], required: true },
  url: String,
  name: String,
  size: Number,
  mimeType: String,   // e.g. 'application/pdf', 'video/mp4', 'audio/ogg'
  duration: Number,   // seconds — for audio/video attachments
  thumbnail: String,   // URL — for video poster or image thumb
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
  dm: { type: mongoose.Schema.Types.ObjectId, ref: "DMSession", default: null },
  platformSession: { type: mongoose.Schema.Types.ObjectId, ref: "PlatformSession", default: null }, // Link to platform chat session
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Message type — determines how the UI renders the message bubble
  type: {
    type: String,
    enum: [
      'message',   // standard text / encrypted
      'system',    // auto-generated system event pill
      'poll',      // Phase-7.3
      'file',      // Phase-7.1
      'image',     // Phase-7.1
      'video',     // Phase-7.1
      'voice',     // Phase-7.2
      'contact',   // Phase-7.4
      'meeting',   // Phase-7.6
    ],
    default: 'message'
  },

  // System event metadata (populated only when type === 'system')
  systemEvent: {
    type: String,
    enum: [
      'channel_created',
      'member_joined', 'member_left', 'member_removed', 'member_invited',
      'admin_assigned', 'admin_demoted',
      'channel_renamed', 'channel_desc_changed', 'channel_privacy_changed',
      'message_pinned', 'message_unpinned',
      'messages_cleared',
      null
    ],
    default: null
  },
  systemData: { type: mongoose.Schema.Types.Mixed, default: null }, // Arbitrary metadata for system events

  // E2EE: Encrypted payload containing ciphertext, messageIv, and isEncrypted flag
  // NOTE: payload.attachments is DEPRECATED — use top-level attachments[] instead.
  //       Kept here only for backward-compat reads of legacy documents.
  payload: {
    ciphertext: String,
    messageIv: String,
    isEncrypted: { type: Boolean, default: false }
  },

  text: { type: String, default: '' },

  // ── Canonical attachment location (Phase-7 writes here; legacy payload.attachments is read-only) ──
  attachments: [AttachmentSchema],

  // ── Phase-7 rich-message subdocuments (populated only when type matches) ──

  // type === 'poll'
  poll: {
    question: String,
    options: [{
      text: String,
      votes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    }],
    allowMultiple: { type: Boolean, default: false },
    anonymous: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    endDate: Date,
    isActive: { type: Boolean, default: true },     // Phase-7.3
    totalVotes: { type: Number, default: 0 },         // Phase-7.3 cached count
  },

  // type === 'contact'
  contact: {
    name: String,
    email: String,
    phone: String,
    avatar: String
  },

  // type === 'meeting'
  meeting: {
    title: String,
    startTime: Date,
    duration: Number,   // minutes
    meetingLink: String,
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },

  // type === 'message' with URL — inline link card
  linkPreview: {
    url: String,
    title: String,
    description: String,
    image: String,
    site: String
  },

  // Threading support
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null }, // Canonical thread field
  replyCount: { type: Number, default: 0, min: 0 }, // Number of replies to this message
  lastReplyAt: { type: Date, default: null }, // Timestamp of most recent reply

  // WhatsApp-style inline reply (quoted message preview) — NOT a thread reply
  // parentId=null means the message stays in the main feed; quotedMessageId is just a reference
  quotedMessageId: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },

  reactions: [ReactionSchema],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // Mention tracking — populated server-side from mentionText (never from ciphertext)
  // Optional and backward-compatible: old messages default to []
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", default: [] }],

  // Thread followers — users who receive reply notifications for this thread
  // Optional, additive, backward-compatible. Only set on parent messages.
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],



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

  // Bookmarks — users who have saved this message
  bookmarkedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Edit tracking
  editedAt: { type: Date, default: null },
  // Full edit history — each entry is a snapshot of the message before the edit
  editHistory: [{
    text:       { type: String, default: null },     // plaintext snapshot (plaintext edits)
    ciphertext: { type: String, default: null },     // old encrypted payload (E2EE edits)
    messageIv:  { type: String, default: null },     // IV for the old ciphertext
    isEncrypted:{ type: Boolean, default: false },   // true ↔ this snapshot is E2EE
    editedAt:   { type: Date, default: Date.now }
  }],
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
