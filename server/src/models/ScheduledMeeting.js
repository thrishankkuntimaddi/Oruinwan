/**
 * ScheduledMeeting.js
 *
 * Persists scheduled meetings created from the ScheduleMeetingModal
 * or HomePanel. Scoped to a workspace so the HomePanel sidebar can
 * query upcoming meetings across all channels.
 *
 * SECURITY (S-02): companyId added for multi-tenant isolation.
 * All queries must include companyId to prevent cross-tenant access.
 */
const mongoose = require('mongoose');

const scheduledMeetingSchema = new mongoose.Schema(
    {
        // S-02: Tenant isolation — every meeting is scoped to a company.
        // Required so that GET/PATCH/DELETE can never cross tenant boundaries.
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
            required: true,
            index: true,
        },
        workspaceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Workspace',
            required: true,
            index: true,
        },
        channelId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Channel',
            default: null,
        },
        dmSessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'DMSession',
            default: null,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 150,
        },
        // ISO start time
        startTime: {
            type: Date,
            required: true,
        },
        // Duration in minutes
        duration: {
            type: Number,
            default: 30,
            min: 5,
            max: 480,
        },
        meetingLink: {
            type: String,
            default: null,
            trim: true,
        },
        // Workspace members invited (refs, not required)
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            }
        ],
        // 'scheduled' | 'live' | 'completed' | 'cancelled'
        status: {
            type: String,
            enum: ['scheduled', 'live', 'completed', 'cancelled'],
            default: 'scheduled',
        },
    },
    { timestamps: true }
);

// S-02: Compound index — all tenant-scoped queries use companyId first
scheduledMeetingSchema.index({ companyId: 1, workspaceId: 1, startTime: 1, status: 1 });

module.exports = mongoose.model('ScheduledMeeting', scheduledMeetingSchema);
