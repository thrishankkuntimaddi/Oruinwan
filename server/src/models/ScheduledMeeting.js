const mongoose = require('mongoose');
const { recordingSchema } = require('../features/meetings/recordings');
const { segmentSchema } = require('../features/meetings/transcript');

const scheduledMeetingSchema = new mongoose.Schema(
    {
        // Optional: personal (company-less) workspaces schedule meetings too.
        // Access is scoped by workspaceId; companyId is copied from the workspace.
        companyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Company',
            default: null,
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
        // 'scheduled': created from the schedule UI / AI. 'huddle': an ad-hoc call started
        // in a channel, DM or the workspace (one record per call, created when it starts).
        kind: {
            type: String,
            enum: ['scheduled', 'huddle'],
            default: 'scheduled',
            index: true,
        },
        // Channel name / DM partner names when the record was made (display only).
        conversationName: { type: String, default: null },
        // The huddle id this meeting's call runs under: "meeting-<id>" for scheduled
        // meetings, the client's huddle uuid for ad-hoc huddles.
        huddleId: { type: String, default: null, index: true },
        video: { type: Boolean, default: false },
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
        
        // Everyone involved: invitees (scheduled) plus everyone who joined the call.
        participants: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            }
        ],

        // Who was invited when the meeting was scheduled (empty for ad-hoc huddles).
        invitees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

        // Who actually joined the call (first join wins), across every run of its huddle.
        attendees: [{
            _id: false,
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
            username: { type: String, default: '' },
            joinedAt: { type: Date, default: Date.now },
        }],

        // When the call first went live / last ended, and its length in seconds (endedAt - startedAt).
        startedAt: { type: Date, default: null },
        endedAt: { type: Date, default: null },
        durationSec: { type: Number, default: null },

        // Something worth keeping was added (notes, action items, summary, recording, transcript).
        // Short (< 1 min) ad-hoc huddles without content are hidden from "Past" by default.
        hasContent: { type: Boolean, default: false },
        // Set when transcript segments are added (lists do not load the segments).
        hasTranscript: { type: Boolean, default: false },

        // The meeting's notes: one Note (type 'meeting') for the meeting's whole life.
        noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
        
        status: {
            type: String,
            enum: ['scheduled', 'live', 'completed', 'cancelled'],
            default: 'scheduled',
        },

        

        recordingUrl: {
            type: String,
            default: null,
        },

        // Uploaded recording (object storage); recordingUrl then points at /api/v2/meetings/:id/recording.
        recording: { type: recordingSchema, default: null },

        // Speech-to-text segments sent by the clients during the call (see features/meetings/transcript.js).
        transcriptSegments: { type: [segmentSchema], default: [] },

        transcript: {
            type: String,
            default: '',
        },

        // Summary text (string for compatibility with older readers); who/when/how in summaryMeta.
        summary: {
            type: String,
            default: '',
        },
        summaryMeta: {
            generatedAt: { type: Date, default: null },
            by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
            source: { type: String, default: null }, // 'ai' | 'wrap-up' | 'manual'
            messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
            channelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
            dmId: { type: mongoose.Schema.Types.ObjectId, ref: 'DMSession', default: null },
        },

        // DEPRECATED (read-only): the old plain-text "Shared notes". Copied into the meeting's
        // Note the first time the note is opened; nothing writes it any more.
        sharedNotesMigratedAt: { type: Date, default: null },
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
                dueDate: { type: Date, default: null },
                // The id the huddle panel gave the item (huddle:notes_op action ops).
                clientId: { type: String, default: null },
                source: { type: String, default: 'manual' }, // 'manual' | 'ai' | 'huddle' | 'task'
                createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);

scheduledMeetingSchema.index({ companyId: 1, workspaceId: 1, startTime: 1, status: 1 });
scheduledMeetingSchema.index({ workspaceId: 1, startTime: 1, status: 1 });
scheduledMeetingSchema.index({ workspaceId: 1, status: 1, startTime: -1 });
scheduledMeetingSchema.index({ huddleId: 1, status: 1 });

module.exports = mongoose.model('ScheduledMeeting', scheduledMeetingSchema);
