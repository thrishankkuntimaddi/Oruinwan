const mongoose = require("mongoose");

/**
 * DMSession Model
 *
 * 🔒 Workspace-scoped Direct Messages
 *
 * Guarantees:
 * - Exactly 2 distinct participants
 * - Belongs to ONE workspace
 * - Contains NO message content
 * - Safe for E2EE
 */
const DMSessionSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
    },

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null
    },

    participants: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        }
      ],
      validate: {
        validator: function (v) {
          return (
            Array.isArray(v) &&
            v.length === 2 &&
            v[0].toString() !== v[1].toString()
          );
        },
        message: "DMSession must have exactly 2 distinct participants"
      }
    },

    /**
     * Used for inbox sorting only
     * (never stores message content)
     */
    lastMessageAt: {
      type: Date,
      default: Date.now
    },

    /**
     * Per-user soft delete / hide
     */
    hiddenFor: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        hiddenAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    /**
     * Per-user read state for this DM session.
     * Separate from participants[] so the 2-participant validator and
     * unique compound index on { workspace, participants } are not affected.
     * Old documents without this field default to [] — client treats
     * all messages as unread when no entry exists for a user.
     */
    lastSeen: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        lastSeenMessageId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Message",
          default: null
        }
      }
    ],

    /**
     * Per-user mute (notifications silenced)
     */
    mutedBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      mutedAt: { type: Date, default: Date.now }
    }],

    /**
     * Per-user block — blocked user cannot send messages;
     * the blocker sees no new messages from blocked user
     */
    blockedBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      blockedAt: { type: Date, default: Date.now }
    }],

    /**
     * Per-user "clear" watermark — messages before this
     * timestamp are hidden for that user only
     */
    clearedAt: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      clearedAt: { type: Date, default: Date.now }
    }],

    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

/* ---------- Indexes ---------- */

// Prevent duplicate DM sessions in same workspace
DMSessionSchema.index(
  { workspace: 1, participants: 1 },
  { unique: true }
);

// Optional company-level lookup
DMSessionSchema.index({ company: 1, participants: 1 });

/* ---------- Safety Guard ---------- */

DMSessionSchema.pre("save", function (next) {
  if (!this.workspace || !this.participants || this.participants.length !== 2) {
    return next(new Error("Invalid DM session"));
  }
  next();
});

module.exports = mongoose.model("DMSession", DMSessionSchema);
