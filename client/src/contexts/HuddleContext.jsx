import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useHuddle } from '../components/messagesComp/chatWindowComp/hooks/useHuddle';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const HuddleContext = createContext(null);

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

    
    const [activeWorkspaceHuddles, setActiveWorkspaceHuddles] = useState([]);

    
    const startAndSelect = useCallback(async (huddle_title = 'Instant Huddle') => {
        try {
            await huddle.startHuddle();
            const newHuddle = {
                id: `instant-${Date.now()}`,
                title: huddle_title,
                channel: null,
                status: 'live',
                startTime: new Date(),
                participants: [],
            };
            setSelectedHuddle(newHuddle);
            return newHuddle;
        } catch (err) {
            console.error('[HuddleContext] Failed to start huddle:', err);
            throw err;
        }
    }, [huddle]);

    const joinAndSelect = useCallback(async (huddleData) => {
        try {
            await huddle.joinHuddle(huddleData.id);
            setSelectedHuddle({ ...huddleData, status: 'live' });
        } catch (err) {
            console.error('[HuddleContext] Failed to join huddle:', err);
            throw err;
        }
    }, [huddle]);

    const leaveAndDeselect = useCallback(() => {
        if (selectedHuddle && huddle.active) {
            const ended = {
                ...selectedHuddle,
                status: 'past',
                endTime: new Date(),
                participantCount: huddle.participants.length,
            };
            setHuddleHistory(prev => [ended, ...prev].slice(0, 20));
        }
        huddle.leaveHuddle();
        setSelectedHuddle(prev => prev ? { ...prev, status: 'past' } : null);
    }, [huddle, selectedHuddle]);

    
    useEffect(() => {
        if (selectedHuddle && huddle.active) {
            setSelectedHuddle(prev => prev ? {
                ...prev,
                participants: huddle.participants,
            } : prev);
        }
    }, [huddle.participants, huddle.active]);

    
    useEffect(() => {
        if (!socket || !workspaceId) return;

        const onHuddleStarted = ({ huddleId, channelId, channelName, startedBy }) => {
            setActiveWorkspaceHuddles(prev => {
                const exists = prev.find(h => h.id === huddleId);
                if (exists) return prev;
                return [...prev, {
                    id: huddleId,
                    channelId,
                    title: `${channelName || 'Channel'} Huddle`,
                    channel: channelName,
                    status: 'live',
                    startedBy,
                    startTime: new Date(),
                }];
            });
        };

        const onHuddleEnded = ({ huddleId }) => {
            setActiveWorkspaceHuddles(prev => prev.filter(h => h.id !== huddleId));
        };

        socket.on('huddle:started', onHuddleStarted);
        socket.on('huddle:ended', onHuddleEnded);

        return () => {
            socket.off('huddle:started', onHuddleStarted);
            socket.off('huddle:ended', onHuddleEnded);
        };
    }, [socket, workspaceId]);

    const value = {
        
        active: huddle.active,
        huddleId: huddle.huddleId,
        participants: huddle.participants,
        muted: huddle.muted,
        huddleAnnouncement: huddle.huddleAnnouncement,
        dismissAnnouncement: huddle.dismissAnnouncement,

        
        startHuddle: startAndSelect,
        joinHuddle: joinAndSelect,
        leaveHuddle: leaveAndDeselect,
        toggleMute: huddle.toggleMute,

        
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
