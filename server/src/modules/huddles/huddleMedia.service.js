'use strict';

/**
 * Huddle recordings, transcript segments, transcript-based summary/action items and
 * the "meeting.completed" event for huddles. A huddle id can run many times; each
 * run is a HuddleSession and these attach to the running run, else the latest one.
 */

const logger = require('../../../utils/logger');
const { isValidId, HttpError } = require('../../shared/utils/workspaceAccess');
const history = require('./huddleHistory.service');
const notes = require('./huddleNotes');
const recordings = require('../../features/meetings/recordings');
const transcript = require('../../features/meetings/transcript');

const lazy = {
    Session: () => require('./huddleSession.model'),
    Note: () => require('../../../models/Note'),
    summarizer: () => require('../../features/ai/ai.summarizer.service'),
    meetings: () => require('../../features/meetings/meetings.service'),
    emitter: () => require('../notifications/notificationEventEmitter'),
};

const idOf = (v) => String(v?._id || v || '');

/** A specific run (sessionId, must belong to huddleId) or the running/latest run, access-checked. */
async function loadSession(userId, huddleId, sessionId) {
    if (!sessionId) return history.loadAccessible(userId, huddleId);
    if (!isValidId(sessionId)) throw new HttpError(400, 'Invalid session id');
    const session = await lazy.Session().findOne({ _id: sessionId, huddleId });
    if (!session) throw new HttpError(404, 'Huddle not found');
    if (!(await history.canView(session, userId))) throw new HttpError(403, 'You do not have access to this huddle');
    return session;
}

// ── Recording ───────────────────────────────────────────────────────────────

async function uploadRecording({ userId, huddleId, file, durationSec, sessionId, io }) {
    if (!file) throw new HttpError(400, 'Attach the recording as the "file" field');
    const duration = recordings.parseDuration(durationSec);
    if (duration.error) throw new HttpError(400, duration.error);
    const session = await loadSession(userId, huddleId, sessionId);
    history.assertMember(session, userId);
    if (!session.workspace) throw new HttpError(400, 'Recordings need a workspace');

    const doc = await recordings.storeRecording(file, {
        workspaceId: idOf(session.workspace),
        ownerKey: `huddle-${idOf(session._id)}`,
        userId,
        durationSec: duration.value,
    });
    const before = await lazy.Session().findOneAndUpdate({ _id: session._id }, { $set: { recording: doc } }, { new: false }).lean();
    if (before?.recording?.path && before.recording.path !== doc.path) {
        recordings.deleteRecordingObject(before.recording.path).catch((err) => logger.warn(`[huddles] old recording not deleted: ${err.message}`));
    }
    const recording = recordings.describeRecording(doc);
    if (io) io.to(`huddle:${huddleId}`).emit('huddle:recording_ready', { huddleId, sessionId: idOf(session._id), recording });
    return { sessionId: idOf(session._id), recording };
}

async function getRecording({ userId, huddleId, sessionId }) {
    const session = await loadSession(userId, huddleId, sessionId);
    if (!session.recording?.path) throw new HttpError(404, 'This huddle has no recording');
    const signed = recordings.signedRecordingUrl(
        `/api/v2/huddles/${encodeURIComponent(huddleId)}/recording/stream`, session.recording, userId, `s=${idOf(session._id)}`,
    );
    return { sessionId: idOf(session._id), recording: recordings.describeRecording(session.recording), ...signed };
}

/** Signed stream: resolves the recording and the signing user (or throws). */
async function resolveSignedStream({ huddleId, query }) {
    if (!isValidId(query?.s)) throw new HttpError(400, 'Invalid link');
    const session = await lazy.Session().findOne({ _id: query.s, huddleId });
    const userId = recordings.verifyRecordingSignature(session?.recording, query);
    if (!userId) throw new HttpError(403, 'Invalid or expired link');
    if (!(await history.canView(session, userId))) throw new HttpError(403, 'Access denied');
    return session.recording;
}

async function deleteRecording({ userId, huddleId, sessionId, io }) {
    const session = await loadSession(userId, huddleId, sessionId);
    if (!session.recording?.path) throw new HttpError(404, 'This huddle has no recording');
    const mayDelete = idOf(session.recording.uploadedBy) === String(userId) || idOf(session.startedBy) === String(userId)
        || (session.workspace && (await require('../../shared/utils/workspaceAccess').getWorkspaceMembership(idOf(session.workspace), userId))?.isAdmin);
    if (!mayDelete) throw new HttpError(403, 'Only the uploader, the person who started the huddle or a workspace admin can delete the recording');
    const before = await lazy.Session().findOneAndUpdate({ _id: session._id }, { $set: { recording: null } }, { new: false }).lean();
    if (before?.recording?.path) await recordings.deleteRecordingObject(before.recording.path);
    if (io) io.to(`huddle:${huddleId}`).emit('huddle:recording_deleted', { huddleId, sessionId: idOf(session._id) });
    return { message: 'Recording deleted' };
}

// ── Transcript ──────────────────────────────────────────────────────────────

