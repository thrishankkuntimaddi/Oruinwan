const mongoose = require("mongoose");

const PollOptionSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },

    votes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }]
  },
  { _id: false }
);

const PollSchema = new mongoose.Schema(
  {
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      required: true,
      unique: true // 🔒 one poll per message
    },

    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true
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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    question: {
      type: String,
      required: true
    },

    options: {
      type: [PollOptionSchema],
      validate: v => v.length >= 2
    },

    allowMultiple: {
      type: Boolean,
      default: false
    },

    expiresAt: {
      type: Date,
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

/* Auto-expire */
PollSchema.pre('save', function () {
  if (this.expiresAt && this.expiresAt < new Date()) {
    this.isActive = false;
  }
});

module.exports = mongoose.model("Poll", PollSchema);
