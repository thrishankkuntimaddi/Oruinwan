const mongoose = require('mongoose');

// One executed (or skipped) step of a run.
const StepSchema = new mongoose.Schema({
    index:      { type: Number },
    stepId:     { type: String, default: null },
    type:       { type: String },
    status:     { type: String, enum: ['success', 'failed', 'skipped'], default: 'success' },
    // Kept for older clients: true when status is 'success'.
    success:    { type: Boolean },
    error:      { type: String, default: null },
    reason:     { type: String, default: null },
    output:     { type: mongoose.Schema.Types.Mixed, default: null },
    // Interpolated config (test runs only, secrets masked).
    preview:    { type: mongoose.Schema.Types.Mixed, default: undefined },
    startedAt:  { type: Date },
    durationMs: { type: Number, default: 0 }
}, { _id: false });

const AutomationRunSchema = new mongoose.Schema({
    automationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation', required: true, index: true },
    workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },


    triggerType:  { type: String, required: true },
    triggerData:  { type: mongoose.Schema.Types.Mixed, default: {} },
    // event (a real trigger), schedule, manual ("run now") or test (dry run, nothing executed).
    source:       { type: String, enum: ['event', 'schedule', 'manual', 'test'], default: 'event' },
    dryRun:       { type: Boolean, default: false },
    triggeredBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    conditionsMet: { type: Boolean, default: true },

    // skipped: conditions not met (recorded for manual/test runs only).
    status: { type: String, enum: ['success', 'partial', 'failed', 'skipped'], default: 'success' },
    actionsExecuted: { type: [StepSchema], default: [] },
    error: { type: String, default: null },


    durationMs: { type: Number, default: 0 }
}, {
    timestamps: true
});

AutomationRunSchema.index({ automationId: 1, createdAt: -1 });
AutomationRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('AutomationRun', AutomationRunSchema);
