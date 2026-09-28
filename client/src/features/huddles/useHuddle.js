import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import api from '../../services/api';
import logger from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';

// Used only when the server cannot be reached; STUN alone fails behind strict NATs.
const FALLBACK_ICE_CONFIG = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }],
    iceTransportPolicy: 'all',
};

let iceCache = null;

/** STUN/TURN config from the server (TURN credentials are short-lived, so cache for half their TTL). */
export async function getIceConfig() {
    if (iceCache && iceCache.expiresAt > Date.now()) return iceCache.config;
    try {
        const { data } = await api.get('/api/v2/huddles/ice-servers');
        const config = {
            iceServers: data.iceServers?.length ? data.iceServers : FALLBACK_ICE_CONFIG.iceServers,
            iceTransportPolicy: data.iceTransportPolicy || 'all',
        };
        if (!data.turn) logger.warn('[useHuddle] No TURN server configured; calls may fail behind strict NATs.');
        iceCache = { config, expiresAt: Date.now() + (data.ttlSeconds || 3600) * 500 };
        return config;
    } catch (err) {
        logger.error('[useHuddle] Could not load ICE servers, using STUN fallback:', err?.message || err);
        return FALLBACK_ICE_CONFIG;
    }
}

export function __resetIceCacheForTests() {
    iceCache = null;
}

const HUDDLE_ERROR_MESSAGES = {
    HUDDLE_FULL: 'This huddle is full.',
    FORBIDDEN: 'You do not have access to this huddle.',
};

/**
 * One huddle connection (WebRTC mesh, audio only).
 *
 * Several instances can share one socket (the workspace HuddleProvider and each
 * chat window), so every handler ignores events for huddles this instance is not
 * in, and announcements are limited to this instance's channel/DM/workspace.
 */
