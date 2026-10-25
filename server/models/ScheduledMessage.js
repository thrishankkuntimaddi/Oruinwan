const mongoose = require("mongoose");

/**
 * A message someone wrote now to be sent later. The body is exactly what the send endpoint
 * takes (POST /api/v2/messages/channel or /direct): text is already end-to-end encrypted by the
 * sender's app, so the server never sees it. At `sendAt` the scheduled-messages job sends it
 * through the normal send path (same access checks, notifications and realtime events).
 */
const ScheduledMessageSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
        kind: { type: String, enum: ["channel", "dm"], required: true },
        conversation: { type: mongoose.Schema.Types.ObjectId, required: true },
        body: { type: mongoose.Schema.Types.Mixed, required: true },
        sendAt: { type: Date, required: true },
        status: { type: String, enum: ["scheduled", "sending", "sent", "failed", "cancelled"], default: "scheduled" },
        sentMessageId: { type: mongoose.Schema.Types.ObjectId, default: null },
        error: { type: String, default: null },
    },
    { timestamps: true }
);

ScheduledMessageSchema.index({ status: 1, sendAt: 1 });
ScheduledMessageSchema.index({ user: 1, workspace: 1, status: 1 });

module.exports = mongoose.models.ScheduledMessage || mongoose.model("ScheduledMessage", ScheduledMessageSchema);
