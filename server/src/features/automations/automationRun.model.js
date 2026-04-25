const mongoose = require('mongoose');

const AutomationRunSchema = new mongoose.Schema({
    automationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Automation', required: true, index: true },
    workspaceId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },

    
    triggerType:  { type: String, required: true },
    triggerData:  { type: mongoose.Schema.Types.Mixed, default: {} },

    
    status: { type: String, enum: ['success', 'partial', 'failed'], default: 'success' },
    actionsExecuted: [{
        type:    { type: String },
        success: { type: Boolean },
        error:   { type: String }
    }],
    error: { type: String, default: null },

    
    durationMs: { type: Number, default: 0 }
}, {
    timestamps: true
});

AutomationRunSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('AutomationRun', AutomationRunSchema);