export function useHuddle({ channelId, dmId, workspaceId, currentUser, socket }) {
    const { showToast } = useToast();
    const [active, setActive] = useState(false);
    const [huddleId, setHuddleId] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [muted, setMuted] = useState(false);
    const [huddleAnnouncement, setHuddleAnnouncement] = useState(null);
    // Video: whether this huddle is a video call, whether my camera is on, and
    // everyone's streams (state, so the overlay can render <video> elements).
    const [isVideo, setIsVideo] = useState(false);
    const [cameraOn, setCameraOn] = useState(false);
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({});
    // Screen share replaces the outgoing camera track; null when not sharing.
    const [screenStream, setScreenStream] = useState(null);
    // RTCPeerConnection.connectionState per remote user (real connection status for the UI).
    const [peerStates, setPeerStates] = useState({});

    const myUserId = String(currentUser?.id || currentUser?._id || currentUser?.sub || '');
    const myName = currentUser?.username || currentUser?.name || 'You';

    // Refs mirror state so socket handlers always see the current huddle without re-subscribing.
    const huddleIdRef = useRef(null);
    const scopeRef = useRef({ channelId, dmId, workspaceId });
    scopeRef.current = { channelId, dmId, workspaceId };
    const joinScopeRef = useRef(null);
    const localStreamRef = useRef(null);
    const iceConfigRef = useRef(FALLBACK_ICE_CONFIG);
    const peersRef = useRef({});          // userId -> { pc, pending: RTCIceCandidateInit[], isOfferer }
    const earlyCandidatesRef = useRef({}); // userId -> candidates received before the peer existed
    const screenStreamRef = useRef(null);
    const cameraOnRef = useRef(false);
    cameraOnRef.current = cameraOn;
    // A start/join is waiting for getUserMedia: a second click must not open a second mic.
    const enteringRef = useRef(false);
    // Bumped by leave/unmount so a getUserMedia that resolves late is stopped, not used.
    const attemptRef = useRef(0);

    const scopePayload = () => {
        const s = joinScopeRef.current || scopeRef.current;
        return {
            channelId: s.channelId || undefined,
            dmId: s.dmId || undefined,
            workspaceId: s.channelId || s.dmId ? undefined : (s.workspaceId || undefined),
        };
    };

    const matchesScope = useCallback((payload) => {
        const s = scopeRef.current;
        if (s.channelId) return String(payload.channelId || '') === String(s.channelId);
        if (s.dmId) return String(payload.dmId || '') === String(s.dmId);
        if (s.workspaceId) return !payload.channelId && !payload.dmId && String(payload.workspaceId || '') === String(s.workspaceId);
        return false;
    }, []);

    const isMine = (hid) => Boolean(hid) && hid === huddleIdRef.current;

    // ── Peer connections ────────────────────────────────────────────────────

    const cleanupPeer = useCallback((userId) => {
        const entry = peersRef.current[userId];
        if (entry) {
            entry.pc.onicecandidate = null;
            entry.pc.ontrack = null;
            entry.pc.onconnectionstatechange = null;
            entry.pc.close();
            delete peersRef.current[userId];
        }
        delete earlyCandidatesRef.current[userId];
        setPeerStates(prev => {
            if (!(userId in prev)) return prev;
            const next = { ...prev };
            delete next[userId];
            return next;
        });
        const audio = document.getElementById(`huddle-audio-${userId}`);
        if (audio) { audio.srcObject = null; audio.remove(); }
        setRemoteStreams(prev => {
            if (!prev[userId]) return prev;
            const next = { ...prev };
            delete next[userId];
            return next;
        });
    }, []);

    const cleanupPeers = useCallback(() => {
        Object.keys(peersRef.current).forEach(cleanupPeer);
        earlyCandidatesRef.current = {};
    }, [cleanupPeer]);

    const cleanupAll = useCallback(() => {
        cleanupPeers();
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(t => { t.onended = null; t.stop(); });
            screenStreamRef.current = null;
        }
        setScreenStream(null);
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
        setLocalStream(null);
    }, [cleanupPeers]);

    const resetState = useCallback(() => {
        huddleIdRef.current = null;
        joinScopeRef.current = null;
        setActive(false);
        setHuddleId(null);
        setParticipants([]);
        setMuted(false);
        setIsVideo(false);
        setCameraOn(false);
        setRemoteStreams({});
        setPeerStates({});
    }, []);

    const flushCandidates = async (entry) => {
        const queued = entry.pending.splice(0);
        for (const c of queued) {
            try { await entry.pc.addIceCandidate(c); } catch (err) { logger.warn('[useHuddle] Dropped ICE candidate:', err?.message); }
        }
    };

    const sendOffer = useCallback(async (userId, { iceRestart = false } = {}) => {
        const entry = peersRef.current[userId];
        if (!entry || !socket) return;
        const offer = await entry.pc.createOffer(iceRestart ? { iceRestart: true } : undefined);
        await entry.pc.setLocalDescription(offer);
        socket.emit('huddle:offer', { huddleId: huddleIdRef.current, targetUserId: userId, offer: entry.pc.localDescription });
    }, [socket]);

    const getOrCreatePeer = useCallback((targetUserId, isOfferer) => {
        const existing = peersRef.current[targetUserId];
        if (existing) return existing;

        const pc = new RTCPeerConnection(iceConfigRef.current);
        const entry = { pc, pending: earlyCandidatesRef.current[targetUserId] || [], isOfferer };
        delete earlyCandidatesRef.current[targetUserId];
        peersRef.current[targetUserId] = entry;

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
        }
        // Someone joining while I share my screen gets the screen, not the camera.
        const screenTrack = screenStreamRef.current?.getVideoTracks()[0];
        if (screenTrack) {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            sender?.replaceTrack(screenTrack).catch(err => logger.warn('[useHuddle] replaceTrack failed:', err?.message));
        }

        pc.onicecandidate = ({ candidate }) => {
            if (candidate && socket && huddleIdRef.current) {
                socket.emit('huddle:ice-candidate', { huddleId: huddleIdRef.current, targetUserId, candidate: candidate.toJSON ? candidate.toJSON() : candidate });
            }
        };

        pc.ontrack = ({ streams }) => {
            const [remoteStream] = streams;
            let audio = document.getElementById(`huddle-audio-${targetUserId}`);
            if (!audio) {
                audio = document.createElement('audio');
                audio.id = `huddle-audio-${targetUserId}`;
                audio.autoplay = true;
                document.body.appendChild(audio);
            }
            audio.srcObject = remoteStream;
            audio.play?.().catch(() => { /* autoplay blocked until the next user gesture */ });
            // Audio plays through the hidden <audio>; the overlay renders video tracks.
            setRemoteStreams(prev => (prev[targetUserId] === remoteStream ? prev : { ...prev, [targetUserId]: remoteStream }));
        };

        // The side that made the original offer drives recovery with an ICE restart.
        pc.onconnectionstatechange = () => {
            if (peersRef.current[targetUserId] === entry) {
                setPeerStates(prev => (prev[targetUserId] === pc.connectionState ? prev : { ...prev, [targetUserId]: pc.connectionState }));
            }
            if (pc.connectionState === 'failed' && entry.isOfferer && peersRef.current[targetUserId] === entry) {
                logger.warn(`[useHuddle] Connection to ${targetUserId} failed, restarting ICE`);
                sendOffer(targetUserId, { iceRestart: true }).catch(err => logger.error('[useHuddle] ICE restart failed:', err));
            }
        };

        return entry;
    }, [socket, sendOffer]);

    // ── Actions ─────────────────────────────────────────────────────────────

    const enter = useCallback(async (id, { start, video = false }) => {
        if (!socket || (!channelId && !dmId && !workspaceId) || !currentUser) {
            throw new Error('Not connected yet. Please try again in a moment.');
        }
        // Already in a huddle, or a start/join is already waiting for the microphone.
        if (huddleIdRef.current || enteringRef.current) return null;
        enteringRef.current = true;
        const attempt = ++attemptRef.current;

        let stream;
        let withCamera = false;
        try {
            const iceConfigPromise = getIceConfig();
            if (video) {
                // Fall back to audio only if the camera is missing or refused.
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { width: { ideal: 640 }, height: { ideal: 360 } } });
                    withCamera = true;
                } catch (camErr) {
                    logger.warn('[useHuddle] Camera unavailable, joining with audio only:', camErr?.message);
                    showToast?.('Camera unavailable: joining with audio only.', 'info');
                }
            }
            if (!stream) stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            iceConfigRef.current = await iceConfigPromise;
        } catch (err) {
            if (attempt === attemptRef.current) enteringRef.current = false;
            logger.error('[useHuddle] Failed to get microphone:', err);
            throw err;
        }
        if (attempt === attemptRef.current) enteringRef.current = false;
        // Left, unmounted or superseded while the browser was asking for the mic: drop this stream.
        if (attempt !== attemptRef.current || huddleIdRef.current) {
            stream.getTracks().forEach(t => t.stop());
            if (localStreamRef.current === stream) localStreamRef.current = null;
            return null;
        }
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsVideo(!!video);
        setCameraOn(withCamera);

        huddleIdRef.current = id;
        joinScopeRef.current = { channelId, dmId, workspaceId };
        const scope = scopePayload();
        const joinPayload = { ...scope, huddleId: id, audioEnabled: true, videoEnabled: withCamera };
        if (start) {
            // The server handles start and join concurrently; if join is processed first the
            // huddle is created as voice-only. Join once our own huddle:started has come back.
            let sent = false;
            let timer = null;
            const sendJoin = () => {
                if (sent) return;
                sent = true;
                clearTimeout(timer);
                socket.off('huddle:started', onOwnStart);
                if (huddleIdRef.current === id) socket.emit('huddle:join', joinPayload);
            };
            const onOwnStart = (payload) => { if (payload?.huddleId === id) sendJoin(); };
            socket.on('huddle:started', onOwnStart);
            timer = setTimeout(sendJoin, 1500);
            socket.emit('huddle:start', { ...scope, huddleId: id, video: !!video });
        } else {
            socket.emit('huddle:join', joinPayload);
        }

        setHuddleId(id);
        setActive(true);
        setMuted(false);
        setHuddleAnnouncement(null);
        setParticipants([{ userId: myUserId, username: myName, audioEnabled: true, videoEnabled: withCamera, isLocal: true }]);
        return id;
    }, [socket, channelId, dmId, workspaceId, currentUser, myUserId, myName, showToast]);

    // opts.huddleId: a fixed id (e.g. one huddle per scheduled meeting); starting an existing one joins it.
    const startHuddle = useCallback((opts = {}) => enter(opts?.huddleId || uuidv4(), { start: true, video: !!opts?.video }), [enter]);
    // Joining a video huddle turns the camera on too (the announcement says which kind it is).
    const joinHuddle = useCallback((id, opts = {}) => enter(id, { start: false, video: !!opts?.video }), [enter]);

    const toggleCamera = useCallback(() => {
        const id = huddleIdRef.current;
        const tracks = localStreamRef.current?.getVideoTracks() || [];
        if (!id || !socket || tracks.length === 0) return;
        const next = !cameraOn;
        tracks.forEach(t => { t.enabled = next; });
        setCameraOn(next);
        setParticipants(prev => prev.map(p => p.isLocal ? { ...p, videoEnabled: next } : p));
        socket.emit('huddle:video_toggle', { huddleId: id, videoEnabled: next });
    }, [cameraOn, socket]);

    const stopScreenShare = useCallback(() => {
        const screen = screenStreamRef.current;
        if (!screen) return;
        screenStreamRef.current = null;
        screen.getTracks().forEach(t => { t.onended = null; t.stop(); });
        setScreenStream(null);
        const camera = localStreamRef.current?.getVideoTracks()[0] || null;
        Object.values(peersRef.current).forEach(({ pc }) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            sender?.replaceTrack(camera).catch(err => logger.warn('[useHuddle] replaceTrack failed:', err?.message));
        });
        const id = huddleIdRef.current;
        const on = cameraOnRef.current;
        setParticipants(prev => prev.map(p => p.isLocal ? { ...p, videoEnabled: on } : p));
        if (id && socket) socket.emit('huddle:video_toggle', { huddleId: id, videoEnabled: on });
    }, [socket]);

    /**
     * Send the screen instead of the camera (replaceTrack, no renegotiation), so it
     * needs a video huddle with a camera track. Resolves false when that is missing.
     */
    const startScreenShare = useCallback(async () => {
        const id = huddleIdRef.current;
        if (!id || !socket || screenStreamRef.current) return false;
        if (!localStreamRef.current?.getVideoTracks().length) return false;
        if (!navigator.mediaDevices?.getDisplayMedia) throw new Error('Screen sharing is not supported in this browser.');
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const track = display.getVideoTracks()[0];
        if (!track || huddleIdRef.current !== id) {
            display.getTracks().forEach(t => t.stop());
            return false;
        }
        screenStreamRef.current = display;
        // The browser's own "Stop sharing" button ends the track.
        track.onended = () => stopScreenShare();
        await Promise.all(Object.values(peersRef.current).map(({ pc }) => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            return sender ? sender.replaceTrack(track).catch(err => logger.warn('[useHuddle] replaceTrack failed:', err?.message)) : null;
        }));
        setScreenStream(display);
        setParticipants(prev => prev.map(p => p.isLocal ? { ...p, videoEnabled: true } : p));
        socket.emit('huddle:video_toggle', { huddleId: id, videoEnabled: true });
        return true;
    }, [socket, stopScreenShare]);

    const leaveHuddle = useCallback(() => {
        // Also cancels a start/join that is still waiting for the microphone.
        attemptRef.current += 1;
        enteringRef.current = false;
        const id = huddleIdRef.current;
        if (!id) return;
        if (socket) socket.emit('huddle:leave', { ...scopePayload(), huddleId: id });
        cleanupAll();
        resetState();
    }, [socket, cleanupAll, resetState]);

    const toggleMute = useCallback(() => {
        const id = huddleIdRef.current;
        if (!localStreamRef.current || !socket || !id) return;
        const newMuted = !muted;
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
        setMuted(newMuted);
        socket.emit('huddle:audio_toggle', { huddleId: id, audioEnabled: !newMuted });
    }, [muted, socket]);

    // ── Socket events ───────────────────────────────────────────────────────

    useEffect(() => {
        if (!socket) return;

        const upsertParticipant = (p) => setParticipants(prev =>
            prev.some(x => x.userId === p.userId)
                ? prev.map(x => x.userId === p.userId ? { ...x, ...p } : x)
                : [...prev, p]
        );

        const onRoster = ({ huddleId: hid, participants: others = [] }) => {
            if (!isMine(hid)) return;
            others.filter(p => String(p.userId) !== myUserId).forEach(p => upsertParticipant({
                userId: String(p.userId), username: p.username, audioEnabled: p.audioEnabled, videoEnabled: !!p.videoEnabled,
            }));
        };

        const onVideoChanged = ({ huddleId: hid, userId, videoEnabled }) => {
            if (!isMine(hid)) return;
            setParticipants(prev => prev.map(p => p.userId === String(userId) ? { ...p, videoEnabled } : p));
        };

        // Existing members call each newcomer, so there is exactly one offerer per pair.
        const onJoined = async ({ huddleId: hid, userId, username, audioEnabled, videoEnabled }) => {
            if (!isMine(hid) || String(userId) === myUserId) return;
            upsertParticipant({ userId: String(userId), username, audioEnabled, videoEnabled: !!videoEnabled });
            try {
                cleanupPeer(String(userId));
                getOrCreatePeer(String(userId), true);
                await sendOffer(String(userId));
            } catch (err) {
                logger.error('[useHuddle] Error creating offer:', err);
            }
        };

        const onOffer = async ({ huddleId: hid, fromUserId, offer }) => {
            if (!isMine(hid)) return;
            try {
                const entry = getOrCreatePeer(String(fromUserId), false);
                await entry.pc.setRemoteDescription(offer);
                await flushCandidates(entry);
                const answer = await entry.pc.createAnswer();
                await entry.pc.setLocalDescription(answer);
                socket.emit('huddle:answer', { huddleId: hid, targetUserId: fromUserId, answer: entry.pc.localDescription });
            } catch (err) {
                logger.error('[useHuddle] Error handling offer:', err);
            }
        };

        const onAnswer = async ({ huddleId: hid, fromUserId, answer }) => {
            if (!isMine(hid)) return;
            const entry = peersRef.current[String(fromUserId)];
            if (!entry) return;
            try {
                await entry.pc.setRemoteDescription(answer);
                await flushCandidates(entry);
            } catch (err) {
                logger.error('[useHuddle] Error handling answer:', err);
            }
        };

        // Candidates can arrive before the offer/answer is applied; queue them until then.
        const onIce = async ({ huddleId: hid, fromUserId, candidate }) => {
            if (!isMine(hid) || !candidate) return;
            const uid = String(fromUserId);
            const entry = peersRef.current[uid];
            if (!entry) {
                (earlyCandidatesRef.current[uid] ||= []).push(candidate);
                return;
            }
            if (!entry.pc.remoteDescription) {
                entry.pending.push(candidate);
                return;
            }
            try { await entry.pc.addIceCandidate(candidate); } catch (err) { logger.warn('[useHuddle] Error adding ICE candidate:', err?.message); }
        };

        const onLeft = ({ huddleId: hid, userId }) => {
            if (!isMine(hid) || String(userId) === myUserId) return;
            cleanupPeer(String(userId));
            setParticipants(prev => prev.filter(p => p.userId !== String(userId)));
        };

        const onEnded = ({ huddleId: hid, reason }) => {
            setHuddleAnnouncement(prev => (prev?.huddleId === hid ? null : prev));
            if (!isMine(hid)) return;
            if (reason === 'joined_elsewhere') showToast?.('You joined this huddle from another window.', 'info');
            cleanupAll();
            resetState();
        };

        const onAudioChanged = ({ huddleId: hid, userId, audioEnabled }) => {
            if (hid && !isMine(hid)) return;
            setParticipants(prev => prev.map(p => p.userId === String(userId) ? { ...p, audioEnabled } : p));
        };

        const onStarted = (payload) => {
            if (huddleIdRef.current || !matchesScope(payload)) return;
            if (String(payload.startedBy?._id || '') === myUserId) return;
            setHuddleAnnouncement({ huddleId: payload.huddleId, startedBy: payload.startedBy, video: !!payload.video });
        };

        const onError = ({ huddleId: hid, code, message }) => {
            if (!isMine(hid)) return;
            logger.error(`[useHuddle] ${code}: ${message}`);
            showToast?.(HUDDLE_ERROR_MESSAGES[code] || message || 'Huddle error', 'error');
            if (code === 'HUDDLE_FULL' || code === 'FORBIDDEN' || code === 'HUDDLE_SCOPE_MISMATCH') {
                cleanupAll();
                resetState();
            }
        };

        // After a reconnect the server has already removed us; rejoin with fresh peers.
        const onReconnect = () => {
            const id = huddleIdRef.current;
            if (!id) return;
            cleanupPeers();
            socket.emit('huddle:join', { ...scopePayload(), huddleId: id, audioEnabled: !muted, videoEnabled: cameraOn });
        };

        socket.on('huddle:roster', onRoster);
        socket.on('huddle:joined', onJoined);
        socket.on('huddle:offer', onOffer);
        socket.on('huddle:answer', onAnswer);
        socket.on('huddle:ice-candidate', onIce);
        socket.on('huddle:left', onLeft);
        socket.on('huddle:ended', onEnded);
        socket.on('huddle:audio_changed', onAudioChanged);
        socket.on('huddle:started', onStarted);
        socket.on('huddle:error', onError);
        socket.on('huddle:video_changed', onVideoChanged);
        socket.on('connect', onReconnect);

        return () => {
            socket.off('huddle:roster', onRoster);
            socket.off('huddle:joined', onJoined);
            socket.off('huddle:offer', onOffer);
            socket.off('huddle:answer', onAnswer);
            socket.off('huddle:ice-candidate', onIce);
            socket.off('huddle:left', onLeft);
            socket.off('huddle:ended', onEnded);
            socket.off('huddle:audio_changed', onAudioChanged);
            socket.off('huddle:started', onStarted);
            socket.off('huddle:error', onError);
            socket.off('huddle:video_changed', onVideoChanged);
            socket.off('connect', onReconnect);
        };
    }, [socket, myUserId, muted, cameraOn, matchesScope, getOrCreatePeer, sendOffer, cleanupPeer, cleanupPeers, cleanupAll, resetState, showToast]);

    // A huddle that started before this conversation was opened: ask the server so "Join" is offered.
    useEffect(() => {
        if (!socket || (!channelId && !dmId)) return undefined;
        let cancelled = false;
        const check = () => {
            if (huddleIdRef.current) return;
            socket.emit('huddle:active', { channelId: channelId || undefined, dmId: channelId ? undefined : dmId }, (res) => {
                const live = res?.huddle;
                if (cancelled || huddleIdRef.current || !live) return;
                if (live.participants?.some(p => String(p.userId) === myUserId)) return;
                setHuddleAnnouncement({ huddleId: live.huddleId, startedBy: live.startedBy, video: !!live.video });
            });
        };
        if (socket.connected) check();
        socket.on('connect', check);
        return () => {
            cancelled = true;
            socket.off('connect', check);
            setHuddleAnnouncement(null);
        };
    }, [socket, channelId, dmId, myUserId]);

    // Leaving the page or conversation leaves the huddle, so the server's roster stays true.
    const socketRef = useRef(socket);
    socketRef.current = socket;
    useEffect(() => () => {
        attemptRef.current += 1;
        const id = huddleIdRef.current;
        if (id && socketRef.current) socketRef.current.emit('huddle:leave', { ...scopePayload(), huddleId: id });
        cleanupAll();
        huddleIdRef.current = null;
    }, [cleanupAll]);

    return {
        active,
        huddleId,
        participants,
        muted,
        huddleAnnouncement,
        startHuddle,
        joinHuddle,
        leaveHuddle,
        toggleMute,
        isVideo,
        cameraOn,
        toggleCamera,
        localStream,
        remoteStreams,
        screenStream,
        startScreenShare,
        stopScreenShare,
        peerStates,
        dismissAnnouncement: () => setHuddleAnnouncement(null),
    };
}
