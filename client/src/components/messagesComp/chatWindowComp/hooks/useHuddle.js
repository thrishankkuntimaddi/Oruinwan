/**
 * useHuddle.js — Phase 7.7
 *
 * Manages WebRTC peer connections for a huddle voice room.
 *
 * Architecture: Mesh P2P — each participant opens a direct RTCPeerConnection
 * to every other participant. The socket server relays SDP offers/answers and
 * ICE candidates; no media ever passes through the server.
 *
 * Usage:
 *   const huddle = useHuddle({ channelId, currentUser, socket });
 *   // huddle.active, huddle.huddleId, huddle.participants, huddle.muted
 *   // huddle.startHuddle(), huddle.joinHuddle(id), huddle.leaveHuddle()
 *   // huddle.toggleMute()
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export function useHuddle({ channelId, currentUser, socket }) {
    const [active, setActive] = useState(false);
    const [huddleId, setHuddleId] = useState(null);
    const [participants, setParticipants] = useState([]); // [{ userId, username, audioEnabled, stream? }]
    const [muted, setMuted] = useState(false);
    const [huddleAnnouncement, setHuddleAnnouncement] = useState(null); // { huddleId, startedBy }

    // Resolve user ID from whichever field the auth context provides
    const myUserId = currentUser?.id || currentUser?._id || currentUser?.sub;

    const localStreamRef = useRef(null);   // local MediaStream
    const peersRef = useRef({});     // userId → RTCPeerConnection
    const remoteStreamsRef = useRef({});    // userId → MediaStream (for audio output)

    // ── Helpers ────────────────────────────────────────────────────────────

    const getOrCreatePeer = useCallback((targetUserId, activeHuddleId) => {
        if (peersRef.current[targetUserId]) return peersRef.current[targetUserId];

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Add local tracks to peer
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track =>
                pc.addTrack(track, localStreamRef.current)
            );
        }

        // ICE candidates → relay via socket
        pc.onicecandidate = ({ candidate }) => {
            if (candidate && socket) {
                socket.emit('huddle:ice-candidate', {
                    huddleId: activeHuddleId,
                    targetUserId,
                    candidate,
                });
            }
        };

        // Remote audio track → attach to hidden <audio>
        pc.ontrack = ({ streams }) => {
            const [remoteStream] = streams;
            remoteStreamsRef.current[targetUserId] = remoteStream;

            // Create / update an audio element for this peer
            let audio = document.getElementById(`huddle-audio-${targetUserId}`);
            if (!audio) {
                audio = document.createElement('audio');
                audio.id = `huddle-audio-${targetUserId}`;
                audio.autoplay = true;
                document.body.appendChild(audio);
            }
            audio.srcObject = remoteStream;
        };

        peersRef.current[targetUserId] = pc;
        return pc;
    }, [socket]);

    const cleanupPeer = useCallback((userId) => {
        const pc = peersRef.current[userId];
        if (pc) { pc.close(); delete peersRef.current[userId]; }

        // Remove audio element
        const audio = document.getElementById(`huddle-audio-${userId}`);
        if (audio) { audio.srcObject = null; audio.remove(); }

        delete remoteStreamsRef.current[userId];
    }, []);

    const cleanupAll = useCallback(() => {
        Object.keys(peersRef.current).forEach(cleanupPeer);
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
        }
    }, [cleanupPeer]);

    // ── Public API ─────────────────────────────────────────────────────────

    const startHuddle = useCallback(async () => {
        if (!socket || !channelId || !currentUser) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            const id = uuidv4();
            socket.emit('huddle:start', { channelId, huddleId: id });

            // Immediately join own huddle
            socket.emit('huddle:join', { huddleId: id, channelId, audioEnabled: true });

            setHuddleId(id);
            setActive(true);
            setMuted(false);
            setParticipants([{
                userId: myUserId,
                username: currentUser.username || currentUser.name || 'You',
                audioEnabled: true,
                isLocal: true,
            }]);
        } catch (err) {
            console.error('[useHuddle] Failed to get microphone:', err);
            throw err;
        }
    }, [socket, channelId, currentUser]);

    const joinHuddle = useCallback(async (id) => {
        if (!socket || !channelId || !currentUser) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            socket.emit('huddle:join', { huddleId: id, channelId, audioEnabled: true });
            setHuddleId(id);
            setActive(true);
            setMuted(false);
            setParticipants(prev => {
                const existing = prev.find(p => p.userId === myUserId);
                if (existing) return prev;
                return [...prev, {
                    userId: myUserId,
                    username: currentUser.username || currentUser.name || 'You',
                    audioEnabled: true,
                    isLocal: true,
                }];
            });
        } catch (err) {
            console.error('[useHuddle] Failed to get microphone:', err);
            throw err;
        }
    }, [socket, channelId, currentUser]);

    const leaveHuddle = useCallback(() => {
        if (!socket || !huddleId) return;
        socket.emit('huddle:leave', { huddleId, channelId });
        cleanupAll();
        setActive(false);
        setHuddleId(null);
        setParticipants([]);
    }, [socket, huddleId, channelId, cleanupAll]);

    const toggleMute = useCallback(() => {
        if (!localStreamRef.current || !socket || !huddleId) return;
        const newMuted = !muted;
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
        setMuted(newMuted);
        socket.emit('huddle:audio_toggle', { huddleId, audioEnabled: !newMuted });
    }, [muted, socket, huddleId]);

    // ── Socket event listeners ─────────────────────────────────────────────

    useEffect(() => {
        if (!socket) return;

        // Another user joined → initiate offer
        const onJoined = async ({ huddleId: hid, userId, username, audioEnabled }) => {
            if (userId === myUserId) return; // ignore self

            setParticipants(prev =>
                prev.find(p => p.userId === userId)
                    ? prev.map(p => p.userId === userId ? { ...p, username, audioEnabled } : p)
                    : [...prev, { userId, username, audioEnabled }]
            );

            // As the existing participant, create offer for the new joiner
            if (active || huddleId === hid) {
                try {
                    const pc = getOrCreatePeer(userId, hid);
                    const offer = await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('huddle:offer', { huddleId: hid, targetUserId: userId, offer });
                } catch (err) {
                    console.error('[useHuddle] Error creating offer:', err);
                }
            }
        };

        // Incoming offer → create answer
        const onOffer = async ({ huddleId: hid, fromUserId, offer }) => {
            try {
                const pc = getOrCreatePeer(fromUserId, hid);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('huddle:answer', { huddleId: hid, targetUserId: fromUserId, answer });
            } catch (err) {
                console.error('[useHuddle] Error handling offer:', err);
            }
        };

        // Incoming answer
        const onAnswer = async ({ fromUserId, answer }) => {
            try {
                const pc = peersRef.current[fromUserId];
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
                console.error('[useHuddle] Error handling answer:', err);
            }
        };

        // ICE candidate from remote peer
        const onIce = async ({ fromUserId, candidate }) => {
            try {
                const pc = peersRef.current[fromUserId];
                if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error('[useHuddle] Error adding ICE candidate:', err);
            }
        };

        // Participant left
        const onLeft = ({ userId }) => {
            cleanupPeer(userId);
            setParticipants(prev => prev.filter(p => p.userId !== userId));
        };

        // Huddle ended (host or channel admin ended it)
        const onEnded = ({ huddleId: hid }) => {
            if (hid === huddleId) {
                cleanupAll();
                setActive(false);
                setHuddleId(null);
                setParticipants([]);
            }
        };

        // Audio state changed by remote
        const onAudioChanged = ({ userId, audioEnabled }) => {
            setParticipants(prev =>
                prev.map(p => p.userId === userId ? { ...p, audioEnabled } : p)
            );
        };

        // Channel announced a new huddle started
        const onStarted = ({ huddleId: hid, startedBy }) => {
            // Surface to UI so ChatWindowV2 can show a join banner
            if (!active) {
                setHuddleAnnouncement({ huddleId: hid, startedBy });
            }
        };

        socket.on('huddle:joined', onJoined);
        socket.on('huddle:offer', onOffer);
        socket.on('huddle:answer', onAnswer);
        socket.on('huddle:ice-candidate', onIce);
        socket.on('huddle:left', onLeft);
        socket.on('huddle:ended', onEnded);
        socket.on('huddle:audio_changed', onAudioChanged);
        socket.on('huddle:started', onStarted);

        return () => {
            socket.off('huddle:joined', onJoined);
            socket.off('huddle:offer', onOffer);
            socket.off('huddle:answer', onAnswer);
            socket.off('huddle:ice-candidate', onIce);
            socket.off('huddle:left', onLeft);
            socket.off('huddle:ended', onEnded);
            socket.off('huddle:audio_changed', onAudioChanged);
            socket.off('huddle:started', onStarted);
        };
    }, [socket, active, huddleId, currentUser, getOrCreatePeer, cleanupPeer, cleanupAll]);

    // Cleanup on unmount
    useEffect(() => () => cleanupAll(), [cleanupAll]);

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
        dismissAnnouncement: () => setHuddleAnnouncement(null),
    };
}
