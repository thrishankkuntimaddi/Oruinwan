// server/models/Channel.js
const mongoose = require("mongoose");

/**
 * Channel model for group chats.
 * - isPrivate: true => invite-only
 * - members: users who belong to this channel
 */
const ChannelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    isPrivate: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed } // optional extra info
  },
  {
    timestamps: true
  }
);

ChannelSchema.index({ name: 1 });

module.exports = mongoose.model("Channel", ChannelSchema);
