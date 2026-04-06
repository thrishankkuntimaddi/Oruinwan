import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, FileText, CheckSquare, Settings, Bot } from 'lucide-react';

const TABS = [
    { id: 'home',     Icon: Home,        label: 'Home',     path: '/home'  },
    { id: 'notes',    Icon: FileText,    label: 'Notes',    path: '/notes' },
    { id: 'tasks',    Icon: CheckSquare, label: 'Tasks',    path: '/tasks' },
    { id: 'ai',       Icon: Bot,         label: 'AI',       path: null     },
    { id: 'settings', Icon: Settings,    label: 'Settings', path: null     },
];

// Routes that are "under" the Home tab (navigated from MobileHomePage)
const HOME_SUB_PATHS = ['/channels', '/channel/', '/messages', '/dm/', '/files', '/knowledge', '/updates', '/huddles', '/apps'];

const MobileBottomNav = ({ workspaceId, showAI, onAIToggle }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const path     = location.pathname;

    const isActive = (tab) => {
        if (tab.id === 'ai') return showAI;
        if (showAI) return false; // AI is open → only AI tab is active
        if (tab.id === 'settings') return path.startsWith('/settings');
        if (!tab.path || !workspaceId) return false;

        const root = `/workspace/${workspaceId}${tab.path}`;
        if (tab.id === 'home') {
            // Home tab stays active when navigating into Channels/DMs/Files etc.
            return path === root || HOME_SUB_PATHS.some(p => path.includes(p));
        }
        return path === root || path.startsWith(root + '/');
    };

    const handleTab = (tab) => {
        if (tab.id === 'ai') { onAIToggle(); return; }
        // Dismiss AI panel first (handles same-route case where navigation won't remount MainLayout)
        if (showAI) onAIToggle();
        if (tab.id === 'settings') { navigate('/settings'); return; }
        if (tab.path && workspaceId) navigate(`/workspace/${workspaceId}${tab.path}`);
    };

    return (
        <>
            <style>{`
                @keyframes mobileTabIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }
            `}</style>
            <div style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80,
                height: `calc(56px + env(safe-area-inset-bottom))`,
                paddingBottom: 'env(safe-area-inset-bottom)',
                background: 'var(--bg-base)',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'stretch',
                animation: 'mobileTabIn 200ms ease',
            }}>
                {TABS.map(tab => {
                    const active = isActive(tab);
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTab(tab)}
                            style={{
                                flex: 1, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center', gap: '4px',
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: active ? 'var(--accent)' : 'var(--text-muted)',
                                transition: 'color 150ms ease',
                                fontFamily: 'var(--font)', position: 'relative',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                        >
                            {/* Active indicator */}
                            <div style={{
                                position: 'absolute', top: 0, left: '50%',
                                transform: 'translateX(-50%)',
                                width: active ? '24px' : 0, height: '2px',
                                background: 'var(--accent)',
                                borderRadius: '0 0 2px 2px',
                                transition: 'width 200ms ease',
                            }} />
                            <tab.Icon size={20} strokeWidth={active ? 2.5 : 2} />
                            <span style={{
                                fontSize: '9px', fontWeight: active ? 700 : 500,
                                letterSpacing: '0.04em', lineHeight: 1,
                            }}>
                                {tab.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    );
};

export default MobileBottomNav;
