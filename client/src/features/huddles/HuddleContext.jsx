import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useHuddle } from './useHuddle';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import logger from '../../utils/logger';
import api from '../../services/api';

export const HuddleContext = createContext(null);

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

/** How a call is named in the pill and the workspace panel. */
export function callTitle(call) {
    if (!call) return 'Huddle';
    if (call.channelName) return `# ${String(call.channelName).replace(/^#\s*/, '')}`;
    if (call.scope === 'dm' || call.dmId) return 'Direct message call';
    return call.title || 'Workspace huddle';
}

const sameScope = (a, b) => !!a && !!b && (
    (a.channelId && String(a.channelId) === String(b.channelId || ''))
    || (a.dmId && String(a.dmId) === String(b.dmId || ''))
);

/**
 * One call for the whole app. The app-wide provider (GlobalHuddleProvider) owns
 * the connection, so moving between pages keeps you in the huddle; a nested
 * <HuddleProvider> (the Huddles routes) just uses the outer one.
 */
export function HuddleProvider({ workspaceId, children }) {
    const outer = useContext(HuddleContext);
    if (outer) return children;
    return <HuddleProviderImpl workspaceId={workspaceId}>{children}</HuddleProviderImpl>;
}

function HuddleProviderImpl({ workspaceId, children }) {
    const { socket } = useSocket();
    const { user: currentUser } = useAuth();

    const huddle = useHuddle({
        workspaceId: workspaceId || null,
        currentUser,
        socket,
    });

    const [selectedHuddle, setSelectedHuddle] = useState(null);
    // Past huddles, from the server (survives reloads).
    const [huddleHistory, setHuddleHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Live huddles in this workspace. huddle:list covers workspace and channel
    // huddles (with participants); DM huddles only arrive as huddle:started.
    const [listedHuddles, setListedHuddles] = useState([]);
    const [dmHuddles, setDmHuddles] = useState([]);

    // Start/join progress for the "Connecting…" screen.
    const [connecting, setConnecting] = useState(null);     // { label } while waiting
    const [connectError, setConnectError] = useState(null); // { message, retry }

    // The huddle workspace panel (notes, tasks, chat, wrap-up) and the call it is
    // about: the live call, or the one that just ended while the panel was open.
    const [workspaceOpen, setWorkspaceOpen] = useState(false);
    const [workspaceTab, setWorkspaceTab] = useState('notes');
    const [panelCall, setPanelCall] = useState(null);
    // Call UIs rendered by a page (chat overlay, Huddles room): the floating pill hides for them.
    const [inlineUIs, setInlineUIs] = useState({});

    const huddleRef = useRef(huddle);
    huddleRef.current = huddle;
    const workspaceIdRef = useRef(workspaceId);
    workspaceIdRef.current = workspaceId;

    /** Run a start/join with a timeout; on failure leave a retryable error for the UI. */
    const runConnect = useCallback(async (label, fn, { quiet = false } = {}) => {
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
            // Conversation calls report their own errors (toast); the Huddles page shows this one.
            if (!quiet) {
                const retry = () => runConnect(label, fn).catch(() => {});
                setConnectError({ message: describeConnectError(err), retry });
            }
            throw err;
        } finally {
            clearTimeout(timer);
            setConnecting(null);
        }
    }, []);

    const dismissConnectError = useCallback(() => setConnectError(null), []);

    const selectCall = useCallback((id, info) => {
        const call = {
            id,
            title: info.title || 'Huddle',
            scope: info.channelId ? 'channel' : info.dmId ? 'dm' : 'workspace',
            channelId: info.channelId || null,
            dmId: info.dmId || null,
            channel: info.channelName || null,
            channelName: info.channelName || null,
            status: 'live',
            video: !!info.video,
            meetingId: meetingIdFromHuddleId(id),
            workspaceId: workspaceIdRef.current || null,
            startTime: info.startTime ? new Date(info.startTime) : new Date(),
            participants: [],
        };
        setSelectedHuddle(call);
        setPanelCall(call);
        return call;
    }, []);

    /**
     * Start a huddle (or, with opts.huddleId, start-or-join that fixed huddle).
     * opts.scope = { channelId } | { dmId } places it in a conversation.
     */
    const startAndSelect = useCallback((title = 'Huddle', opts = {}) => runConnect('Starting huddle', async () => {
        const h = huddleRef.current;
        if (h.active && opts.huddleId && h.huddleId === opts.huddleId) return h.huddleId;
        if (h.active) h.leaveHuddle();
        const scope = opts.scope && (opts.scope.channelId || opts.scope.dmId) ? opts.scope : null;
        const id = await h.startHuddle({ video: !!opts.video, huddleId: opts.huddleId, scope });
        if (id) selectCall(id, { title, video: opts.video, ...(scope || {}) });
        return id;
    }, { quiet: !!opts.quiet }), [runConnect, selectCall]);

    /** Join a live huddle: { id, title?, video?, channelId?, dmId?, channel? }. */
    const joinAndSelect = useCallback((huddleData, opts = {}) => runConnect('Joining huddle', async () => {
        const h = huddleRef.current;
        if (h.active && h.huddleId === huddleData.id) return huddleData.id;
        if (h.active) h.leaveHuddle();
        const scope = huddleData.channelId ? { channelId: huddleData.channelId } : huddleData.dmId ? { dmId: huddleData.dmId } : null;
        const id = await h.joinHuddle(huddleData.id, { video: !!huddleData.video, scope });
        if (id) {
            selectCall(id, {
                title: huddleData.title,
                video: huddleData.video,
                channelName: huddleData.channel || huddleData.channelName,
                startTime: huddleData.startTime,
                ...(scope || {}),
            });
        }
        return id;
    }, { quiet: !!opts.quiet }), [runConnect, selectCall]);

    const loadHistory = useCallback(async () => {
        const ws = workspaceIdRef.current;
        if (!ws) { setHuddleHistory([]); return; }
        setHistoryLoading(true);
        try {
            const { data } = await api.get('/api/v2/huddles/history', { params: { workspaceId: ws } });
            if (workspaceIdRef.current === ws) setHuddleHistory(data?.huddles || []);
        } catch (err) {
            logger.warn('[HuddleContext] could not load huddle history:', err?.message);
        } finally {
            setHistoryLoading(false);
        }
    }, []);
    const historyTimer = useRef(null);
    // The server closes the session right after the last person leaves; ask a moment later.
    const refreshHistorySoon = useCallback(() => {
        clearTimeout(historyTimer.current);
        historyTimer.current = setTimeout(loadHistory, 900);
    }, [loadHistory]);
    useEffect(() => () => clearTimeout(historyTimer.current), []);
    useEffect(() => { loadHistory(); }, [workspaceId, loadHistory]);

    const leaveAndDeselect = useCallback(() => {
        const h = huddleRef.current;
        if (h.active) {
            // The panel stays on the call that just ended, for the wrap-up.
            setPanelCall(prev => (prev && prev.id === h.huddleId ? { ...prev, status: 'ended', endTime: new Date() } : prev));
        }
        h.leaveHuddle();
        setSelectedHuddle(null);
        refreshHistorySoon();
    }, [refreshHistorySoon]);

    // Signing out ends the call (the provider outlives the pages, so nothing else would).
    const signedIn = !!currentUser;
    useEffect(() => {
        if (!signedIn && huddleRef.current.active) {
            huddleRef.current.leaveHuddle();
            setSelectedHuddle(null);
            setPanelCall(null);
            setWorkspaceOpen(false);
        }
    }, [signedIn]);

    // The huddle ended under us (server, kicked, other window): forget the selection.
    useEffect(() => {
        if (!huddle.active && !connecting) {
            setSelectedHuddle(prev => (prev?.status === 'live' ? null : prev));
            setPanelCall(prev => (prev?.status === 'live' ? { ...prev, status: 'ended', endTime: new Date() } : prev));
        }
    }, [huddle.active, connecting]);

    // Server facts about the live call (channel name, start time, notes id).
    const [session, setSession] = useState(null);
    const loadSession = useCallback(async (hid) => {
        if (!hid) return null;
        try {
            const { data } = await api.get(`/api/v2/huddles/${encodeURIComponent(hid)}/session`);
            const s = data?.session || null;
            if (s) setSession(s);
            if (s) {
                const patch = (c) => (c && c.id === s.huddleId ? {
                    ...c,
                    channelName: c.channelName || s.channelName,
                    channel: c.channel || s.channelName,
                    startTime: s.startedAt ? new Date(s.startedAt) : c.startTime,
                    workspaceId: c.workspaceId || s.workspaceId,
                } : c);
                setSelectedHuddle(patch);
                setPanelCall(patch);
            }
            return s;
        } catch (err) {
            logger.warn('[HuddleContext] could not load the huddle session:', err?.message);
            return null;
        }
    }, []);
    useEffect(() => {
        if (!huddle.active || !huddle.huddleId) return undefined;
        const t = setTimeout(() => loadSession(huddle.huddleId), 400);
        return () => clearTimeout(t);
    }, [huddle.active, huddle.huddleId, loadSession]);

    // Calls started from a conversation: remember the conversation on the panel call.
    useEffect(() => {
        const scope = huddle.callScope;
        if (!huddle.active || !huddle.huddleId || !scope) return;
        setPanelCall(prev => {
            if (prev && prev.id === huddle.huddleId) return prev;
            return {
                id: huddle.huddleId, title: 'Huddle', status: 'live',
                scope: scope.channelId ? 'channel' : scope.dmId ? 'dm' : 'workspace',
                channelId: scope.channelId || null, dmId: scope.dmId || null,
                workspaceId: workspaceIdRef.current || null, startTime: new Date(), participants: [],
            };
        });
    }, [huddle.active, huddle.huddleId, huddle.callScope]);

    const registerInlineUI = useCallback((hid) => {
        if (!hid) return () => {};
        setInlineUIs(prev => ({ ...prev, [hid]: (prev[hid] || 0) + 1 }));
        return () => setInlineUIs(prev => {
            const n = (prev[hid] || 0) - 1;
            const next = { ...prev };
            if (n > 0) next[hid] = n; else delete next[hid];
            return next;
        });
    }, []);

    const openWorkspace = useCallback((tab) => {
        if (tab) setWorkspaceTab(tab);
        setWorkspaceOpen(true);
    }, []);
    const closeWorkspace = useCallback(() => {
        setWorkspaceOpen(false);
        // A finished call is forgotten once its panel is closed.
        setPanelCall(prev => (prev?.status === 'live' ? prev : null));
    }, []);

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
            refreshHistorySoon();
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
    }, [socket, workspaceId, refreshHistorySoon]);

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
        callScope: huddle.callScope,
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
        historyLoading,
        refreshHistory: loadHistory,
        activeWorkspaceHuddles,

        workspaceId: workspaceId || null,
        session: session && session.huddleId === (panelCall?.id || huddle.huddleId) ? session : null,
        reloadSession: loadSession,
        panelCall,
        workspaceOpen,
        workspaceTab,
        setWorkspaceTab,
        openWorkspace,
        closeWorkspace,
        inlineUIs,
        registerInlineUI,
        isCallIn: (scope) => huddle.active && sameScope(huddle.callScope, scope),
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
