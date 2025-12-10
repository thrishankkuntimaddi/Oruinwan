const mongoose = require("mongoose");

const WorkspaceSchema = new mongoose.Schema({
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
  name: { type: String, required: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["owner","admin","member"], default: "member" }
  }],
  settings: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

WorkspaceSchema.index({ company: 1, name: 1 });

module.exports = mongoose.model("Workspace", WorkspaceSchema);
