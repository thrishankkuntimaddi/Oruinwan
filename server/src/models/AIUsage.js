const mongoose = require('mongoose');

/** One row per AI call: who, where, which intent/provider/model, how long, ok or not. */
const aiUsageSchema = new mongoose.Schema(
    {
        workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true, default: null },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, default: null },
        intent: { type: String, required: true },
        agent: { type: String, default: null },
        provider: { type: String, default: null },
        model: { type: String, default: null },
        durationMs: { type: Number, default: 0 },
        ok: { type: Boolean, default: true },
        error: { type: String, default: null },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

aiUsageSchema.index({ workspaceId: 1, createdAt: -1 });
aiUsageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('AIUsage', aiUsageSchema);
