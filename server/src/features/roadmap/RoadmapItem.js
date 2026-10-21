'use strict';

const mongoose = require('mongoose');

/** Item statuses, in board order. */
const ROADMAP_STATUSES = ['planned', 'in_progress', 'at_risk', 'done'];

/**
 * Colours are names of existing web theme tokens (client/src/index.css), never
 * hex values, so roadmap bars always follow the Monolith Gloss light/dark theme:
 * `var(--<name>)` on the web; the phone app maps the same names.
 */
const ROADMAP_COLORS = ['accent', 'color-primary', 'color-success', 'color-warning', 'color-danger', 'text-muted'];

const QUARTER_RE = /^\d{4}-Q[1-4]$/;

const roadmapItemSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 10000 },
    status: { type: String, enum: ROADMAP_STATUSES, default: 'planned' },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    milestoneIds: [{ type: String }],
    taskIds: [{ type: String }],
    projectId: { type: String, default: null },
    channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
    quarter: { type: String, default: null, validate: { validator: (v) => v == null || QUARTER_RE.test(v), message: 'quarter must look like 2026-Q4' } },
    order: { type: Number, default: 0 },
    color: { type: String, enum: ROADMAP_COLORS, default: 'accent' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deleted: { type: Boolean, default: false },
}, { timestamps: true });

roadmapItemSchema.index({ workspaceId: 1, deleted: 1, order: 1 });
roadmapItemSchema.index({ workspaceId: 1, quarter: 1 });

module.exports = mongoose.model('RoadmapItem', roadmapItemSchema);
module.exports.ROADMAP_STATUSES = ROADMAP_STATUSES;
module.exports.ROADMAP_COLORS = ROADMAP_COLORS;
module.exports.QUARTER_RE = QUARTER_RE;