async function appendTranscript({ userId, huddleId, body, io }) {
    const { segments, error } = transcript.validateSegments(body, { addedBy: userId });
    if (error) throw new HttpError(400, error);
    const session = await history.loadAccessible(userId, huddleId);
    history.assertMember(session, userId);
    const res = await lazy.Session().updateOne(
        { _id: session._id, $expr: { $lte: [{ $size: { $ifNull: ['$transcriptSegments', []] } }, transcript.MAX_SEGMENTS_TOTAL - segments.length] } },
        { $push: { transcriptSegments: { $each: segments } } },
    );
    if (!res.matchedCount) throw new HttpError(409, `This transcript is full (${transcript.MAX_SEGMENTS_TOTAL} segments)`);
    if (io) {
        io.to(`huddle:${huddleId}`).emit('huddle:transcript_segments', {
            huddleId, sessionId: idOf(session._id), segments: segments.map(({ addedBy: _addedBy, ...s }) => s),
        });
    }
    return { sessionId: idOf(session._id), added: segments.length };
}

async function getTranscript({ userId, huddleId, sessionId }) {
    const session = await loadSession(userId, huddleId, sessionId);
    const segments = transcript.sortSegments(session.transcriptSegments || []);
    const names = await lazy.meetings().speakerNames(segments);
    return {
        huddleId,
        sessionId: idOf(session._id),
        segments: segments.map((s) => ({
            speakerId: s.speakerId ? idOf(s.speakerId) : null,
            speakerName: names.get(idOf(s.speakerId)) || s.speakerName || '',
            text: s.text,
            startedAt: s.startedAt,
            endedAt: s.endedAt,
        })),
        text: transcript.renderTranscript(segments, { origin: session.startedAt, names }),
    };
}

const stripHtml = (html) => String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').trim();

/** Plain text of the huddle notes (text and heading blocks), for when there is no transcript. */
async function notesText(session) {
    if (!session.notes) return '';
    const note = await lazy.Note().findById(session.notes).select('content').lean();
    if (!note) return '';
    return notes.parseBlocks(note.content)
        .filter((b) => b.type === 'text' || b.type === 'heading')
        .map((b) => stripHtml(b.content))
        .filter(Boolean)
        .join('\n');
}

/**
 * Draft wrap-up for the client: summary + action items from the transcript when there is one,
 * else from the shared notes. The client posts the wrap-up itself (E2EE) and then calls /wrap-up.
 */
async function summarize({ userId, huddleId, sessionId }) {
    const session = await loadSession(userId, huddleId, sessionId);
    const segments = session.transcriptSegments || [];
    let source = 'transcript';
    let text;
    let actionSource = segments;
    if (segments.length) {
        const names = await lazy.meetings().speakerNames(segments);
        text = transcript.renderTranscript(segments, { origin: session.startedAt, names });
    } else {
        text = await notesText(session);
        source = text ? 'notes' : 'none';
        actionSource = text.split('\n').map((t) => ({ text: t, startedAt: session.startedAt, speakerId: null }));
    }
    const title = session.channelName ? `Huddle in #${session.channelName}` : 'Huddle';
    const { summary, fallback } = text
        ? await lazy.summarizer().summarizeDocument(text, { title, type: 'meeting', noCache: true, context: { userId: String(userId) } })
        : { summary: '', fallback: true };
    return {
        huddleId,
        sessionId: idOf(session._id),
        source,
        summary,
        aiFallback: !!fallback,
        actionItems: transcript.extractActionItems(actionSource),
    };
}

// ── Completion event ────────────────────────────────────────────────────────

/**
 * Emit "meeting.completed" (kind 'huddle') once a huddle run is over. Huddles that held a
 * scheduled meeting are reported as that meeting instead (meetings.service), so automations
 * do not fire twice. Metadata only.
 */
async function emitHuddleCompleted(huddle, io, { completedMeetingIds = [] } = {}) {
    if (!huddle?.workspaceId || completedMeetingIds.length) return null;
    if (String(huddle.huddleId || '').startsWith('meeting-')) return null;
    await history.recorder.whenIdle(huddle.huddleId);
    const session = await lazy.Session().findOne({ huddleId: huddle.huddleId }).sort({ startedAt: -1 })
        .select('startedAt endedAt participants notes channel dm transcriptSegments recording.path').lean();
    let actionItemCount = 0;
    if (session?.notes) {
        try {
            const note = await lazy.Note().findById(session.notes).select('content').lean();
            actionItemCount = note ? notes.actionItems(note.content).length : 0;
        } catch { /* best-effort */ }
    }
    const start = new Date(session?.startedAt || huddle.startedAt || Date.now()).getTime();
    const end = new Date(session?.endedAt || Date.now()).getTime();
    const payload = {
        io,
        kind: 'huddle',
        workspaceId: String(huddle.workspaceId),
        meetingId: session ? idOf(session._id) : null,
        huddleId: huddle.huddleId,
        title: huddle.channelName ? `Huddle in #${huddle.channelName}` : 'Huddle',
        durationMinutes: Math.max(0, Math.round((end - start) / 60000)),
        participantCount: new Set((session?.participants || []).map((p) => idOf(p.user))).size,
        actionItemCount,
        hasTranscript: !!(session?.transcriptSegments || []).length,
        hasRecording: !!session?.recording?.path,
        channelId: huddle.channelId || null,
        dmId: huddle.dmId || null,
    };
    lazy.emitter().emit('meeting.completed', payload);
    return payload;
}

module.exports = {
    uploadRecording,
    getRecording,
    resolveSignedStream,
    deleteRecording,
    appendTranscript,
    getTranscript,
    summarize,
    emitHuddleCompleted,
    _lazy: lazy,
};
