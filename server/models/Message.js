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
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  text: { type: String, default: "" },
  attachments: [AttachmentSchema],
  threadParent: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
  reactions: [ReactionSchema],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  // Pinning
  isPinned: { type: Boolean, default: false },
  pinnedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  pinnedAt: { type: Date, default: null },

  // Deletion tracking
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  deletedAt: { type: Date, default: null },
  isDeletedUniversally: { type: Boolean, default: false },
  hiddenFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // Local deletions only
}, { timestamps: true });

MessageSchema.index({ company: 1, channel: 1, createdAt: -1 });
MessageSchema.index({ company: 1, dm: 1, createdAt: -1 });
MessageSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Message", MessageSchema);
