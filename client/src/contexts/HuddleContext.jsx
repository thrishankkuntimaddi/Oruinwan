/**
 * HuddleContext.jsx
 *
 * Shared context wrapping useHuddle so both the MeetingsPanel (sidebar)
 * and the Meetings main panel share in one WebRTC session.
 *
 * Usage:
 *   const { active, participants, muted, huddleId,
 *           startHuddle, joinHuddle, leaveHuddle, toggleMute,
 *           selectedHuddle, setSelectedHuddle,
 *           huddleHistory, activeWorkspaceHuddles } = useHuddleContext();
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useHuddle } from '../components/messagesComp/chatWindowComp/hooks/useHuddle';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const HuddleContext = createContext(null);

export function HuddleProvider({ workspaceId, children }) {
    const { socket } = useSocket();
    const { user: currentUser } = useAuth();

    // Workspace-level instant huddles go through workspaceId (not a fake channelId)
    const huddle = useHuddle({
        workspaceId: workspaceId || null,
        currentUser,
        socket,
    });

    // Which huddle is currently shown in the right panel (may differ from active)
    const [selectedHuddle, setSelectedHuddle] = useState(null);
    // { id, title, channel, status: 'live'|'upcoming'|'past', participants, startTime }

    // Session history of ended huddles
    const [huddleHistory, setHuddleHistory] = useState([]);

    // Live workspace-level huddle announcements (from other channels)
    const [activeWorkspaceHuddles, setActiveWorkspaceHuddles] = useState([]);

    // When the user starts a huddle, auto-select it for the main panel
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

    // Sync live participant count into selectedHuddle
    useEffect(() => {
        if (selectedHuddle && huddle.active) {
            setSelectedHuddle(prev => prev ? {
                ...prev,
                participants: huddle.participants,
            } : prev);
        }
    }, [huddle.participants, huddle.active]);

    // Listen for workspace-level huddle announcements
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
        // Raw huddle state
        active: huddle.active,
        huddleId: huddle.huddleId,
        participants: huddle.participants,
        muted: huddle.muted,
        huddleAnnouncement: huddle.huddleAnnouncement,
        dismissAnnouncement: huddle.dismissAnnouncement,

        // Context-level actions
        startHuddle: startAndSelect,
        joinHuddle: joinAndSelect,
        leaveHuddle: leaveAndDeselect,
        toggleMute: huddle.toggleMute,

        // Panel navigation
        selectedHuddle,
        setSelectedHuddle,

        // History & active workspace huddles
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
