import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export function useHuddle({ channelId, dmId, workspaceId, currentUser, socket }) {
    const [active, setActive] = useState(false);
    const [huddleId, setHuddleId] = useState(null);
    const [participants, setParticipants] = useState([]); 
    const [muted, setMuted] = useState(false);
    const [huddleAnnouncement, setHuddleAnnouncement] = useState(null); 

    
    const myUserId = currentUser?.id || currentUser?._id || currentUser?.sub;

    const localStreamRef = useRef(null);   
    const peersRef = useRef({});     
    const remoteStreamsRef = useRef({});    

    

    const getOrCreatePeer = useCallback((targetUserId, activeHuddleId) => {
        if (peersRef.current[targetUserId]) return peersRef.current[targetUserId];

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track =>
                pc.addTrack(track, localStreamRef.current)
            );
        }

        
        pc.onicecandidate = ({ candidate }) => {
            if (candidate && socket) {
                socket.emit('huddle:ice-candidate', {
                    huddleId: activeHuddleId,
                    targetUserId,
                    candidate,
                });
            }
        };

        
        pc.ontrack = ({ streams }) => {
            const [remoteStream] = streams;
            remoteStreamsRef.current[targetUserId] = remoteStream;

            
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

    

    const startHuddle = useCallback(async () => {
        if (!socket || (!channelId && !dmId && !workspaceId) || !currentUser) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            const id = uuidv4();
            socket.emit('huddle:start', {
                channelId: channelId || undefined,
                dmId: dmId || undefined,
                workspaceId: workspaceId || undefined,
                huddleId: id,
            });

            
            socket.emit('huddle:join', {
                huddleId: id,
                channelId: channelId || undefined,
                dmId: dmId || undefined,
                workspaceId: workspaceId || undefined,
                audioEnabled: true,
            });

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
    }, [socket, channelId, dmId, workspaceId, currentUser]);

    const joinHuddle = useCallback(async (id) => {
        if (!socket || (!channelId && !dmId && !workspaceId) || !currentUser) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStreamRef.current = stream;

            socket.emit('huddle:join', {
                huddleId: id,
                channelId: channelId || undefined,
                dmId: dmId || undefined,
                workspaceId: workspaceId || undefined,
                audioEnabled: true,
            });
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
    }, [socket, channelId, dmId, workspaceId, currentUser]);

    const leaveHuddle = useCallback(() => {
        if (!socket || !huddleId) return;
        socket.emit('huddle:leave', {
            huddleId,
            channelId: channelId || undefined,
            dmId: dmId || undefined,
            workspaceId: workspaceId || undefined,
        });
        cleanupAll();
        setActive(false);
        setHuddleId(null);
        setParticipants([]);
    }, [socket, huddleId, channelId, dmId, workspaceId, cleanupAll]);

    const toggleMute = useCallback(() => {
        if (!localStreamRef.current || !socket || !huddleId) return;
        const newMuted = !muted;
        localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !newMuted; });
        setMuted(newMuted);
        socket.emit('huddle:audio_toggle', { huddleId, audioEnabled: !newMuted });
    }, [muted, socket, huddleId]);

    

    useEffect(() => {
        if (!socket) return;

        
        const onJoined = async ({ huddleId: hid, userId, username, audioEnabled }) => {
            if (userId === myUserId) return; 

            setParticipants(prev =>
                prev.find(p => p.userId === userId)
                    ? prev.map(p => p.userId === userId ? { ...p, username, audioEnabled } : p)
                    : [...prev, { userId, username, audioEnabled }]
            );

            
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

        
        const onAnswer = async ({ fromUserId, answer }) => {
            try {
                const pc = peersRef.current[fromUserId];
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
            } catch (err) {
                console.error('[useHuddle] Error handling answer:', err);
            }
        };

        
        const onIce = async ({ fromUserId, candidate }) => {
            try {
                const pc = peersRef.current[fromUserId];
                if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
                console.error('[useHuddle] Error adding ICE candidate:', err);
            }
        };

        
        const onLeft = ({ userId }) => {
            cleanupPeer(userId);
            setParticipants(prev => prev.filter(p => p.userId !== userId));
        };

        
        const onEnded = ({ huddleId: hid }) => {
            if (hid === huddleId) {
                cleanupAll();
                setActive(false);
                setHuddleId(null);
                setParticipants([]);
            }
        };

        
        const onAudioChanged = ({ userId, audioEnabled }) => {
            setParticipants(prev =>
                prev.map(p => p.userId === userId ? { ...p, audioEnabled } : p)
            );
        };

        
        const onStarted = ({ huddleId: hid, startedBy }) => {
            
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
