import React, { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

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

    // Fetch user's workspaces
    useEffect(() => {
        const fetchWorkspaces = async () => {
            try {
                setLoading(true);
                setError(null);

                console.log('🔍 [WorkspaceContext] Fetching workspaces...');

                const response = await api.get('/api/workspaces/my');

                console.log('📋 [WorkspaceContext] Workspaces received:', response.data);

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
                            console.log('✅ [WorkspaceContext] Active workspace set:', active.name);
                            console.log('🆔 [WorkspaceContext] Workspace ID:', active.id);
                            setActiveWorkspace(active);
                        } else {
                            console.warn('⚠️ [WorkspaceContext] WorkspaceId not found in user workspaces:', workspaceId);
                            setError('Workspace not found');
                        }
                    }
                } else {
                    console.log('📭 [WorkspaceContext] No workspaces found');
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

    // Helper: Check if user is member of a workspace
    const isMemberOf = (wsId) => {
        return workspaces.some(ws => ws.id === wsId || ws.id.toString() === wsId);
    };

    // Helper: Refresh workspace data (useful after role changes)
    const refreshWorkspace = async () => {
        try {
            console.log('🔄 [WorkspaceContext] Refreshing workspace data...');
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
                        console.log('✅ [WorkspaceContext] Active workspace refreshed with role:', active.role);
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
