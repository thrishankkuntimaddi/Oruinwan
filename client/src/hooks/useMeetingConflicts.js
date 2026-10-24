import { useEffect, useRef, useState } from 'react';
import api from '@services/api';

/** POST /api/v2/meetings/conflicts: who is busy at this time, and free slots (utils/meetingConflicts). */
export async function checkMeetingConflicts(body) {
    const { data } = await api.post('/api/v2/meetings/conflicts', body);
    return data;
}

/**
 * Asks the server about clashes as the time and people change (debounced; stale answers are
 * dropped). `query` is { workspaceId, startTime (ISO), duration, participants, channelId?,
 * dmSessionId?, excludeMeetingId? } or null to stop. Returns { result, loading, error }.
 * The check is advisory: a failure never blocks scheduling.
 */
export default function useMeetingConflicts(query, { delay = 400, check = checkMeetingConflicts } = {}) {
    const [state, setState] = useState({ result: null, loading: false, error: null });
    const seq = useRef(0);
    const key = query && query.workspaceId && query.startTime ? JSON.stringify(query) : '';

    useEffect(() => {
        const mine = ++seq.current;
        if (!key) {
            setState({ result: null, loading: false, error: null });
            return undefined;
        }
        setState((s) => ({ ...s, loading: true, error: null }));
        const timer = setTimeout(async () => {
            try {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const result = await check({ ...JSON.parse(key), timezone: tz });
                if (mine === seq.current) setState({ result, loading: false, error: null });
            } catch (err) {
                if (mine === seq.current) setState({ result: null, loading: false, error: err?.response?.data?.message || 'Could not check calendars' });
            }
        }, delay);
        return () => clearTimeout(timer);
    }, [key, delay, check]);

    return state;
}
