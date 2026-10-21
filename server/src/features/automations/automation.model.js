const mongoose = require('mongoose');

const ConditionSchema = new mongoose.Schema({
    field:    { type: String, required: true },
    operator: {
        type: String,
        required: true,
        enum: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'in', 'exists', 'matches']
    },
    // String for most operators; an array for `in`; boolean (or omitted) for `exists`.
    value:    { type: mongoose.Schema.Types.Mixed, default: null }
}, { _id: false });

const ACTION_TYPES = [
    'send_message',
    'create_task',
    'assign_task',
    'send_notification',
    'call_webhook',
    'post_to_slack',
    'trigger_ci_pipeline'
];

// One step of the automation. Steps run in order; each step's output is available to
// later steps as {{steps.<id>.<field>}} (or {{steps.<index>.<field>}}) and {{previous.<field>}}.
const ActionSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: ACTION_TYPES },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    id:   { type: String, default: null, maxlength: 40 },
    name: { type: String, default: null, maxlength: 120 },
    // Keep going with the next step when this one fails (default: stop the run).
    continueOnError: { type: Boolean, default: false }
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
    // interval: "15m" / "2h" / "1d"; cron: 5-field expression evaluated in `timezone`.
    type:       { type: String, enum: ['interval', 'cron'], default: 'interval' },
    expression: { type: String },
    timezone:   { type: String, default: 'UTC' }
}, { _id: false });

const AutomationSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name:        { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 500 },
    isActive:    { type: Boolean, default: true },

    trigger:    { type: TriggerSchema, required: true },
    conditions: { type: [ConditionSchema], default: [] },
    // 'all' (every condition) or 'any' (at least one).
    conditionLogic: { type: String, enum: ['all', 'any'], default: 'all' },
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
module.exports.ACTION_TYPES = ACTION_TYPES;
