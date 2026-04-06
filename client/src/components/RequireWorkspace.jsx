import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * RequireWorkspace Guard
 *
 * CRITICAL: Enforces workspace boundary — nothing renders without valid workspace.
 * Redirects to /workspaces if workspaceId is missing, not found, or user is not a member.
 */

/* Shared Monolith loading shell */
const WorkspaceLoadingShell = ({ label = 'Loading workspace...' }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font)',
    }}>
        <div style={{ textAlign: 'center' }}>
            {/* Spinner — uses accent color, no border-blue */}
            <div style={{
                width: '32px', height: '32px', margin: '0 auto 14px',
                border: '2px solid var(--border-accent)',
                borderTopColor: 'var(--accent)',
                borderRadius: '50%',
                animation: 'ws-spin 0.7s linear infinite',
            }} />
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
                {label}
            </p>
        </div>
        <style>{`@keyframes ws-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

const RequireWorkspace = ({ children }) => {
    const { workspaceId } = useParams();
    const { activeWorkspace, workspaces, loading, error } = useWorkspace();

    // Show loading state while fetching workspaces
    if (loading) {
        return <WorkspaceLoadingShell label="Loading workspace..." />;
    }

    // 🔒 CRITICAL VALIDATION #1: workspaceId must exist in URL
    if (!workspaceId) {
        console.warn('🔒 [RequireWorkspace] No workspaceId in URL - redirecting to /workspaces');
        return <Navigate to="/workspaces" replace />;
    }

    // 🔒 CRITICAL VALIDATION #2: User must be member of workspace
    const isMember = workspaces.some(ws => ws.id === workspaceId || ws.id.toString() === workspaceId.toString());

    if (!isMember) {
        if (loading) {
            return <WorkspaceLoadingShell label="Verifying access..." />;
        }

        console.error('🚨 [RequireWorkspace] SECURITY: User tried to access workspace they are not a member of!', {
            workspaceId,
            userWorkspaces: workspaces.map(w => w.id)
        });
        return <Navigate to="/workspaces" replace />;
    }

    // 🔒 CRITICAL VALIDATION #3: activeWorkspace must exist and match URL
    if (!activeWorkspace || error || (activeWorkspace.id !== workspaceId && activeWorkspace.id.toString() !== workspaceId.toString())) {
        return <WorkspaceLoadingShell label="Switching workspace..." />;
    }

    // ✅ All validations passed
    return <>{children}</>;
};

export default RequireWorkspace;
