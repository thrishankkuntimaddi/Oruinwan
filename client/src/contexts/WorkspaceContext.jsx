import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    const navigate = useNavigate();
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
                        members: ws.members,
                        rules: ws.rules,
                        role: ws.role // User's role in this workspace (owner, admin, member)
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
    }, [workspaceId]);

    // WebSocket Listeners
    useEffect(() => {
        if (!socket) return;

        const handleWorkspaceUpdated = (data) => {
            setWorkspaces(prev => prev.map(ws =>
                ws.id === data.workspaceId
                    ? { ...ws, ...data, id: ws.id }
                    : ws
            ));
            // Update active workspace using functional updater to avoid stale closure
            setActiveWorkspace(prev =>
                prev && prev.id === data.workspaceId ? { ...prev, ...data } : prev
            );
        };

        const handleWorkspaceDeleted = (data) => {
            setWorkspaces(prev => prev.filter(ws => ws.id !== data.workspaceId));
            // Use functional updater to read current active workspace without capturing stale state
            setActiveWorkspace(prev => {
                if (prev && prev.id === data.workspaceId) {
                    navigate('/');
                    return null;
                }
                return prev;
            });
        };

        socket.on('workspace-updated', handleWorkspaceUpdated);
        socket.on('workspace-deleted', handleWorkspaceDeleted);

        return () => {
            socket.off('workspace-updated', handleWorkspaceUpdated);
            socket.off('workspace-deleted', handleWorkspaceDeleted);
        };
    }, [socket, navigate]); // Removed stale `activeWorkspace` dep — use functional updater instead

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
                    members: ws.members,
                    rules: ws.rules,
                    role: ws.role
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
