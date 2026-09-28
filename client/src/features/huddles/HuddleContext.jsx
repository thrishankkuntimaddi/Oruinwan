import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useHuddle } from './useHuddle';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import logger from '../../utils/logger';

const HuddleContext = createContext(null);

/** How long "Connecting…" may take before we show an error with Retry. */
export const CONNECT_TIMEOUT_MS = 15000;

/** Scheduled meetings get one workspace huddle each, so everyone joining it meets in the same call. */
export const meetingHuddleId = (meetingId) => `meeting-${meetingId}`;
export const meetingIdFromHuddleId = (huddleId) =>
    (typeof huddleId === 'string' && huddleId.startsWith('meeting-') ? huddleId.slice('meeting-'.length) : null);

const idOf = (v) => (v && typeof v === 'object' ? (v._id || v.id) : v) || null;

/**
 * Where a scheduled meeting's call happens: the meeting's channel or DM when it
 * was scheduled from a conversation, otherwise null (a workspace huddle on the Huddles page).
 */
export function meetingConversationPath(workspaceId, meeting) {
    const channelId = idOf(meeting?.channelId);
    if (channelId) return `/workspace/${workspaceId}/channel/${channelId}`;
    const dmId = idOf(meeting?.dmSessionId);
    if (dmId) return `/workspace/${workspaceId}/dm/${dmId}`;
    return null;
}

/** A live huddle as the Huddles page lists it. */
function toEntry(h) {
    const scope = h.channelId ? 'channel' : h.dmId ? 'dm' : 'workspace';
    let title;
    if (scope === 'channel') title = `# ${h.channelName || 'channel'}`;
    else if (scope === 'dm') title = `Direct message with ${h.startedBy?.username || 'someone'}`;
    else if (meetingIdFromHuddleId(h.huddleId)) title = 'Meeting huddle';
    else title = 'Workspace huddle';
    return {
        id: h.huddleId,
        scope,
        channelId: h.channelId || null,
        dmId: h.dmId || null,
        channel: h.channelName || null,
        title,
        status: 'live',
        video: !!h.video,
        startedBy: h.startedBy || null,
        startTime: h.startedAt ? new Date(h.startedAt) : new Date(),
        participants: h.participants || [],
    };
}

function describeConnectError(err) {
    if (err?.message === 'TIMEOUT') {
        return 'Could not connect within 15 seconds. Check that the browser may use your microphone and that you are online.';
    }
    if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        return 'Microphone access is blocked. Allow it in the browser address bar, then try again.';
    }
    if (err?.name === 'NotFoundError') return 'No microphone was found. Connect one and try again.';
    if (err?.name === 'NotReadableError') return 'Your microphone is in use by another app.';
    return err?.response?.data?.message || err?.message || 'Could not connect to the huddle.';
}

