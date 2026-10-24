import { useCallback, useEffect, useRef, useState } from 'react';
import { useOptionalSocket } from '../../contexts/SocketContext';
import { meetingApi } from './meetingApi';
import { errorText, meetingIdOf } from './meetingModel';

/** Append a page, without duplicates (a meeting can move between pages while paging). */
export function mergePage(prev, next) {
    const seen = new Set(prev.map(meetingIdOf));
    return [...prev, ...next.filter((m) => { const id = meetingIdOf(m); if (seen.has(id)) return false; seen.add(id); return true; })];
}

/**
 * One Huddles list: GET /api/v2/meetings?status=upcoming|live|past with search
 * and paging (nextBefore / nextAfter). Scheduled meetings and quick huddles
 * together. Reloads when meetings are scheduled, start or end.
 */
export default function useMeetingList({ workspaceId, status, q = '', limit = 20, enabled = true }) {
    const socket = useOptionalSocket()?.socket || null;
    const [state, setState] = useState({ items: [], loading: false, error: null, hasMore: false, cursor: null, loadingMore: false });
    const reqRef = useRef(0);
    const query = q.trim();

    const load = useCallback(async ({ quiet = false } = {}) => {
        if (!workspaceId || !status || !enabled) return;
        const req = ++reqRef.current;
        if (!quiet) setState((s) => ({ ...s, loading: true, error: null }));
        try {
            const data = await meetingApi.list({ workspaceId, status, q: query, limit });
            if (req !== reqRef.current) return;
            setState({ items: data?.meetings || [], loading: false, error: null, hasMore: !!data?.hasMore, cursor: data?.nextBefore || data?.nextAfter || null, loadingMore: false });
        } catch (err) {
            if (req !== reqRef.current) return;
            setState((s) => ({ ...s, loading: false, loadingMore: false, error: errorText(err, 'Could not load meetings') }));
        }
    }, [workspaceId, status, query, limit, enabled]);

    // Search waits for typing to pause.
    useEffect(() => {
        const t = setTimeout(() => load(), query ? 250 : 0);
        return () => clearTimeout(t);
    }, [load, query]);

    const loadMore = useCallback(async () => {
        if (!state.hasMore || !state.cursor || state.loadingMore) return;
        const req = reqRef.current;
        setState((s) => ({ ...s, loadingMore: true }));
        try {
            const data = await meetingApi.list({
                workspaceId, status, q: query, limit,
                ...(status === 'upcoming' ? { after: state.cursor } : { before: state.cursor }),
            });
            if (req !== reqRef.current) return;
            setState((s) => ({ ...s, items: mergePage(s.items, data?.meetings || []), hasMore: !!data?.hasMore, cursor: data?.nextBefore || data?.nextAfter || null, loadingMore: false }));
        } catch (err) {
            setState((s) => ({ ...s, loadingMore: false, error: errorText(err, 'Could not load more') }));
        }
    }, [state.hasMore, state.cursor, state.loadingMore, workspaceId, status, query, limit]);

    // Keep it current: scheduled, cancelled, started, ended.
    useEffect(() => {
        if (!socket || !enabled) return undefined;
        let t = null;
        const soon = () => { clearTimeout(t); t = setTimeout(() => load({ quiet: true }), 800); };
        const events = ['schedule:created', 'schedule:updated', 'schedule:deleted', 'schedule:conflicts', 'meeting:ended', 'huddle:started', 'huddle:ended'];
        events.forEach((e) => socket.on(e, soon));
        return () => { clearTimeout(t); events.forEach((e) => socket.off(e, soon)); };
    }, [socket, enabled, load]);

    return { ...state, loadMore, reload: () => load({ quiet: true }) };
}
