import React, { useState, useEffect, useCallback } from 'react';
import AISearchBar   from './AISearchBar';
import AICommandBox  from './AICommandBox';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from 'react-router-dom';

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

/** ⌘/ command launcher and AI search, for signed-in users inside a workspace. */
export default function AIHub({ workspaceId: propWsId }) {
    const [searchOpen, setSearchOpen]   = useState(false);
    const [commandOpen, setCommandOpen] = useState(false);
    const { user } = useAuth() || {};
    // Rendered app-wide (outside the workspace provider), so the workspace comes from the URL.
    const { pathname } = useLocation();
    const workspaceId = propWsId || /\/workspace\/([a-f0-9]{24})/.exec(pathname)?.[1] || null;
    const enabled = !!user;

    const closeSearch  = useCallback(() => setSearchOpen(false),  []);
    const closeCommand = useCallback(() => setCommandOpen(false), []);

    
    useEffect(() => {
        if (!enabled) return undefined;
        const handler = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.code === 'Slash') {
                e.preventDefault();
                setCommandOpen(prev => !prev);
                setSearchOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [enabled]);

    if (!enabled) return null;

    return (
        <>
            {searchOpen  && (
                <AISearchBar
                    workspaceId={workspaceId}
                    onClose={closeSearch}
                />
            )}
            <AICommandBox
                workspaceId={workspaceId}
                isOpen={commandOpen}
                onClose={closeCommand}
            />
        </>
    );
}