export function HuddleProvider({ workspaceId, children }) {
    const { socket } = useSocket();
    const { user: currentUser } = useAuth();

    const huddle = useHuddle({
        workspaceId: workspaceId || null,
        currentUser,
        socket,
    });

    const [selectedHuddle, setSelectedHuddle] = useState(null);
    const [huddleHistory, setHuddleHistory] = useState([]);

    // Live huddles in this workspace. huddle:list covers workspace and channel
    // huddles (with participants); DM huddles only arrive as huddle:started.
    const [listedHuddles, setListedHuddles] = useState([]);
    const [dmHuddles, setDmHuddles] = useState([]);

    // Start/join progress for the "Connecting…" screen.
    const [connecting, setConnecting] = useState(null);     // { label } while waiting
    const [connectError, setConnectError] = useState(null); // { message, retry }

    const huddleRef = useRef(huddle);
    huddleRef.current = huddle;

    /** Run a start/join with a timeout; on failure leave a retryable error for the UI. */
    const runConnect = useCallback(async (label, fn) => {
        setConnectError(null);
        setConnecting({ label });
        let timer;
        const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('TIMEOUT')), CONNECT_TIMEOUT_MS); });
        try {
            return await Promise.race([fn(), timeout]);
        } catch (err) {
            // Cancels a getUserMedia that is still pending so it cannot start a call later.
            if (err?.message === 'TIMEOUT') huddleRef.current.leaveHuddle();
            logger.error('[HuddleContext] connect failed:', err);
            const retry = () => runConnect(label, fn).catch(() => {});
            setConnectError({ message: describeConnectError(err), retry });
            throw err;
        } finally {
            clearTimeout(timer);
            setConnecting(null);
        }
    }, []);

    const dismissConnectError = useCallback(() => setConnectError(null), []);

    /** Start a huddle (or, with opts.huddleId, start-or-join that fixed huddle). */
    const startAndSelect = useCallback((title = 'Huddle', opts = {}) => runConnect('Starting huddle', async () => {
        const h = huddleRef.current;
        if (h.active && opts.huddleId && h.huddleId === opts.huddleId) return h.huddleId;
        if (h.active) h.leaveHuddle();
        const id = await h.startHuddle({ video: !!opts.video, huddleId: opts.huddleId });
        if (id) {
            setSelectedHuddle({
                id,
                title,
                scope: 'workspace',
                channel: null,
                status: 'live',
                video: !!opts.video,
                meetingId: meetingIdFromHuddleId(id),
                startTime: new Date(),
                participants: [],
            });
        }
        return id;
    }), [runConnect]);

    /** Join a live workspace huddle from the list. */
    const joinAndSelect = useCallback((huddleData) => runConnect('Joining huddle', async () => {
        const h = huddleRef.current;
        if (h.active && h.huddleId === huddleData.id) return huddleData.id;
        if (h.active) h.leaveHuddle();
        const id = await h.joinHuddle(huddleData.id, { video: !!huddleData.video });
        if (id) setSelectedHuddle({ ...huddleData, status: 'live' });
        return id;
    }), [runConnect]);

    const leaveAndDeselect = useCallback(() => {
        const h = huddleRef.current;
        if (h.active) {
            setHuddleHistory(prev => [{
                ...(selectedHuddle || { title: 'Huddle' }),
                id: h.huddleId,
                status: 'past',
                endTime: new Date(),
                participantCount: h.participants.length,
                participants: h.participants.filter(p => !p.isLocal),
            }, ...prev].slice(0, 20));
        }
        h.leaveHuddle();
        setSelectedHuddle(null);
    }, [selectedHuddle]);

    // The huddle ended under us (server, kicked, other window): forget the selection.
    useEffect(() => {
        if (!huddle.active && !connecting) setSelectedHuddle(prev => (prev?.status === 'live' ? null : prev));
    }, [huddle.active, connecting]);

    useEffect(() => {
        if (!socket || !workspaceId) return undefined;
        const inWorkspace = (p) => String(p?.workspaceId || '') === String(workspaceId);
        let timer = null;

        const loadActive = () => {
            socket.emit('huddle:list', { workspaceId }, (res) => {
                setListedHuddles((res?.huddles || []).filter(h => !h.dmId).map(toEntry));
            });
        };
        // Participant changes come in bursts (join + roster); refresh once.
        const reload = () => {
            clearTimeout(timer);
            timer = setTimeout(loadActive, 150);
        };

        const onStarted = (payload) => {
            if (!payload?.huddleId || !inWorkspace(payload)) return;
            if (payload.scope === 'dm' || payload.dmId) {
                setDmHuddles(prev => (prev.some(h => h.id === payload.huddleId) ? prev : [
                    ...prev,
                    toEntry({ ...payload, startedAt: payload.timestamp, participants: [] }),
                ]));
                return;
            }
            reload();
        };

        const onEnded = ({ huddleId } = {}) => {
            if (!huddleId) return;
            setListedHuddles(prev => prev.filter(h => h.id !== huddleId));
            setDmHuddles(prev => prev.filter(h => h.id !== huddleId));
        };

        const onParticipantsChanged = ({ huddleId } = {}) => {
            if (huddleId) reload();
        };

        socket.on('huddle:started', onStarted);
        socket.on('huddle:ended', onEnded);
        socket.on('huddle:participant_joined', onParticipantsChanged);
        socket.on('huddle:participant_left', onParticipantsChanged);
        socket.on('connect', loadActive);
        if (socket.connected) loadActive();

        return () => {
            clearTimeout(timer);
            socket.off('huddle:started', onStarted);
            socket.off('huddle:ended', onEnded);
            socket.off('huddle:participant_joined', onParticipantsChanged);
            socket.off('huddle:participant_left', onParticipantsChanged);
            socket.off('connect', loadActive);
        };
    }, [socket, workspaceId]);

    // Everything live except the huddle I'm in (that one is shown as "Your huddle").
    const activeWorkspaceHuddles = useMemo(() => {
        const seen = new Set();
        return [...listedHuddles, ...dmHuddles].filter(h => {
            if (seen.has(h.id) || h.id === huddle.huddleId) return false;
            seen.add(h.id);
            return true;
        });
    }, [listedHuddles, dmHuddles, huddle.huddleId]);

    const value = {
        active: huddle.active,
        huddleId: huddle.huddleId,
        participants: huddle.participants,
        muted: huddle.muted,
        isVideo: huddle.isVideo,
        cameraOn: huddle.cameraOn,
        localStream: huddle.localStream,
        remoteStreams: huddle.remoteStreams,
        screenStream: huddle.screenStream,
        peerStates: huddle.peerStates,
        huddleAnnouncement: huddle.huddleAnnouncement,
        dismissAnnouncement: huddle.dismissAnnouncement,

        startHuddle: startAndSelect,
        joinHuddle: joinAndSelect,
        leaveHuddle: leaveAndDeselect,
        toggleMute: huddle.toggleMute,
        toggleCamera: huddle.toggleCamera,
        startScreenShare: huddle.startScreenShare,
        stopScreenShare: huddle.stopScreenShare,

        connecting,
        connectError,
        dismissConnectError,

        selectedHuddle,
        setSelectedHuddle,

        huddleHistory,
        activeWorkspaceHuddles,
    };

    return (
        <HuddleContext.Provider value={value}>
            {children}
        </HuddleContext.Provider>
    );
}

export function useHuddleContext() {
    const ctx = useContext(HuddleContext);
    if (!ctx) throw new Error('useHuddleContext must be used inside <HuddleProvider>');
    return ctx;
}
