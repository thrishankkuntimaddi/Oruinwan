import { useEffect, useMemo, useState } from 'react';
import { useCallCapture } from './CallCaptureContext';
import { captureApi, captureTarget, errorText } from './captureApi';

/**
 * The transcript of the call shown in the huddle workspace: live from the
 * capture provider while I'm in that call, otherwise loaded once for the run.
 */
export default function useCallTranscript(call, session, live) {
    const cap = useCallCapture();
    const isLiveHere = !!live && !!cap?.live && cap.huddleId === call?.id;
    const target = useMemo(() => {
        if (isLiveHere) return cap.target;
        return call?.id ? captureTarget(call.id, session?.id || null) : null;
    }, [isLiveHere, cap?.target, call?.id, session?.id]);

    const [past, setPast] = useState({ loading: false, segments: [], error: null });
    useEffect(() => {
        if (isLiveHere || !target) return undefined;
        let cancelled = false;
        setPast({ loading: true, segments: [], error: null });
        captureApi.transcript(target)
            .then((d) => { if (!cancelled) setPast({ loading: false, segments: d?.segments || [], error: null }); })
            .catch((err) => { if (!cancelled) setPast({ loading: false, segments: [], error: errorText(err, 'Could not load the transcript') }); });
        return () => { cancelled = true; };
    }, [isLiveHere, target]);

    return {
        cap,
        isLiveHere,
        target,
        segments: isLiveHere ? cap.segments : past.segments,
        loading: !isLiveHere && past.loading,
        error: isLiveHere ? cap.transcriptError : past.error,
    };
}
