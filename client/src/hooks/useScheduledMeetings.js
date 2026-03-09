/**
 * useScheduledMeetings.js
 *
 * Fetches upcoming scheduled meetings for the current workspace from the
 * REST API and subscribes to real-time socket events so the HomePanel
 * sidebar stays live without polling.
 *
 * Usage:
 *   const { meetings, loading, createMeeting, cancelMeeting } = useScheduledMeetings(workspaceId);
 */
import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';

export function useScheduledMeetings(workspaceId) {
    const { socket } = useSocket();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ── Fetch upcoming meetings from REST API ──────────────────────────
    const fetchMeetings = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        try {
            const { data } = await api.get('/api/scheduled-meetings', {
                params: { workspaceId, limit: 10 },
            });
            setMeetings(data.meetings || []);
            setError(null);
        } catch (err) {
            console.error('[useScheduledMeetings] fetch error:', err);
            setError('Failed to load scheduled meetings');
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchMeetings();
    }, [fetchMeetings]);

    // ── Real-time socket sync ──────────────────────────────────────────
    useEffect(() => {
        if (!socket) return;

        const onCreated = ({ meeting }) => {
            if (String(meeting.workspaceId) !== String(workspaceId)) return;
            setMeetings(prev => {
                const exists = prev.find(m => m._id === meeting._id);
                if (exists) return prev;
                return [...prev, meeting].sort(
                    (a, b) => new Date(a.startTime) - new Date(b.startTime)
                );
            });
        };

        const onUpdated = ({ meeting }) => {
            if (String(meeting.workspaceId) !== String(workspaceId)) return;
            setMeetings(prev => {
                // Remove if no longer upcoming (cancelled / completed)
                if (['cancelled', 'completed'].includes(meeting.status)) {
                    return prev.filter(m => m._id !== meeting._id);
                }
                return prev.map(m => m._id === meeting._id ? meeting : m);
            });
        };

        const onDeleted = ({ meetingId }) => {
            setMeetings(prev => prev.filter(m => m._id !== String(meetingId)));
        };

        socket.on('schedule:created', onCreated);
        socket.on('schedule:updated', onUpdated);
        socket.on('schedule:deleted', onDeleted);

        return () => {
            socket.off('schedule:created', onCreated);
            socket.off('schedule:updated', onUpdated);
            socket.off('schedule:deleted', onDeleted);
        };
    }, [socket, workspaceId]);

    // ── Mutations ──────────────────────────────────────────────────────
    const createMeeting = useCallback(async (payload) => {
        const { data } = await api.post('/api/scheduled-meetings', {
            workspaceId,
            ...payload,
        });
        return data.meeting;
    }, [workspaceId]);

    const cancelMeeting = useCallback(async (meetingId) => {
        const { data } = await api.patch(`/api/scheduled-meetings/${meetingId}`, {
            status: 'cancelled',
        });
        return data.meeting;
    }, []);

    return { meetings, loading, error, refresh: fetchMeetings, createMeeting, cancelMeeting };
}
