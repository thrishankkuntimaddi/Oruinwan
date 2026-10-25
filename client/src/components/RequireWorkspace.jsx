import React from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';
import logger from '../utils/logger';

const WorkspaceLoadingShell = ({ label = 'Loading workspace...' }) => (
    <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font)',
    }}>
        <div style={{ textAlign: 'center' }}>
            {}
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

/** A link into a workspace this account isn't in: say so (instead of silently redirecting). */
const NotAMember = () => (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--bg-base)', fontFamily: 'var(--font)', padding: 24 }}>
        <div role="alert" style={{ maxWidth: 420, width: '100%', textAlign: 'center', background: 'var(--bg-surface, var(--bg-elevated))', border: '1px solid var(--border-subtle, var(--border))', borderRadius: 20, padding: '32px 24px' }}>
            <div style={{ fontSize: 34, marginBottom: 8 }} aria-hidden>🔒</div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>You're not a member of this workspace</h1>
            <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
                This link points to something in a workspace you haven't joined. Ask someone in it to invite you, or open one of your own workspaces.
            </p>
            <Link to="/workspaces" replace style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 12, background: 'var(--accent)', color: 'var(--text-on-accent, #1a1408)', fontWeight: 600, textDecoration: 'none' }}>
                Go to my workspaces
            </Link>
        </div>
    </div>
);

const RequireWorkspace = ({ children }) => {
    const { workspaceId } = useParams();
    const { activeWorkspace, workspaces, loading, error } = useWorkspace();

    
    if (loading) {
        return <WorkspaceLoadingShell label="Loading workspace..." />;
    }

    
    if (!workspaceId) {
        logger.warn('🔒 [RequireWorkspace] No workspaceId in URL - redirecting to /workspaces');
        return <Navigate to="/workspaces" replace />;
    }

    
    const isMember = workspaces.some(ws => ws.id === workspaceId || ws.id.toString() === workspaceId.toString());

    if (!isMember) {
        if (loading) {
            return <WorkspaceLoadingShell label="Verifying access..." />;
        }

        logger.warn('[RequireWorkspace] Link to a workspace this account is not in', { workspaceId });
        return <NotAMember />;
    }

    
    if (!activeWorkspace || error || (activeWorkspace.id !== workspaceId && activeWorkspace.id.toString() !== workspaceId.toString())) {
        return <WorkspaceLoadingShell label="Switching workspace..." />;
    }

    
    return <>{children}</>;
};

export default RequireWorkspace;
