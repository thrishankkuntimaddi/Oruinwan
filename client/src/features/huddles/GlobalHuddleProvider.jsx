import React from 'react';
import { useLocation } from 'react-router-dom';
import { HuddleProvider } from './HuddleContext';
import HuddleDock from './components/HuddleDock';

/**
 * Keeps the huddle connection above the routes, so moving between pages never
 * drops you from a call. The workspace comes from the URL (/workspace/:id/...).
 */
export default function GlobalHuddleProvider({ children }) {
    const { pathname } = useLocation();
    const match = pathname.match(/^\/workspace\/([^/]+)/);
    const workspaceId = match ? match[1] : null;
    // Keep the last workspace while visiting non-workspace pages mid-call.
    const [lastWorkspaceId, setLastWorkspaceId] = React.useState(workspaceId);
    if (workspaceId && workspaceId !== lastWorkspaceId) setLastWorkspaceId(workspaceId);

    return (
        <HuddleProvider workspaceId={workspaceId || lastWorkspaceId}>
            {children}
            <HuddleDock />
        </HuddleProvider>
    );
}
