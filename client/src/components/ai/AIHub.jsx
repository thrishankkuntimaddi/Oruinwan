// client/src/components/ai/AIHub.jsx
/**
 * AIHub — Global AI Command Center
 *
 * Drop this component once (near App root) to enable:
 *   • Cmd+K → AI Search Bar
 *   • / prefix in command box → NL Command dispatch
 *   • Global "AI" button in top bar to toggle assistants
 *
 * Accepts minimal props; reads workspaceId from localStorage / context as fallback.
 */
import React, { useState, useEffect, useCallback } from 'react';
import AISearchBar   from './AISearchBar';
import AICommandBox  from './AICommandBox';

function getToken() {
    // Try multiple storage keys used by the app
    return (
        localStorage.getItem('accessToken') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('accessToken') ||
        ''
    );
}

function getWorkspaceId() {
    return (
        localStorage.getItem('currentWorkspaceId') ||
        localStorage.getItem('workspaceId') ||
        ''
    );
}

// ─── Floating Trigger Button ──────────────────────────────────────────────────
export const AITriggerButton = ({ onClick, label = '⚡ AI', style = {} }) => (
    <button
        onClick={onClick}
        title="Open AI Command (⌘K)"
        style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.2))',
            border: '1px solid rgba(139,92,246,0.4)',
            color: '#c4b5fd', fontSize: 13, fontWeight: 600,
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'all 0.15s ease', boxShadow: '0 0 12px rgba(139,92,246,0.1)',
            ...style,
        }}
        onMouseEnter={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.4), rgba(99,102,241,0.35))';
            e.currentTarget.style.boxShadow = '0 0 20px rgba(139,92,246,0.25)';
        }}
        onMouseLeave={e => {
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(99,102,241,0.2))';
            e.currentTarget.style.boxShadow = '0 0 12px rgba(139,92,246,0.1)';
        }}
    >
        {label}
    </button>
);

// ─── Main Hub ─────────────────────────────────────────────────────────────────
export default function AIHub({ workspaceId: propWsId, token: propToken }) {
    const [searchOpen, setSearchOpen]   = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);

    const workspaceId = propWsId || getWorkspaceId();
    const token       = propToken || getToken();

    // Global keyboard shortcuts
    useEffect(() => {
        const handler = (e) => {
            // Cmd+K / Ctrl+K → open search
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(prev => !prev);
                setCommandOpen(false);
            }
            // Cmd+/ or Ctrl+/ → open command palette
            if ((e.metaKey || e.ctrlKey) && e.key === '/') {
                e.preventDefault();
                setCommandOpen(prev => !prev);
                setSearchOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const closeSearch  = useCallback(() => setSearchOpen(false),  []);
    const closeCommand = useCallback(() => setCommandOpen(false), []);

    return (
        <>
            {searchOpen  && (
                <AISearchBar
                    workspaceId={workspaceId}
                    token={token}
                    onClose={closeSearch}
                />
            )}
            <AICommandBox
                workspaceId={workspaceId}
                token={token}
                isOpen={commandOpen}
                onClose={closeCommand}
            />
        </>
    );
}
