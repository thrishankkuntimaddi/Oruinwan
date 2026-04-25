const mongoose = require('mongoose');

const scheduledMeetingSchema = new mongoose.Schema(
    {
        
        
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
        
        startTime: {
            type: Date,
            required: true,
        },
        
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
        
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            }
        ],
        
        status: {
            type: String,
            enum: ['scheduled', 'live', 'completed', 'cancelled'],
            default: 'scheduled',
        },

        

        recordingUrl: {
            type: String,
            default: null,
        },

        transcript: {
            type: String,
            default: '',
        },

        summary: {
            type: String,
            default: '',
        },

        
        sharedNotes: {
            type: String,
            default: '',
        },

        
        agenda: [
            {
                _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
                title: { type: String, required: true, trim: true },
                notes: { type: String, default: '' },
                order: { type: Number, default: 0 },
            },
        ],

        
        actionItems: [
            {
                _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
                text: { type: String, required: true, trim: true },
                assignedTo: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'User',
                    default: null,
                },
                
                taskId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Task',
                    default: null,
                },
                status: {
                    type: String,
                    enum: ['pending', 'in_progress', 'done'],
                    default: 'pending',
                },
            },
        ],
    },
    { timestamps: true }
);

scheduledMeetingSchema.index({ companyId: 1, workspaceId: 1, startTime: 1, status: 1 });

module.exports = mongoose.model('ScheduledMeeting', scheduledMeetingSchema);
