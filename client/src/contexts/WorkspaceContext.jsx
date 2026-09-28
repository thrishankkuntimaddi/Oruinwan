import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '@services/api';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';
import logger from '../utils/logger';

/** GET /api/workspaces/my item -> the shape the app uses (always `id`). */
function mapWorkspace(ws) {
    return {
        id: ws.id,
        name: ws.name,
        description: ws.description,
        icon: ws.icon,
        color: ws.color || null,
        type: ws.type,
        members: ws.members,
        memberCount: ws.memberCount,
        rules: ws.rules || '',
        settings: ws.settings || {},
        role: ws.isOwner ? 'owner' : ws.role,
        isOwner: !!ws.isOwner,
        membershipStatus: ws.membershipStatus || 'active',
        ownerName: ws.ownerName,
    };
}

const WorkspaceContext = createContext();

/** Like useWorkspace, but returns null outside a WorkspaceProvider instead of throwing (app-wide widgets). */
export const useOptionalWorkspace = () => useContext(WorkspaceContext) || null;

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
    const { socket, isConnected } = useSocket();
    const { showToast } = useToast() || {};
    const showToastRef = React.useRef(showToast);
    showToastRef.current = showToast;
    const activeWorkspaceId = activeWorkspace?.id ? String(activeWorkspace.id) : null;
    const activeIdRef = React.useRef(activeWorkspaceId);
    activeIdRef.current = activeWorkspaceId;

    // Join the active workspace's socket room (server: chatHandlers 'join-workspace'
    // expects { workspaceId } and verifies membership). Re-emitted on every (re)connect.
    useEffect(() => {
        if (!socket || !isConnected || !activeWorkspaceId) return;
        socket.emit('join-workspace', { workspaceId: activeWorkspaceId });
    }, [socket, isConnected, activeWorkspaceId]);

    
    useEffect(() => {
        const fetchWorkspaces = async () => {
            try {
                setLoading(true);
                setError(null);

                const response = await api.get('/api/workspaces/my');

                if (response.data.workspaces && response.data.workspaces.length > 0) {
                    
                    const mapped = response.data.workspaces.map(mapWorkspace);

                    setWorkspaces(mapped);

                    
                    if (workspaceId) {
                        const active = mapped.find(ws =>
                            ws.id === workspaceId || ws.id.toString() === workspaceId
                        );

                        if (active) {

                            setActiveWorkspace(active);
                        } else {
                            logger.warn('⚠️ [WorkspaceContext] WorkspaceId not found in user workspaces:', workspaceId);
                            setError('Workspace not found');
                        }
                    }
                } else {

                }
            } catch (err) {
                logger.error('❌ [WorkspaceContext] Error fetching workspaces:', err);
                setError(err.message || 'Failed to load workspaces');
            } finally {
                setLoading(false);
            }
        };

        fetchWorkspaces();
    }, [workspaceId]);

    
    useEffect(() => {
        if (!socket) return;

        const same = (a, b) => a != null && b != null && String(a) === String(b);
        const patchWorkspace = (wsId, patch) => {
            setWorkspaces(prev => prev.map(ws => (same(ws.id, wsId) ? { ...ws, ...patch, id: ws.id } : ws)));
            setActiveWorkspace(prev => (prev && same(prev.id, wsId) ? { ...prev, ...patch, id: prev.id } : prev));
        };
        // Leave a workspace the user can no longer see: drop it and go to the picker.
        const leave = (wsId, message) => {
            setWorkspaces(prev => prev.filter(ws => !same(ws.id, wsId)));
            if (same(activeIdRef.current, wsId)) {
                if (message) showToastRef.current?.(message, 'warning');
                setActiveWorkspace(null);
                navigate('/workspaces', { replace: true });
            }
        };

        const handleWorkspaceUpdated = (data = {}) => {
            const { workspaceId, ...patch } = data;
            patchWorkspace(workspaceId, patch);
        };

        const handleWorkspaceDeleted = (data = {}) => {
            leave(data.workspaceId, 'This workspace was deleted');
        };

        // Live role changes: admin-only UI appears/disappears without a reload.
        const handleRoleUpdated = (data = {}) => {
            if (!data.workspaceId || !data.role) return;
            patchWorkspace(data.workspaceId, { role: data.role, isOwner: data.role === 'owner' });
            if (same(activeIdRef.current, data.workspaceId)) {
                showToastRef.current?.(`Your role is now ${data.role}`, 'info');
            }
        };

        const REVOKE_MESSAGES = {
            suspended: 'Your access to this workspace was suspended',
            removed: 'You were removed from this workspace',
            left: 'You left the workspace',
        };
        const handleAccessRevoked = (data = {}) => {
            if (!data.workspaceId) return;
            if (data.reason === 'suspended') {
                patchWorkspace(data.workspaceId, { membershipStatus: 'suspended' });
                if (same(activeIdRef.current, data.workspaceId)) {
                    showToastRef.current?.(REVOKE_MESSAGES.suspended, 'warning');
                    setActiveWorkspace(null);
                    navigate('/workspaces', { replace: true });
                }
                return;
            }
            leave(data.workspaceId, REVOKE_MESSAGES[data.reason] || 'You no longer have access to this workspace');
        };

        const handleAccessRestored = (data = {}) => {
            if (!data.workspaceId) return;
            patchWorkspace(data.workspaceId, { membershipStatus: 'active' });
        };

        socket.on('workspace-updated', handleWorkspaceUpdated);
        socket.on('workspace-deleted', handleWorkspaceDeleted);
        socket.on('workspace:role-updated', handleRoleUpdated);
        socket.on('workspace:access-revoked', handleAccessRevoked);
        socket.on('workspace:access-restored', handleAccessRestored);

        return () => {
            socket.off('workspace-updated', handleWorkspaceUpdated);
            socket.off('workspace-deleted', handleWorkspaceDeleted);
            socket.off('workspace:role-updated', handleRoleUpdated);
            socket.off('workspace:access-revoked', handleAccessRevoked);
            socket.off('workspace:access-restored', handleAccessRestored);
        };
    }, [socket, navigate]);

    
    const isMemberOf = (wsId) => {
        return workspaces.some(ws => ws.id === wsId || ws.id.toString() === wsId);
    };

    
    const refreshWorkspace = async () => {
        try {

            const response = await api.get('/api/workspaces/my');

            if (response.data.workspaces && response.data.workspaces.length > 0) {
                const mapped = response.data.workspaces.map(mapWorkspace);

                setWorkspaces(mapped);

                
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
            logger.error('❌ [WorkspaceContext] Error refreshing workspace:', err);
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
