/**
 * automationRun.model.js
 *
 * Tracks each execution of an automation rule.
 * Used for history/debugging and telemetry.
 */

const mongoose = require('mongoose');

const AutomationRunSchema = new mongoose.Schema({
    automationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation', required: true, index: true },
    workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },

    // Event that triggered this run
    triggerType:  { type: String, required: true },
    triggerData:  { type: mongoose.Schema.Types.Mixed, default: {} },

    // Execution result
    status: { type: String, enum: ['success', 'partial', 'failed'], default: 'success' },
    actionsExecuted: [{
        type:    { type: String },
        success: { type: Boolean },
        error:   { type: String }
    }],
    error: { type: String, default: null },

    // Duration in ms
    durationMs: { type: Number, default: 0 }
}, {
    timestamps: true
});

// TTL index — auto-delete run logs after 30 days
AutomationRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('AutomationRun', AutomationRunSchema);
