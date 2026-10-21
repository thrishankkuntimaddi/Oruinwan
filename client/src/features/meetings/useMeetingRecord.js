import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { retainMeetingRoom, releaseMeetingRoom } from '../huddles/capture/meetingRoom';
import { meetingIdFromHuddleId } from '../huddles/HuddleContext';
import { meetingApi } from './meetingApi';
import { meetingErrorKind, errorText, patchMeeting, normaliseSummary } from './meetingModel';

const same = (a, b) => a != null && b != null && String(a) === String(b);

/**
 * One meeting record, live: loads GET /api/v2/meetings/:id, joins the
 * `meeting:<id>` socket room and keeps agenda, notes id, action items, summary,
 * recording and status current. Used by the meeting page and the in-call panel,
 * so both always show the same thing.
 */
export function useMeetingRecord(meetingId, { enabled = true } = {}) {
    const socket = useOptionalSocket()?.socket || null;
    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(!!meetingId && enabled);
    const [error, setError] = useState(null); // { kind: 'forbidden'|'not_found'|'error', message }
    const [roomJoined, setRoomJoined] = useState(false);
    const idRef = useRef(meetingId);
    idRef.current = meetingId;

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!meetingId || !enabled) return null;
        if (!quiet) setLoading(true);
        try {
            const m = await meetingApi.get(meetingId);
            if (same(idRef.current, meetingId)) { setMeeting(m); setError(null); }
            return m;
        } catch (err) {
            if (same(idRef.current, meetingId) && !quiet) {
                setError({ kind: meetingErrorKind(err), message: errorText(err, 'Could not load the meeting') });
            }
            return null;
        } finally {
            if (same(idRef.current, meetingId) && !quiet) setLoading(false);
        }
    }, [meetingId, enabled]);

    useEffect(() => {
        setMeeting(null);
        setError(null);
        setLoading(!!meetingId && enabled);
        load();
    }, [meetingId, enabled, load]);

    const patch = useCallback((p) => setMeeting((prev) => patchMeeting(prev, meetingId, p)), [meetingId]);

    // The meeting's socket room: live agenda, items, summary, transcript, brainstorm.
    useEffect(() => {
        if (!socket || !meetingId || !enabled) return undefined;
        let cancelled = false;
        setRoomJoined(false);
        const join = () => socket.emit('meeting:join', { meetingId }, (ack) => {
            if (cancelled) return;
            setRoomJoined(!!ack?.ok);
            if (ack?.ok && ack.noteId) patch({ noteId: String(ack.noteId) });
        });
        const mine = (p) => same(p?.meetingId, meetingId);
        const onDisconnect = () => setRoomJoined(false);
        const onAgenda = (p) => { if (mine(p)) patch({ agenda: p.agenda || [] }); };
        const onItems = (p) => { if (mine(p) && Array.isArray(p.actionItems)) patch({ actionItems: p.actionItems }); };
        const onSummary = (p) => { if (mine(p)) patch({ summary: p.summary ?? null }); };
        const onNote = (p) => { if (mine(p) && p.noteId) patch({ noteId: String(p.noteId) }); };
        const onRecording = (p) => { if (mine(p)) patch({ recording: p.recording || null, recordingUrl: p.recordingUrl || null, hasRecording: !!p.recording }); };
        const onRecordingGone = (p) => { if (mine(p)) patch({ recording: null, recordingUrl: null, hasRecording: false }); };
        const onSegments = (p) => { if (mine(p) && p.segments?.length) patch({ hasTranscript: true }); };
        const onEnded = (p) => {
            if (!mine(p)) return;
            patch({ status: 'completed', endedAt: p.endedAt || new Date().toISOString(), ...(Number.isFinite(p.durationSec) ? { durationSec: p.durationSec } : {}) });
            // Pick up what the server filled in at the end (attendees, duration).
            setTimeout(() => load({ quiet: true }), 600);
        };
        const onScheduleUpdated = ({ meeting: m } = {}) => {
            if (m && same(m.id || m._id, meetingId)) setMeeting((prev) => (prev ? { ...prev, ...m, createdBy: prev.createdBy, participants: prev.participants } : prev));
        };
        // A huddle for this meeting started: it is live now.
        const onHuddleStarted = (p = {}) => {
            if (same(p.meetingId, meetingId) || same(meetingIdFromHuddleId(p.huddleId), meetingId)) {
                setMeeting((prev) => (prev && prev.status !== 'live' ? { ...prev, status: 'live', startedAt: prev.startedAt || p.timestamp || new Date().toISOString(), endedAt: null } : prev));
            }
        };

        retainMeetingRoom(meetingId);
        if (socket.connected) join();
        const events = [
            ['connect', join], ['disconnect', onDisconnect],
            ['meeting:agenda_updated', onAgenda], ['meeting:action_items_updated', onItems],
            ['meeting:summary_updated', onSummary], ['meeting:note_ready', onNote],
            ['meeting:recording_ready', onRecording], ['meeting:recording_deleted', onRecordingGone],
            ['meeting:transcript_segments', onSegments], ['meeting:ended', onEnded],
            ['schedule:updated', onScheduleUpdated], ['huddle:started', onHuddleStarted],
        ];
        events.forEach(([e, fn]) => socket.on(e, fn));
        return () => {
            cancelled = true;
            events.forEach(([e, fn]) => socket.off(e, fn));
            // The call holding this meeting may still need the room.
            if (releaseMeetingRoom(meetingId)) setTimeout(() => socket.emit('meeting:leave', { meetingId }), 0);
        };
    }, [socket, meetingId, enabled, patch, load]);

    const actions = useMemo(() => {
        const withItems = (res) => { if (Array.isArray(res?.actionItems)) patch({ actionItems: res.actionItems }); return res; };
        return {
            reload: () => load({ quiet: true }),
            join: async () => { const m = await meetingApi.join(meetingId); if (m) setMeeting((prev) => ({ ...(prev || {}), ...m })); return m; },
            end: async () => { const m = await meetingApi.end(meetingId); if (m) setMeeting((prev) => ({ ...(prev || {}), ...m })); return m; },
            saveAgenda: async (agenda) => { const m = await meetingApi.saveAgenda(meetingId, agenda); if (m) patch({ agenda: m.agenda || [] }); return m; },
            ensureNote: async () => { const res = await meetingApi.ensureNote(meetingId); if (res?.noteId) patch({ noteId: String(res.noteId) }); return res; },
            addActionItem: async (body) => withItems(await meetingApi.addActionItem(meetingId, body)),
            updateActionItem: async (aid, p) => withItems(await meetingApi.updateActionItem(meetingId, aid, p)),
            toggleActionItem: async (aid) => withItems(await meetingApi.toggleActionItem(meetingId, aid)),
            convertActionItem: async (aid, body) => withItems(await meetingApi.convertActionItem(meetingId, aid, body)),
            deleteActionItem: async (aid) => withItems(await meetingApi.deleteActionItem(meetingId, aid)),
            extractActionItems: async () => {
                const res = await meetingApi.extractActionItems(meetingId, true);
                if (Array.isArray(res?.meeting?.actionItems)) patch({ actionItems: res.meeting.actionItems });
                return res;
            },
            summarize: async () => {
                const res = await meetingApi.summarize(meetingId);
                const summary = normaliseSummary(res?.meetingSummary ?? res?.summary);
                patch({ summary });
                return { ...res, summary };
            },
            saveSummary: async (text) => {
                const res = await meetingApi.saveSummary(meetingId, text);
                const summary = normaliseSummary(res?.summary ?? text);
                patch({ summary });
                return summary;
            },
            patch,
        };
    }, [meetingId, load, patch]);

    return { meeting, setMeeting, loading, error, roomJoined, ...actions };
}

