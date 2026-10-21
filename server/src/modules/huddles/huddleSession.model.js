'use strict';

const mongoose = require('mongoose');
const { recordingSchema } = require('../../features/meetings/recordings');
const { segmentSchema } = require('../../features/meetings/transcript');

/**
 * One run of a huddle, from the first join to the last leave. The live state
 * stays in the in-memory registry; this is the record for History, the shared
 * notes link and the wrap-up. A fixed huddle id (scheduled meetings) gets a new
 * session every time the call starts again.
 */
const participantSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, default: '' },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
}, { _id: false });

const huddleSessionSchema = new mongoose.Schema({
    huddleId: { type: String, required: true, index: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    scope: { type: String, enum: ['channel', 'dm', 'workspace'], required: true },
    channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
    dm: { type: mongoose.Schema.Types.ObjectId, ref: 'DMSession', default: null },
    channelName: { type: String, default: null },
    video: { type: Boolean, default: false },
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    startedByName: { type: String, default: '' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    participants: { type: [participantSchema], default: [] },

    // The call's meeting record (ScheduledMeeting): every run of a meeting's huddle and
    // every ad-hoc huddle has one. Notes, action items, summary, recording and transcript
    // of runs with a meeting live on the meeting, not here.
    meeting: { type: mongoose.Schema.Types.ObjectId, ref: 'ScheduledMeeting', default: null, index: true },

    // The shared Note everyone in the call edits (type 'meeting'). For runs with a meeting
    // this is the meeting's note (the same one for every run).
    notes: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
    // Existing tasks someone linked to this huddle from the Tasks tab.
    linkedTasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],

    // Uploaded call recording and speech-to-text segments (see features/meetings/recordings.js, transcript.js).
    recording: { type: recordingSchema, default: null },
    transcriptSegments: { type: [segmentSchema], default: [] },

    // "Post summary to channel": the (E2EE) message that was posted.
    summary: {
        message: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
        channel: { type: mongoose.Schema.Types.ObjectId, ref: 'Channel', default: null },
        dm: { type: mongoose.Schema.Types.ObjectId, ref: 'DMSession', default: null },
        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        postedAt: { type: Date, default: null },
    },
}, { timestamps: true });

huddleSessionSchema.index({ workspace: 1, startedAt: -1 });
huddleSessionSchema.index({ huddleId: 1, endedAt: 1 });
huddleSessionSchema.index({ 'participants.user': 1, startedAt: -1 });

module.exports = mongoose.models.HuddleSession || mongoose.model('HuddleSession', huddleSessionSchema);
