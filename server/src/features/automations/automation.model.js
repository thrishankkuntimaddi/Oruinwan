const mongoose = require('mongoose');

const ConditionSchema = new mongoose.Schema({
    field:    { type: String, required: true },
    operator: { type: String, required: true, enum: ['equals', 'not_equals', 'contains'] },
    value:    { type: String, required: true }
}, { _id: false });

const ActionSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            'send_message',
            'create_task',
            'assign_task',
            'send_notification',
            'call_webhook',
            'post_to_slack',
            'trigger_ci_pipeline'
        ]
    },
    config: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const TriggerSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: [
            'message.sent',
            'task.created',
            'task.completed',
            'meeting.completed',
            'file.uploaded',
            'github.pr_merged',
            'webhook.received',
            'scheduled'
        ]
    },
    config: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false });

const ScheduleSchema = new mongoose.Schema({
    type:       { type: String, enum: ['interval'], default: 'interval' },
    expression: { type: String } 
}, { _id: false });

const AutomationSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name:        { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    isActive:    { type: Boolean, default: true },

    trigger:    { type: TriggerSchema, required: true },
    conditions: { type: [ConditionSchema], default: [] },
    actions:    { type: [ActionSchema], required: true },

    
    schedule: { type: ScheduleSchema, default: null },

    
    runCount:   { type: Number, default: 0 },
    lastRunAt:  { type: Date, default: null },
    lastError:  { type: String, default: null },

    
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    
    deleted: { type: Boolean, default: false },

    
    templateId: { type: String, default: null }
}, {
    timestamps: true
});

AutomationSchema.index({ workspaceId: 1, isActive: 1, 'trigger.type': 1 });
AutomationSchema.index({ workspaceId: 1, deleted: 1 });

module.exports = mongoose.model('Automation', AutomationSchema);
