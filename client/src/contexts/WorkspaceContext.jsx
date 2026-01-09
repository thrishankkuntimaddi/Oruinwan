import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import { useSocket } from './SocketContext';

const WorkspaceContext = createContext();

export const useWorkspace = () => {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within WorkspaceProvider');
    }
    return context;
};

export const WorkspaceProvider = ({ children }) => {
    const { workspaceId } = useParams();
    const [workspaces, setWorkspaces] = useState([]);
    const [activeWorkspace, setActiveWorkspace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const { socket } = useSocket();

    // Fetch user's workspaces
    useEffect(() => {
        const fetchWorkspaces = async () => {
            try {
                setLoading(true);
                setError(null);



                const response = await api.get('/api/workspaces/my');



                if (response.data.workspaces && response.data.workspaces.length > 0) {
                    // Map to consistent format
                    const mapped = response.data.workspaces.map(ws => ({
                        id: ws.id,
                        name: ws.name,
                        icon: ws.icon || "🚀",
                        color: ws.color || "#2563eb",
                        type: ws.type,
                        role: ws.role, // User's role in this workspace (owner, admin, member)
                        members: ws.members
                    }));

                    setWorkspaces(mapped);

                    // Set active workspace based on URL param
                    if (workspaceId) {
                        const active = mapped.find(ws =>
                            ws.id === workspaceId || ws.id.toString() === workspaceId
                        );

                        if (active) {


                            setActiveWorkspace(active);
                        } else {
                            console.warn('⚠️ [WorkspaceContext] WorkspaceId not found in user workspaces:', workspaceId);
                            setError('Workspace not found');
                        }
                    }
                } else {

                }
            } catch (err) {
                console.error('❌ [WorkspaceContext] Error fetching workspaces:', err);
                setError(err.message || 'Failed to load workspaces');
            } finally {
                setLoading(false);
            }
        };

        fetchWorkspaces();
        fetchWorkspaces();
    }, [workspaceId]);

    // WebSocket Listeners
    useEffect(() => {
        if (!socket) return;

        const handleWorkspaceUpdated = (data) => {

            setWorkspaces(prev => prev.map(ws =>
                ws.id === data.workspaceId
                    ? { ...ws, ...data, id: ws.id } // ensuring ID stability and merging updates
                    : ws
            ));

            if (activeWorkspace && activeWorkspace.id === data.workspaceId) {
                setActiveWorkspace(prev => ({ ...prev, ...data }));
            }
        };

        const handleWorkspaceDeleted = (data) => {

            setWorkspaces(prev => prev.filter(ws => ws.id !== data.workspaceId));

            if (activeWorkspace && activeWorkspace.id === data.workspaceId) {
                setActiveWorkspace(null);
                // Redirect handled by component or user interaction usually
                // But we can clear state.
                window.location.href = '/'; // Force redirect to home/select
            }
        };

        // workspace-joined is handled by HomePanel? Or should be here?
        // Usually listMyWorkspaces handles the list. receiving workspace-joined (for ME) means I'm added.
        // But SocketContext emission for workspace-joined is usually to the ROOM.
        // If *I* join, I might receive it if I'm already connected?
        // Actually, joinWorkspace in controller emits to workspace room. 
        // If I just joined, I might not be in the room yet until client emits join-workspace?
        // The joinWorkspace API response adds the user.
        // The socket event is for OTHERS to know I joined.
        // However, if I am invited and added (e.g. by someone else), I might get an event?
        // Currently no event for "added to workspace".

        socket.on('workspace-updated', handleWorkspaceUpdated);
        socket.on('workspace-deleted', handleWorkspaceDeleted);

        return () => {
            socket.off('workspace-updated', handleWorkspaceUpdated);
            socket.off('workspace-deleted', handleWorkspaceDeleted);
        };
    }, [socket, activeWorkspace]);

    // Helper: Check if user is member of a workspace
    const isMemberOf = (wsId) => {
        return workspaces.some(ws => ws.id === wsId || ws.id.toString() === wsId);
    };

    // Helper: Refresh workspace data (useful after role changes)
    const refreshWorkspace = async () => {
        try {

            const response = await api.get('/api/workspaces/my');

            if (response.data.workspaces && response.data.workspaces.length > 0) {
                const mapped = response.data.workspaces.map(ws => ({
                    id: ws.id,
                    name: ws.name,
                    icon: ws.icon || "🚀",
                    color: ws.color || "#2563eb",
                    type: ws.type,
                    role: ws.role,
                    members: ws.members
                }));

                setWorkspaces(mapped);

                // Update active workspace if it exists
                if (workspaceId) {
                    const active = mapped.find(ws =>
                        ws.id === workspaceId || ws.id.toString() === workspaceId
                    );
                    if (active) {

                        setActiveWorkspace(active);
                    }
                }
            }
        } catch (err) {
            console.error('❌ [WorkspaceContext] Error refreshing workspace:', err);
        }
    };

    const value = {
        workspaces,
        activeWorkspace,
        setActiveWorkspace,
        loading,
        error,
        isMemberOf,
        refreshWorkspace
    };

    return (
        <WorkspaceContext.Provider value={value}>
            {children}
        </WorkspaceContext.Provider>
    );
};
