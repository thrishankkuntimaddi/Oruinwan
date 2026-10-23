import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useHuddle } from './useHuddle';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
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
        meetingId: h.meetingId ? String(h.meetingId) : meetingIdFromHuddleId(h.huddleId),
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
    if (call.scope === 'dm' || call.dmId) return call.title && call.title !== 'Huddle' ? call.title : 'Direct message call';
    return call.title || 'Workspace huddle';
}

/**
 * Should starting/joining `targetId` ask first? One call per person:
 *  - in another call on this device, or on another device → { kind: 'switch' }
 *  - in this very call on another device → { kind: 'move' }
 * `local` is this device's call ({ huddleId, title } | null); `elsewhere` is my call on
 * another device (huddle:self_active) or null.
 */
export function callConflict(targetId, { local = null, elsewhere = null } = {}) {
    if (local?.huddleId) {
        return local.huddleId === targetId ? null : { kind: 'switch', current: { ...local, here: true } };
    }
    if (elsewhere?.huddleId) {
        return { kind: elsewhere.huddleId === targetId ? 'move' : 'switch', current: elsewhere };
    }
    return null;
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
    const { showToast } = useToast();

    // "You're already in a call" questions: { kind: 'switch' | 'move', current, run(extraOpts) }.
    const [conflict, setConflict] = useState(null);
    // The last start/join the person asked for, to retry it after a server-side conflict.
    const pendingActionRef = useRef(null);
    const onConflict = useCallback((err) => {
        const run = pendingActionRef.current;
        if (!run) return;
        setConflict({ kind: err.sameCall ? 'move' : 'switch', current: err.current || null, run });
    }, []);

    const huddle = useHuddle({
        workspaceId: workspaceId || null,
        currentUser,
        socket,
        onConflict,
    });

    // My call on any device (huddle:self_active / huddle:mine), so another device can offer "Move here".
    const [selfActive, setSelfActive] = useState(null);
    const selfActiveRef = useRef(null);
    selfActiveRef.current = selfActive;
    useEffect(() => {
        if (!socket) return undefined;
        const onSelf = (payload) => setSelfActive(payload?.huddleId ? payload : null);
        const ask = () => socket.emit('huddle:mine', {}, (res) => setSelfActive(res?.active?.huddleId ? res.active : null));
        socket.on('huddle:self_active', onSelf);
        socket.on('connect', ask);
        if (socket.connected) ask();
        return () => {
            socket.off('huddle:self_active', onSelf);
            socket.off('connect', ask);
        };
    }, [socket]);

    // Full call screen or the small floating one; every new call opens full.
    const [callView, setCallView] = useState('full');
    useEffect(() => {
        if (huddle.active && huddle.huddleId) setCallView('full');
    }, [huddle.active, huddle.huddleId]);

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
    // A DM / group-DM call ringing for me (huddle:ring with ring: true):
    // { huddleId, kind, dmId, workspaceId, title, from: { id, name, avatar }, video, meetingId, expiresAt }.
    const [incomingCall, setIncomingCall] = useState(null);
    // A channel huddle someone just started (huddle:ring with ring: false): a "Join" banner, no ringing.
    const [huddleBanner, setHuddleBanner] = useState(null);
    const currentUserIdRef = useRef(null);
    currentUserIdRef.current = currentUser?.id || currentUser?._id || currentUser?.sub || null;

    const huddleRef = useRef(huddle);
    huddleRef.current = huddle;
    const workspaceIdRef = useRef(workspaceId);
    workspaceIdRef.current = workspaceId;

    // Rings come to my own room whatever workspace is open: answer, decline, or let it ring out.
    useEffect(() => {
        if (!socket) return undefined;
        const onRing = (payload) => {
            if (!payload?.huddleId) return;
            const mine = String(currentUserIdRef.current || '');
            if (String(payload.from?.id || '') === mine) return;
            // Already in a call (here or on another device): the server doesn't ring, but be safe.
            if (huddleRef.current.active || selfActiveRef.current?.huddleId) return;
            if (payload.ring === false) setHuddleBanner(payload);
            else setIncomingCall(payload);
        };
        const onCancel = ({ huddleId } = {}) => {
            if (!huddleId) return;
            setIncomingCall(prev => (prev?.huddleId === huddleId ? null : prev));
            setHuddleBanner(prev => (prev?.huddleId === huddleId ? null : prev));
        };
        const onDeclined = ({ huddleId, name } = {}) => {
            if (huddleId && huddleId === huddleRef.current.huddleId) showToast(`${name || 'They'} declined the call.`, 'info');
        };
        const onNoAnswer = ({ huddleId } = {}) => {
            if (huddleId && huddleId === huddleRef.current.huddleId) showToast('No answer.', 'info');
        };
        socket.on('huddle:ring', onRing);
        socket.on('huddle:ring_cancel', onCancel);
        socket.on('huddle:declined', onDeclined);
        socket.on('huddle:no_answer', onNoAnswer);
        return () => {
            socket.off('huddle:ring', onRing);
            socket.off('huddle:ring_cancel', onCancel);
            socket.off('huddle:declined', onDeclined);
            socket.off('huddle:no_answer', onNoAnswer);
        };
    }, [socket, showToast]);

    const declineIncomingCall = useCallback(() => {
        setIncomingCall(prev => {
            if (prev?.huddleId) socket?.emit('huddle:decline', { huddleId: prev.huddleId });
            return null;
        });
    }, [socket]);


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
            meetingId: info.meetingId ? String(info.meetingId) : meetingIdFromHuddleId(id),
            workspaceId: workspaceIdRef.current || null,
            startTime: info.startTime ? new Date(info.startTime) : new Date(),
            participants: [],
        };
        setSelectedHuddle(call);
        setPanelCall(call);
        return call;
    }, []);

    /**
     * One call per person: when this start/join needs a "switch?" or "move here?" answer,
     * remember how to run it and show the question instead. Returns true when it asked.
     */
    const askFirst = useCallback((targetId, opts, run) => {
        if (opts.confirmed) return false;
        const h = huddleRef.current;
        const mySocket = socket?.id;
        const elsewhere = selfActiveRef.current && selfActiveRef.current.socketId !== mySocket ? selfActiveRef.current : null;
        const local = h.active ? { huddleId: h.huddleId, channelName: null, title: 'this call' } : null;
        const found = callConflict(targetId, { local, elsewhere });
        if (!found) return false;
        setConflict({ ...found, run });
        return true;
    }, [socket]);

    /**
     * Start a huddle (or, with opts.huddleId, start-or-join that fixed huddle).
     * opts.scope = { channelId } | { dmId } places it in a conversation.
     * opts.switchCall / opts.transfer / opts.startMuted: after "switch" / "move here" (see useHuddle).
     */
    const startAndSelect = useCallback((title = 'Huddle', opts = {}) => {
        const h0 = huddleRef.current;
        const target = opts.scope && (opts.scope.channelId || opts.scope.dmId) ? opts.scope : null;
        // My call is already in this conversation: on this device just show it; on another
        // device, offer to move it here (starting would only join that same call).
        if (target && h0.active && sameScope(h0.callScope, target)) {
            setCallView('full');
            return Promise.resolve(h0.huddleId);
        }
        const el = selfActiveRef.current && selfActiveRef.current.socketId !== socket?.id ? selfActiveRef.current : null;
        if (target && el && sameScope(target, el) && !opts.confirmed) {
            const move = (extra) => joinRef.current({
                id: el.huddleId, video: !!el.videoEnabled, channelId: el.channelId || null, dmId: el.dmId || null, channelName: el.channelName || null,
            }, { quiet: !!opts.quiet, ...extra, confirmed: true });
            pendingActionRef.current = move;
            setConflict({ kind: 'move', current: el, run: move });
            return Promise.resolve(null);
        }
        const again = (extra) => startAndSelect(title, { ...opts, ...extra, confirmed: true });
        pendingActionRef.current = again;
        // A new call has no id yet, so it can only be a "switch" (fixed meeting ids may be a "move").
        if (askFirst(opts.huddleId || '__new__', opts, again)) return Promise.resolve(null);
        return runConnect('Starting huddle', async () => {
            const h = huddleRef.current;
            if (h.active && opts.huddleId && h.huddleId === opts.huddleId) return h.huddleId;
            if (h.active) h.leaveHuddle();
            const scope = opts.scope && (opts.scope.channelId || opts.scope.dmId) ? opts.scope : null;
            const id = await h.startHuddle({ video: !!opts.video, huddleId: opts.huddleId, scope, switchCall: !!opts.switchCall, transfer: !!opts.transfer, startMuted: !!opts.startMuted });
            if (id) selectCall(id, { title, video: opts.video, channelName: opts.channelName, ...(scope || {}) });
            return id;
        }, { quiet: !!opts.quiet });
    }, [runConnect, selectCall, askFirst, socket]);
    const joinRef = useRef(null);

    /** Join a live huddle: { id, title?, video?, channelId?, dmId?, workspaceId?, channel? }. */
    const joinAndSelect = useCallback((huddleData, opts = {}) => {
        const again = (extra) => joinAndSelect(huddleData, { ...opts, ...extra, confirmed: true });
        pendingActionRef.current = again;
        if (askFirst(huddleData.id, opts, again)) return Promise.resolve(null);
        return runConnect('Joining huddle', async () => {
            const h = huddleRef.current;
            if (h.active && h.huddleId === huddleData.id) { setCallView('full'); return huddleData.id; }
            if (h.active) h.leaveHuddle();
            const scope = huddleData.channelId ? { channelId: huddleData.channelId }
                : huddleData.dmId ? { dmId: huddleData.dmId }
                    : huddleData.workspaceId ? { workspaceId: huddleData.workspaceId } : null;
            const id = await h.joinHuddle(huddleData.id, { video: !!huddleData.video, scope, switchCall: !!opts.switchCall, transfer: !!opts.transfer, startMuted: !!opts.startMuted });
            if (id) {
                selectCall(id, {
                    title: huddleData.title,
                    video: huddleData.video,
                    channelName: huddleData.channel || huddleData.channelName,
                    startTime: huddleData.startTime,
                    meetingId: huddleData.meetingId,
                    ...(scope && !scope.workspaceId ? scope : {}),
                });
            }
            return id;
        }, { quiet: !!opts.quiet });
    }, [runConnect, selectCall, askFirst]);
    joinRef.current = joinAndSelect;

    /** Answer a "switch?" / "move here?" question. */
    const resolveConflict = useCallback((yes) => {
        const c = conflict;
        setConflict(null);
        if (!yes || !c) return;
        if (c.kind === 'move') {
            const muted = c.current && c.current.audioEnabled === false;
            c.run({ transfer: true, startMuted: muted }).catch(() => {});
            return;
        }
        // Leaving my call on this device happens inside the retry; another device is told by the server.
        c.run({ switchCall: true }).catch(() => {});
    }, [conflict]);

    /** "Move here": bring my call from another device to this one, keeping mute and camera. */
    const moveCallHere = useCallback(() => {
        const s = selfActiveRef.current;
        if (!s?.huddleId) return Promise.resolve(null);
        return joinAndSelect({
            id: s.huddleId,
            video: !!s.videoEnabled,
            channelId: s.channelId || null,
            dmId: s.dmId || null,
            workspaceId: !s.channelId && !s.dmId ? s.workspaceId : null,
            channelName: s.channelName || null,
            meetingId: s.meetingId || null,
        }, { transfer: true, startMuted: s.audioEnabled === false, confirmed: true, quiet: true });
    }, [joinAndSelect]);

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
                    meetingId: c.meetingId || (s.meetingId ? String(s.meetingId) : null),
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

        // The server lists workspace huddles plus channel and DM huddles of my conversations.
        const loadActive = () => {
            socket.emit('huddle:list', { workspaceId }, (res) => {
                const all = (res?.huddles || []).map(toEntry);
                setListedHuddles(all.filter(h => h.scope !== 'dm'));
                setDmHuddles(all.filter(h => h.scope === 'dm'));
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
            setIncomingCall(prev => (prev?.huddleId === huddleId ? null : prev));
            setHuddleBanner(prev => (prev?.huddleId === huddleId ? null : prev));
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

    // A ring lasts until its expiresAt (45 seconds), and stops once I'm in a call.
    useEffect(() => {
        if (!incomingCall) return undefined;
        if (huddle.active) { setIncomingCall(null); return undefined; }
        // expiresAt is milliseconds since 1970 (older servers sent an ISO string).
        const exp = typeof incomingCall.expiresAt === 'number' ? incomingCall.expiresAt : Date.parse(incomingCall.expiresAt || '');
        const left = exp - Date.now();
        const t = setTimeout(() => setIncomingCall(null), Number.isFinite(left) ? Math.max(0, Math.min(left, 60000)) : 45000);
        return () => clearTimeout(t);
    }, [incomingCall, huddle.active]);

    // The "huddle started" banner goes away by itself, or once I'm in a call.
    useEffect(() => {
        if (!huddleBanner) return undefined;
        if (huddle.active) { setHuddleBanner(null); return undefined; }
        const t = setTimeout(() => setHuddleBanner(null), 20000);
        return () => clearTimeout(t);
    }, [huddleBanner, huddle.active]);

    // Starting a huddle where one was already running joins that one: follow its id.
    useEffect(() => {
        const hid = huddle.huddleId;
        if (!hid) return;
        const follow = (c) => (c && c.status === 'live' && c.id !== hid ? { ...c, id: hid, meetingId: meetingIdFromHuddleId(hid) } : c);
        setSelectedHuddle(follow);
        setPanelCall(follow);
    }, [huddle.huddleId]);

    // Every live huddle I can see, mine included (sidebar "live" markers).
    const liveHuddles = useMemo(() => {
        const seen = new Set();
        const mine = huddle.active && huddle.huddleId && huddle.callScope
            ? [{ id: huddle.huddleId, scope: huddle.callScope.channelId ? 'channel' : huddle.callScope.dmId ? 'dm' : 'workspace', channelId: huddle.callScope.channelId || null, dmId: huddle.callScope.dmId || null, participants: huddle.participants }]
            : [];
        return [...mine, ...listedHuddles, ...dmHuddles].filter(h => (seen.has(h.id) ? false : (seen.add(h.id), true)));
    }, [listedHuddles, dmHuddles, huddle.active, huddle.huddleId, huddle.callScope, huddle.participants]);

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
        handRaised: huddle.handRaised,
        toggleHand: huddle.toggleHand,
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
        liveHuddles,
        incomingCall,
        dismissIncomingCall: () => setIncomingCall(null),
        declineIncomingCall,
        huddleBanner,
        dismissHuddleBanner: () => setHuddleBanner(null),

        workspaceId: workspaceId || null,
        session: session && session.huddleId === (panelCall?.id || huddle.huddleId) ? session : null,
        reloadSession: loadSession,
        panelCall,
        workspaceOpen,
        workspaceTab,
        setWorkspaceTab,
        openWorkspace,
        closeWorkspace,
        isCallIn: (scope) => huddle.active && sameScope(huddle.callScope, scope),

        // Full call screen or the floating mini call.
        callView,
        expandCall: () => setCallView('full'),
        minimiseCall: () => setCallView('mini'),
        // One call per person, across devices.
        conflict,
        resolveConflict,
        callElsewhere: selfActive && selfActive.socketId !== socket?.id
            && !(huddle.active && huddle.huddleId === selfActive.huddleId) ? selfActive : null,
        moveCallHere,
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
