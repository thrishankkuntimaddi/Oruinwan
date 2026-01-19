const mongoose = require("mongoose");

const PollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { _id: false });

const PollSchema = new mongoose.Schema({
  message: { type: mongoose.Schema.Types.ObjectId, ref: "Message", required: true },

  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  channel: { type: mongoose.Schema.Types.ObjectId, ref: "Channel", default: null },
  dm: { type: mongoose.Schema.Types.ObjectId, ref: "DMSession", default: null },

  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  question: { type: String, required: true },
  options: [PollOptionSchema],

  allowMultiple: { type: Boolean, default: false },

  expiresAt: Date,
  isActive: { type: Boolean, default: true }

}, { timestamps: true });

module.exports = mongoose.model("Poll", PollSchema);
