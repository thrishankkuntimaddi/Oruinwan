'use strict';

const mongoose = require('mongoose');

const strokeSchema = new mongoose.Schema({
    // Stable id so live (Yjs) boards can address a stroke; optional for legacy boards.
    id: { type: String, default: null },
    tool: { type: String, default: 'pen' },       
    color: { type: String, default: '#FFFFFF' },
    lineWidth: { type: Number, default: 3 },
    points: [{ x: Number, y: Number }],           
}, { _id: false });

const whiteboardSchema = new mongoose.Schema(
    {
        meetingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ScheduledMeeting',
            required: true,
            unique: true,
            index: true,
        },
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
            index: true,
        },
        strokes: [strokeSchema],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Whiteboard', whiteboardSchema);
