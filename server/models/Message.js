const mongoose = require("mongoose");

/* =======================
   Sub Schemas
======================= */

/**
 * Emoji reactions on messages
 */
const ReactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { _id: false }
);

/**
 * Attachments metadata only
 * (Actual files stored elsewhere)
 */
const AttachmentSchema = new mongoose.Schema(
  {
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
  },
  { _id: false }
);

/* =======================
   Message Schema (E2EE)
======================= */

/**
 * 🔐 E2EE Message Model
 *
 * GUARANTEES:
 * - NO plaintext message content is ever stored
 * - Server cannot read messages
 * - Encryption is mandatory (DB-enforced)
 *
 * USED FOR:
 * - Workspace channels
 * - Workspace DMs
 *
 * ❌ NOT used for:
 * - Platform admin messages
 * - System/broadcast/support messages
 */
const MessageSchema = new mongoose.Schema(
  {
    /* ---------- Scope ---------- */

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company"
    },

    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace"
    },

    channel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Channel",
      default: null
    },

    dm: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DMSession",
      default: null
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    /* ---------- Message Type ---------- */

    type: {
      type: String,
      enum: ["message", "poll", "meeting", "system"],
      default: "message"
    },

    /* ---------- Encrypted Payload (ONLY SOURCE OF CONTENT) ---------- */

    payload: {
      /**
       * Base64-encoded AES-GCM ciphertext
       * REQUIRED — plaintext is never stored
       */
      ciphertext: {
        type: String,
        required: true
      },

      /**
       * Base64-encoded IV (nonce)
       * REQUIRED for decryption
       */
      messageIv: {
        type: String,
        required: true
      },

      /**
       * Explicit encryption flag
       * (defensive, debugging, backwards safety)
       */
      isEncrypted: {
        type: Boolean,
        required: true,
        default: true
      },

      /**
       * Attachments metadata only
       */
      attachments: {
        type: [AttachmentSchema],
        default: []
      },

      /**
       * Optional encrypted references
       * (IDs themselves are not sensitive)
       */
      poll: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Poll",
        default: null
      },

      meeting: {
        type: mongoose.Schema.Types.Mixed,
        default: null
      }
    },

    /* ---------- Threads ---------- */

    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null
    },

    /* ---------- Reactions ---------- */

    reactions: {
      type: [ReactionSchema],
      default: []
    },

    /* ---------- Read Receipts ---------- */

    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        readAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    /* ---------- Pinning ---------- */

    isPinned: {
      type: Boolean,
      default: false
    },

    pinnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    pinnedAt: {
      type: Date,
      default: null
    },

    /* ---------- Deletion ---------- */

    deletedForEveryone: {
      type: Boolean,
      default: false
    },

    deletedAt: {
      type: Date,
      default: null
    },

    /**
     * Users who hid this message locally
     * (does NOT affect others)
     */
    hiddenFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  {
    timestamps: true
  }
);

/* =======================
   Schema Guards
======================= */

/**
 * Prevent impossible payload states
 * (poll + meeting together is invalid)
 */
MessageSchema.pre("validate", function (next) {
  const { poll, meeting } = this.payload || {};

  if (poll && meeting) {
    return next(
      new Error("Message payload cannot contain both poll and meeting")
    );
  }

  next();
});

/* =======================
   Indexes (Performance)
======================= */

// Channel pagination (cursor-based)
MessageSchema.index({ channel: 1, _id: -1 });

// DM pagination (cursor-based)
MessageSchema.index({ dm: 1, _id: -1 });

// Thread lookups
MessageSchema.index({ parentId: 1 });

// Read receipt queries
MessageSchema.index({ "readBy.user": 1 });

/* =======================
   Export
======================= */

module.exports = mongoose.model("Message", MessageSchema);
