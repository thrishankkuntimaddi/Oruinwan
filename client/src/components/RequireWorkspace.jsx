import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * RequireWorkspace Guard
 * 
 * CRITICAL: Enforces workspace boundary - nothing renders without valid workspace
 * 
 * Ensures user has access to the workspace before allowing access to workspace-specific routes.
 * Redirects to /workspaces if:
 * - No workspaceId in URL
 * - Workspace is not found
 * - User is not a member of the workspace
 * - URL workspaceId doesn't match activeWorkspace (prevents route manipulation)
 * 
 * This guard prevents:
 * ❌ /notes, /tasks, /updates from ever rendering
 * ❌ Accessing workspaces user is not a member of
 * ❌ Route-based data leakage
 */
const RequireWorkspace = ({ children }) => {
    const { workspaceId } = useParams();
    const { activeWorkspace, workspaces, loading, error } = useWorkspace();

    // Show loading state while fetching workspaces
    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Loading workspace...</p>
                </div>
            </div>
        );
    }

    // 🔒 CRITICAL VALIDATION #1: workspaceId must exist in URL
    if (!workspaceId) {
        console.warn('🔒 [RequireWorkspace] No workspaceId in URL - redirecting to /workspaces');
        return <Navigate to="/workspaces" replace />;
    }

    // 🔒 CRITICAL VALIDATION #2: activeWorkspace must exist
    if (!activeWorkspace || error) {
        console.warn('🔒 [RequireWorkspace] No active workspace or error:', error || 'No workspace');
        return <Navigate to="/workspaces" replace />;
    }

    // 🔒 CRITICAL VALIDATION #3: URL workspaceId must match activeWorkspace
    // This prevents route manipulation attacks (e.g., changing URL to another workspace)
    if (workspaceId !== activeWorkspace.id) {
        console.warn('🔒 [RequireWorkspace] URL workspace mismatch!', {
            urlWorkspaceId: workspaceId,
            activeWorkspaceId: activeWorkspace.id
        });
        return <Navigate to="/workspaces" replace />;
    }

    // 🔒 CRITICAL VALIDATION #4: User must be member of workspace
    // Double-check that user actually belongs to this workspace
    const isMember = workspaces.some(ws => ws.id === workspaceId);
    if (!isMember) {
        console.error('🚨 [RequireWorkspace] SECURITY: User tried to access workspace they are not a member of!', {
            workspaceId,
            userWorkspaces: workspaces.map(w => w.id)
        });
        return <Navigate to="/workspaces" replace />;
    }

    // ✅ All validations passed - user has valid workspace access
    return <>{children}</>;
};

export default RequireWorkspace;
