import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@services/api';
import { useSocket } from '../contexts/SocketContext';

const API = '/api/v2/meetings';

export function useMeeting(meetingId, _workspaceId) {
    const { socket } = useSocket();
    const [meeting, setMeeting] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Socket room for this meeting (live agenda, brainstorm and notes updates).
    const [room, setRoom] = useState({ joined: false, notes: null, error: null });

    
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
        return data.meeting;
    }, [meetingId]);

    
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

    
    // Join the meeting's socket room while the page is open. The ack carries the
    // saved shared notes; we rejoin after a reconnect.
    useEffect(() => {
        if (!socket || !meetingId) return undefined;
        let cancelled = false;
        setRoom({ joined: false, notes: null, error: null });

        const join = () => {
            socket.emit('meeting:join', { meetingId }, (ack) => {
                if (cancelled) return;
                if (ack?.ok) setRoom({ joined: true, notes: typeof ack.notes === 'string' ? ack.notes : '', error: null });
                else setRoom({ joined: false, notes: null, error: ack?.message || 'Could not join the meeting room' });
            });
        };
        const onDisconnect = () => setRoom(prev => ({ ...prev, joined: false }));

        const onAgendaUpdated = (payload) => {
            if (String(payload?.meetingId) === String(meetingId)) {
                setMeeting(prev => prev ? { ...prev, agenda: payload.agenda } : prev);
            }
        };
        const onEnded = (payload) => {
            if (String(payload?.meetingId) === String(meetingId)) {
                setMeeting(prev => prev ? { ...prev, status: 'completed' } : prev);
            }
        };

        if (socket.connected) join();
        socket.on('connect', join);
        socket.on('disconnect', onDisconnect);
        socket.on('meeting:agenda_updated', onAgendaUpdated);
        socket.on('meeting:ended', onEnded);
        return () => {
            cancelled = true;
            socket.off('connect', join);
            socket.off('disconnect', onDisconnect);
            socket.off('meeting:agenda_updated', onAgendaUpdated);
            socket.off('meeting:ended', onEnded);
            // After child cleanups (e.g. a pending notes save) have been sent.
            setTimeout(() => socket.emit('meeting:leave', { meetingId }), 0);
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
        room,
        setMeeting };
}

/**
 * Shared notes for a meeting. Needs the meeting room joined (see useMeeting's
 * `room`); edits are saved on the server and pushed live to everyone else there.
 */
export function useSharedNotes(meetingId, { initialNotes = null, joined = false } = {}) {
    const { socket } = useSocket();
    const [notes, setNotes] = useState(initialNotes ?? '');
    const [status, setStatus] = useState({ state: 'idle', message: null }); // idle | saving | saved | error
    const debounceRef = useRef(null);
    const pendingRef = useRef(null);
    const dirtyRef = useRef(false);

    // The server copy arrives with the room join; don't overwrite unsent typing.
    useEffect(() => {
        if (initialNotes !== null && !dirtyRef.current) setNotes(initialNotes);
    }, [initialNotes]);

    useEffect(() => {
        if (!socket || !meetingId) return undefined;
        const onUpdate = (data) => {
            if (String(data?.meetingId) !== String(meetingId) || typeof data.notes !== 'string') return;
            if (pendingRef.current !== null) return; // my newer edit is about to be sent
            setNotes(data.notes);
        };
        socket.on('meeting:notes_update', onUpdate);
        return () => socket.off('meeting:notes_update', onUpdate);
    }, [socket, meetingId]);

    const send = useCallback((value) => {
        if (!socket) return;
        pendingRef.current = null;
        setStatus({ state: 'saving', message: null });
        socket.emit('meeting:notes_update', { meetingId, notes: value }, (ack) => {
            if (ack?.ok) {
                dirtyRef.current = pendingRef.current !== null;
                setStatus({ state: 'saved', message: null });
            } else {
                setStatus({ state: 'error', message: ack?.message || 'Could not save notes' });
            }
        });
    }, [socket, meetingId]);

    const handleNotesChange = useCallback((value) => {
        setNotes(value);
        dirtyRef.current = true;
        pendingRef.current = value;
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => send(value), 500);
    }, [send]);

    // Leaving the tab sends what is still waiting for the debounce.
    useEffect(() => () => {
        clearTimeout(debounceRef.current);
        if (pendingRef.current !== null && joined) send(pendingRef.current);
    }, [send, joined]);

    return { notes, handleNotesChange, status };
}
