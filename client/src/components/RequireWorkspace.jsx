import React from 'react';
import { Navigate } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';

/**
 * RequireWorkspace Guard
 * 
 * Ensures user has access to the workspace before allowing access to workspace-specific routes.
 * Redirects to /workspaces if:
 * - Workspace is not found
 * - User is not a member of the workspace
 */
const RequireWorkspace = ({ children }) => {
    const { activeWorkspace, loading, error } = useWorkspace();

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

    // If no active workspace or error, redirect to workspace selection
    if (!activeWorkspace || error) {
        console.warn('🔒 [RequireWorkspace] Access denied:', error || 'No workspace found');
        return <Navigate to="/workspaces" replace />;
    }

    // User has valid workspace access
    return <>{children}</>;
};

export default RequireWorkspace;