/**
 * The meeting record of a call. Huddle payloads carry `meetingId`; a scheduled
 * meeting's huddle id is "meeting-<id>"; otherwise GET /by-huddle/:huddleId.
 */
export function useHuddleMeetingId(huddleId, hint) {
    const known = hint || meetingIdFromHuddleId(huddleId);
    const [resolved, setResolved] = useState({ huddleId: null, meetingId: null, failed: false });
    useEffect(() => {
        if (known || !huddleId) return undefined;
        let cancelled = false;
        let timer = null;
        const attempt = (n) => {
            meetingApi.byHuddle(huddleId)
                .then((m) => { if (!cancelled) setResolved({ huddleId, meetingId: m ? String(m.id || m._id) : null, failed: !m }); })
                .catch((err) => {
                    if (cancelled) return;
                    // The record is created as the huddle starts: ask again shortly.
                    if (n < 2 && meetingErrorKind(err) === 'not_found') { timer = setTimeout(() => attempt(n + 1), 1500); return; }
                    setResolved({ huddleId, meetingId: null, failed: true });
                });
        };
        attempt(0);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [huddleId, known]);
    if (known) return { meetingId: String(known), failed: false };
    if (resolved.huddleId !== huddleId) return { meetingId: null, failed: false };
    return { meetingId: resolved.meetingId, failed: resolved.failed };
}

export default useMeetingRecord;
