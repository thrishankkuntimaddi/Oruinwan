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

    // 🔒 CRITICAL VALIDATION #2: User must be member of workspace
    // Check membership FIRST (before checking if it's active)
    // Use loose comparison to handle string vs number IDs
    const isMember = workspaces.some(ws => ws.id == workspaceId || ws.id.toString() === workspaceId.toString());

    if (!isMember) {
        // If we are still loading workspaces, give it a moment before kicking them out
        if (loading) {
            return (
                <div className="flex items-center justify-center h-screen bg-gray-50">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-600 font-medium">Verifying access...</p>
                    </div>
                </div>
            );
        }

        console.error('🚨 [RequireWorkspace] SECURITY: User tried to access workspace they are not a member of!', {
            workspaceId,
            userWorkspaces: workspaces.map(w => w.id)
        });
        return <Navigate to="/workspaces" replace />;
    }

    // 🔒 CRITICAL VALIDATION #3: activeWorkspace must exist and match URL
    // If we have a valid member but activeWorkspace confuses us, we might be mid-switch
    if (!activeWorkspace || error || (activeWorkspace.id != workspaceId && activeWorkspace.id.toString() !== workspaceId.toString())) {
        console.log('🔄 [RequireWorkspace] Workspace switch in progress - waiting for context update...', {
            urlId: workspaceId,
            activeId: activeWorkspace?.id
        });

        // INSTEAD of redirecting, we show loading shell which allows WorkspaceContext to catch up
        // This fixes the "flash redirect" issue when clicking sidebar icons
        return (
            <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 font-medium">Switching workspace...</p>
                </div>
            </div>
        );
    }

    // ✅ All validations passed - user has valid workspace access
    return <>{children}</>;
};

export default RequireWorkspace;
