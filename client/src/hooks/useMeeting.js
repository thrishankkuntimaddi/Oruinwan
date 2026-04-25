import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@services/api';
import { useSocket } from '../contexts/SocketContext';

const API = '/api/v2/meetings';

export function useMeeting(meetingId, workspaceId) {
    const { socket } = useSocket();
    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    
    const fetchMeeting = useCallback(async () => {
        if (!meetingId) return;
        setLoading(true);
        try {
            const { data } = await api.get(`${API}/${meetingId}`);
            setMeeting(data.meeting);
        } catch (err) {
            setError(err?.response?.data?.message || 'Failed to load meeting');
        } finally {
            setLoading(false);
        }
    }, [meetingId]);

    useEffect(() => { fetchMeeting(); }, [fetchMeeting]);

    
    const joinMeeting = useCallback(async () => {
        const { data } = await api.post(`${API}/${meetingId}/join`, {});
        setMeeting(data.meeting);
        socket?.emit('meeting:join', { meetingId });
    }, [meetingId, socket]);

    
    const endMeeting = useCallback(async (recordingUrl) => {
        const { data } = await api.patch(
            `${API}/${meetingId}/end`,
            { recordingUrl }
        );
        setMeeting(data.meeting);
    }, [meetingId]);

    
    const updateAgenda = useCallback(async (agenda) => {
        const { data } = await api.patch(
            `${API}/${meetingId}/agenda`,
            { agenda }
        );
        setMeeting(data.meeting);
    }, [meetingId]);

    
    const updateTranscript = useCallback(async (transcript) => {
        const { data } = await api.patch(
            `${API}/${meetingId}/transcript`,
            { transcript }
        );
        setMeeting(data.meeting);
    }, [meetingId]);

    
    const generateSummary = useCallback(async () => {
        const { data } = await api.post(
            `${API}/${meetingId}/summarize`,
            {}
        );
        setMeeting(prev => prev ? { ...prev, summary: data.summary } : prev);
        return data.summary;
    }, [meetingId]);

    
    const addActionItem = useCallback(async ({ text, assignedTo, status }) => {
        const { data } = await api.post(
            `${API}/${meetingId}/action-items`,
            { text, assignedTo, status }
        );
        setMeeting(data.meeting);
    }, [meetingId]);

    const updateActionItem = useCallback(async (aid, updates) => {
        const { data } = await api.patch(
            `${API}/${meetingId}/action-items/${aid}`,
            updates
        );
        setMeeting(data.meeting);
    }, [meetingId]);

    
    const suggestTime = useCallback(async (participantIds = [], durationMinutes = 30) => {
        const { data } = await api.post(
            `${API}/suggest-time`,
            { participantIds, durationMinutes }
        );
        return data;
    }, []);

    
    useEffect(() => {
        if (!socket || !meetingId) return;

        const onAgendaUpdated = (payload) => {
            if (payload.meetingId === meetingId) {
                setMeeting(prev => prev ? { ...prev, agenda: payload.agenda } : prev);
            }
        };

        socket.on('meeting:agenda_updated', onAgendaUpdated);
        return () => {
            socket.off('meeting:agenda_updated', onAgendaUpdated);
        };
    }, [socket, meetingId]);

    return {
        meeting,
        loading,
        error,
        fetchMeeting,
        joinMeeting,
        endMeeting,
        updateAgenda,
        updateTranscript,
        generateSummary,
        addActionItem,
        updateActionItem,
        suggestTime,
        setMeeting };
}

export function useSharedNotes(meetingId, initialNotes = '') {
    const { socket } = useSocket();
    const [notes, setNotes] = useState(initialNotes);
    const debounceRef = useRef(null);

    
    useEffect(() => { setNotes(initialNotes); }, [initialNotes]);

    
    useEffect(() => {
        if (!socket || !meetingId) return;
        const onUpdate = (data) => {
            if (data.meetingId === meetingId) {
                setNotes(data.content);
            }
        };
        socket.on('meeting:notes_update', onUpdate);
        return () => socket.off('meeting:notes_update', onUpdate);
    }, [socket, meetingId]);

    const handleNotesChange = useCallback((value) => {
        setNotes(value);
        
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            socket?.emit('meeting:notes_update', { meetingId, content: value });
        }, 500);
    }, [socket, meetingId]);

    return { notes, handleNotesChange };
}
