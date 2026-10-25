'use strict';

// More pages of a meeting's whiteboard. Page 1 is the meeting's own board (Whiteboard, live
// docId = meetingId); every other page is one of these, live with docId = its own _id.

const mongoose = require('mongoose');

const strokeSchema = new mongoose.Schema({
    id: { type: String, default: null },
    tool: { type: String, default: 'pen' },
    color: { type: String, default: '#FFFFFF' },
    lineWidth: { type: Number, default: 3 },
    points: [{ x: Number, y: Number }],
}, { _id: false });

const whiteboardPageSchema = new mongoose.Schema(
    {
        meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduledMeeting', required: true, index: true },
        workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
        title: { type: String, default: '' },
        order: { type: Number, default: 1 },
        strokes: [strokeSchema],
    },
    { timestamps: true }
);

module.exports = mongoose.models.WhiteboardPage || mongoose.model('WhiteboardPage', whiteboardPageSchema);
