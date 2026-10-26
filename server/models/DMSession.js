const mongoose = require("mongoose");

// A group DM holds the creator plus up to this many people in total.
const MAX_GROUP_DM_MEMBERS = 10;

function distinctIds(v) {
  return new Set(v.map((p) => String(p))).size === v.length;
}

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
        // A 1:1 DM has exactly 2 people. A group DM has up to MAX_GROUP_DM_MEMBERS
        // (it can shrink to 1 as people leave).
        validator: function (v) {
          if (!Array.isArray(v) || !distinctIds(v)) return false;
          const group = typeof this.get === "function" ? this.get("isGroup") : this.isGroup;
          return group ? v.length >= 1 && v.length <= MAX_GROUP_DM_MEMBERS : v.length === 2;
        },
        message: "A DM has exactly 2 distinct participants; a group DM has 1 to 10"
      }
    },

    // 1:1 DMs: "<workspace>:<smaller user id>:<larger user id>", unique, so the same two people
    // never get two conversations in one workspace. Not set on groups.
    pairKey: { type: String, default: undefined },

    // Group DMs: 3+ people when created. Stays a group even if people leave.
    isGroup: { type: Boolean, default: false },
    name: { type: String, trim: true, maxlength: 80, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    // When each person joined a group DM; they only see messages from then on.
    // fromKeyVersion: the earliest conversation key version they may hold (missing = 1), so a
    // device that sets up encryption later gets exactly the earlier keys they're allowed.
    memberSince: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      at: { type: Date, default: Date.now },
      fromKeyVersion: { type: Number, default: undefined }
    }],

    
    lastMessageAt: {
      type: Date,
      default: Date.now
    },

    
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

    
    mutedBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      mutedAt: { type: Date, default: Date.now }
    }],

    
    blockedBy: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      blockedAt: { type: Date, default: Date.now }
    }],

    
    clearedAt: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      clearedAt: { type: Date, default: Date.now }
    }],

    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

DMSessionSchema.index({ workspace: 1, participants: 1 });

DMSessionSchema.index({ company: 1, participants: 1 });

DMSessionSchema.index({ pairKey: 1 }, { unique: true, partialFilterExpression: { pairKey: { $type: 'string' } } });

DMSessionSchema.pre("save", function (next) {
  const count = this.participants ? this.participants.length : 0;
  const ok = this.isGroup ? count >= 1 && count <= MAX_GROUP_DM_MEMBERS : count === 2;
  if (!this.workspace || !ok) {
    return next(new Error("Invalid DM session"));
  }
  next();
});

/** The pair key of a 1:1 DM between two people in a workspace. */
function dmPairKey(workspaceId, userA, userB) {
  const [a, b] = [String(userA), String(userB)].sort();
  return `${String(workspaceId)}:${a}:${b}`;
}

const DMSession = mongoose.model("DMSession", DMSessionSchema);
DMSession.MAX_GROUP_DM_MEMBERS = MAX_GROUP_DM_MEMBERS;
DMSession.dmPairKey = dmPairKey;
module.exports = DMSession;
