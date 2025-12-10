const mongoose = require("mongoose");

const DMSessionSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }],
  lastMessageAt: { type: Date },
  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

DMSessionSchema.index({ company: 1, participants: 1 });

module.exports = mongoose.model("DMSession", DMSessionSchema);
