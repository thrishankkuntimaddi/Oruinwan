'use strict';

const mongoose = require('mongoose');

const brainstormItemSchema = new mongoose.Schema({
    text: { type: String, required: true, trim: true },
    position: {
        x: { type: Number, default: 100 },
        y: { type: Number, default: 100 },
    },
    color: { type: String, default: '#FBBF24' },   
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
}, { timestamps: true });

const brainstormSchema = new mongoose.Schema(
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
        items: [brainstormItemSchema],
    },
    { timestamps: true }
);

module.exports = mongoose.model('Brainstorm', brainstormSchema);
