import { useEffect, useMemo, useState } from 'react';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { useCallCapture } from '../huddles/capture/CallCaptureContext';
import { captureApi, meetingTarget } from '../huddles/capture/captureApi';
import { mergeSegments } from '../huddles/capture/captions';
import { errorText } from './meetingModel';

/**
 * The meeting's transcript: live from the capture provider while I'm in this
 * meeting's call, otherwise GET /api/v2/meetings/:id/transcript kept current by
 * `meeting:transcript_segments`. Also says whether captions can be toggled here.
 */
export default function useMeetingTranscript(meeting) {
    const meetingId = meeting ? String(meeting.id || meeting._id) : null;
    const socket = useOptionalSocket()?.socket || null;
    const cap = useCallCapture();
    const liveHere = !!cap?.live && !!meeting?.huddleId && cap.huddleId === meeting.huddleId;
    const target = useMemo(() => (meetingId ? meetingTarget(meetingId) : null), [meetingId]);

    const [state, setState] = useState({ loading: !!meetingId, segments: [], text: '', error: null });
    useEffect(() => {
        if (!target) return undefined;
        let cancelled = false;
        setState({ loading: true, segments: [], text: '', error: null });
        captureApi.transcript(target)
            .then((d) => { if (!cancelled) setState({ loading: false, segments: d?.segments || [], text: d?.text || '', error: null }); })
            .catch((err) => { if (!cancelled) setState({ loading: false, segments: [], text: '', error: errorText(err, 'Could not load the transcript') }); });
        return () => { cancelled = true; };
    }, [target]);

    useEffect(() => {
        if (!socket || !meetingId) return undefined;
        const onSegments = (p = {}) => {
            if (String(p.meetingId) === meetingId && p.segments?.length) {
                setState((s) => ({ ...s, segments: mergeSegments(s.segments, p.segments) }));
            }
        };
        socket.on('meeting:transcript_segments', onSegments);
        return () => socket.off('meeting:transcript_segments', onSegments);
    }, [socket, meetingId]);

    const capSegments = liveHere ? cap.segments : null;
    const segments = useMemo(() => (capSegments?.length ? mergeSegments(state.segments, capSegments) : state.segments), [capSegments, state.segments]);
    return {
        cap: liveHere ? cap : null,
        liveHere,
        target,
        segments,
        legacyText: state.text,
        loading: state.loading,
        error: liveHere ? (cap.transcriptError || state.error) : state.error,
    };
}
