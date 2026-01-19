const mongoose = require("mongoose");

/**
 * DMSession Model
 * 
 * 🔒 CRITICAL: DMs are workspace-scoped
 * - Each DM belongs to exactly ONE workspace
 * - Participants must be members of the workspace
 * - DM history does NOT cross workspaces
 */
const DMSessionSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null }, // Optional: for company-level filtering
participants: {
  type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  validate: v => v.length === 2
},
  lastMessageAt: { type: Date },

  // Soft delete: Users who have hidden/deleted this DM
  hiddenFor: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    hiddenAt: { type: Date, default: Date.now }
  }],

  metadata: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

// Indexes for efficient querying
DMSessionSchema.index({ workspace: 1, participants: 1 });
DMSessionSchema.index({ company: 1, participants: 1 });

module.exports = mongoose.model("DMSession", DMSessionSchema);
