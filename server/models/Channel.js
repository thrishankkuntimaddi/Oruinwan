const mongoose = require("mongoose");

/**
 * Channel Model
 *
 * Guarantees:
 * - Workspace-scoped
 * - Strong membership rules
 * - Explicit channel type invariants
 * - Safe for E2EE message flow
 */
const ChannelSchema = new mongoose.Schema(
  {
    /* ---------- Scope ---------- */

    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true
    },

    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      default: null
    },

    /* ---------- Identity ---------- */

    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ""
    },

    topic: {
      type: String,
      default: ""
    },

    /* ---------- Channel Type ---------- */

    isPrivate: {
      type: Boolean,
      default: false
    },

    /**
     * Default channels:
     * - auto-joined by all workspace members
     * - always public
     */
    isDefault: {
      type: Boolean,
      default: false
    },

    isArchived: {
      type: Boolean,
      default: false
    },

    /**
     * Discoverability (for public channels):
     * - true: Non-members can see and self-join this channel
     * - false: Only visible to members (invite-only)
     * - Private channels ignore this (always invite-only)
     */
    isDiscoverable: {
      type: Boolean,
      default: true // Backward compatible: existing channels become discoverable
    },

    /* ---------- System Events (Timeline Markers) ---------- */

    /**
     * Non-encrypted timeline events (NOT chat messages)
     * Examples: user joined, user left, channel created
     * Displayed as timeline separators in UI
     */
    systemEvents: [
      {
        type: {
          type: String,
          enum: ['user_joined', 'user_left', 'channel_created'],
          required: true
        },
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        timestamp: {
          type: Date,
          default: Date.now
        },
        metadata: mongoose.Schema.Types.Mixed
      }
    ],

    /* ---------- Ownership ---------- */

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    /* ---------- Members ---------- */

    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true
        },
        joinedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    /* ---------- Admins ---------- */

    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
      }
    ],

    /* ---------- Activity ---------- */

    lastMessageAt: {
      type: Date,
      default: null,
      index: true
    },

    messageCount: {
      type: Number,
      default: 0
    },

    /* ---------- Pinned ---------- */

    pinnedMessages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message"
      }
    ],

    /* ---------- Tabs ---------- */

    tabs: [
      {
        name: { type: String, required: true },
        type: { type: String, enum: ["canvas"], default: "canvas" },
        content: { type: String, default: "" },
        createdAt: { type: Date, default: Date.now },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
      }
    ],

    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

/* ======================
   Indexes
====================== */

ChannelSchema.index({ workspace: 1, name: 1 }, { unique: true });
ChannelSchema.index({ "members.user": 1 });
ChannelSchema.index({ company: 1, isPrivate: 1 });

/* ======================
   Invariants (CRITICAL)
====================== */

ChannelSchema.pre("save", function (next) {
  // ❌ Default channels cannot be private
  if (this.isDefault && this.isPrivate) {
    return next(
      new Error("Default channels cannot be private")
    );
  }

  // ❌ Private channels must have admins
  if (this.isPrivate && (!this.admins || this.admins.length === 0)) {
    return next(
      new Error("Private channels must have at least one admin")
    );
  }

  next();
});

/* ======================
   Helpers
====================== */

ChannelSchema.methods.isMember = function (userId) {
  if (!this.isPrivate || this.isDefault) return true;

  return this.members.some(m =>
    m.user.toString() === userId.toString()
  );
};

ChannelSchema.methods.getUserJoinDate = function (userId) {
  const member = this.members.find(
    m => m.user.toString() === userId.toString()
  );

  // Privacy-first: if unknown, restrict history
  return member?.joinedAt || new Date();
};

ChannelSchema.methods.isAdmin = function (userId) {
  return this.admins.some(
    adminId => adminId.toString() === userId.toString()
  );
};

ChannelSchema.methods.isOnlyAdmin = function (userId) {
  return (
    this.admins.length === 1 &&
    this.isAdmin(userId)
  );
};

module.exports = mongoose.model("Channel", ChannelSchema);
