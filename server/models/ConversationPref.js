const mongoose = require("mongoose");

/**
 * One person's own settings for one conversation in their chat list: pinned to the top (at most
 * three per workspace) or archived (moved out of the list). Nobody else sees these.
 */
const ConversationPrefSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
        kind: { type: String, enum: ["channel", "dm"], required: true },
        conversation: { type: mongoose.Schema.Types.ObjectId, required: true },
        pinnedAt: { type: Date, default: null },
        archivedAt: { type: Date, default: null },
    },
    { timestamps: true }
);

ConversationPrefSchema.index({ user: 1, workspace: 1 });
ConversationPrefSchema.index({ user: 1, conversation: 1 }, { unique: true });

module.exports = mongoose.models.ConversationPref || mongoose.model("ConversationPref", ConversationPrefSchema);
