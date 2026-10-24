import { useState, useEffect, useCallback } from 'react';
import api from '@services/api';
import { useSocket } from '../contexts/SocketContext';
import logger from '../utils/logger';

export function useScheduledMeetings(workspaceId) {
    const { socket } = useSocket();
    const [meetings, setMeetings] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    
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
            logger.error('[useScheduledMeetings] fetch error:', err);
            setError('Failed to load scheduled meetings');
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        fetchMeetings();
    }, [fetchMeetings]);

    
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
                
                if (['cancelled', 'completed'].includes(meeting.status)) {
                    return prev.filter(m => m._id !== meeting._id);
                }
                return prev.map(m => m._id === meeting._id ? meeting : m);
            });
        };

        const onDeleted = ({ meetingId }) => {
            setMeetings(prev => prev.filter(m => m._id !== String(meetingId)));
        };

        // Clashes appeared or went away: re-read (the broadcasts hide clash titles; the list shows ours).
        let timer = null;
        const onConflicts = () => { clearTimeout(timer); timer = setTimeout(fetchMeetings, 300); };

        socket.on('schedule:created', onCreated);
        socket.on('schedule:updated', onUpdated);
        socket.on('schedule:deleted', onDeleted);
        socket.on('schedule:conflicts', onConflicts);

        return () => {
            clearTimeout(timer);
            socket.off('schedule:created', onCreated);
            socket.off('schedule:updated', onUpdated);
            socket.off('schedule:deleted', onDeleted);
            socket.off('schedule:conflicts', onConflicts);
        };
    }, [socket, workspaceId, fetchMeetings]);

    
    const createMeeting = useCallback(async (payload) => {
        const { data } = await api.post('/api/scheduled-meetings', {
            workspaceId,
            ...payload,
        });
        // The save-time clash re-check (it may have caught a booking made at the same moment).
        return { ...data.meeting, conflicts: data.conflicts || data.meeting?.conflicts || [] };
    }, [workspaceId]);

    /** Move / rename / re-prioritise: { startTime?, duration?, title?, priority? }. */
    const updateMeeting = useCallback(async (meetingId, patch) => {
        const { data } = await api.patch(`/api/scheduled-meetings/${meetingId}`, patch);
        return { ...data.meeting, conflicts: data.conflicts || data.meeting?.conflicts || [] };
    }, []);

    const cancelMeeting = useCallback(async (meetingId) => {
        const { data } = await api.patch(`/api/scheduled-meetings/${meetingId}`, {
            status: 'cancelled',
        });
        return data.meeting;
    }, []);

    return { meetings, loading, error, refresh: fetchMeetings, createMeeting, updateMeeting, cancelMeeting };
}
