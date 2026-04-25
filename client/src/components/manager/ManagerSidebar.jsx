import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, CheckSquare, FileText, Globe,
    LogOut, Settings, ChevronUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_GROUPS = [
    {
        group: 'OVERVIEW',
        items: [
            { path: '/manager/dashboard/overview', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/manager/dashboard/workspace', label: 'My Workspace', icon: Globe },
        ]
    },
    {
        group: 'ORGANIZATION',
        items: [
            { path: '/manager/dashboard/allocation', label: 'Team Load', icon: Users },
            { path: '/manager/dashboard/projects', label: 'Projects', icon: FileText },
            { path: '/manager/dashboard/unassigned', label: 'Unassigned', icon: Users },
        ]
    },
    {
        group: 'SYSTEM',
        items: [
            { path: '/manager/dashboard/reports', label: 'Limited Visibility', icon: FileText },
            { path: '/manager/dashboard/tasks', label: 'TaskMaster', icon: CheckSquare },
            { path: '/manager/dashboard/settings', label: 'Settings', icon: Settings },
            { path: '/workspaces', label: 'Go to App', icon: Globe },
        ]
    }
];

export default function ManagerSidebar({ onNavigate }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, user } = useAuth();
    const [showMenu, setShowMenu] = useState(false);

    const isActive = (path) => {
        const p = location.pathname;
        if (path === '/manager/dashboard/overview' && (p === '/manager/dashboard' || p === '/manager/dashboard/overview')) return true;
        return p === path;
    };

    const initials = user?.username?.charAt(0)?.toUpperCase() || 'M';

    return (
        <aside style={{
            width: '200px', flexShrink: 0, background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', height: '100vh',
            position: 'sticky', top: 0,
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {}
            <div style={{
                height: '56px', padding: '0 16px', display: 'flex', alignItems: 'center',
                gap: '10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
            }}>
                <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-accent)' }} />
                <div>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>Chttrix</p>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '2px' }}>Manager</p>
                </div>
            </div>

            {}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }} className="custom-scrollbar">
                {NAV_GROUPS.map(grp => (
                    <div key={grp.group} style={{ marginBottom: '20px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', padding: '0 8px', marginBottom: '4px' }}>{grp.group}</p>
                        {grp.items.map(item => {
                            const active = isActive(item.path);
                            return (
                                <NavItem key={item.path} active={active} icon={item.icon} label={item.label} onClick={() => { navigate(item.path); onNavigate?.(); }} />
                            );
                        })}
                    </div>
                ))}
            </nav>

            {}
            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px', position: 'relative', flexShrink: 0 }}>
                {showMenu && (
                    <div style={{
                        position: 'absolute', bottom: '100%', left: '8px', right: '8px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        zIndex: 50, overflow: 'hidden', boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
                        marginBottom: '4px',
                    }}>
                        <button onClick={() => { setShowMenu(false); logout(); navigate('/login'); }}
                            style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--state-danger)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(224,82,82,0.06)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <LogOut size={13} /> Logout
                        </button>
                    </div>
                )}
                <button onClick={() => setShowMenu(s => !s)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: showMenu ? 'var(--bg-active)' : 'none', border: showMenu ? '1px solid var(--border-default)' : '1px solid transparent', cursor: 'pointer', borderRadius: '2px', transition: 'all 150ms ease' }}
                    onMouseEnter={e => { if (!showMenu) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; } }}
                    onMouseLeave={e => { if (!showMenu) { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'transparent'; } }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(184,149,106,0.15)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', flexShrink: 0 }}>{initials}</div>
                    <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username || 'Manager'}</p>
                        <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Manager Console</p>
                    </div>
                    <ChevronUp size={12} style={{ color: 'var(--text-muted)', transform: showMenu ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 200ms ease', flexShrink: 0 }} />
                </button>
            </div>
        </aside>
    );
}

function NavItem({ active, icon: Icon, label, onClick }) {
    const [hov, setHov] = React.useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 8px', background: active ? 'var(--bg-active)' : hov ? 'var(--bg-hover)' : 'none',
                border: active ? '1px solid var(--border-default)' : '1px solid transparent',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                color: active ? 'var(--text-primary)' : hov ? 'var(--text-secondary)' : 'var(--text-muted)',
                cursor: 'pointer', textAlign: 'left', borderRadius: '0 2px 2px 0',
                transition: 'all 150ms ease', fontFamily: 'inherit',
            }}>
            <Icon size={14} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '12px', fontWeight: active ? 600 : 400 }}>{label}</span>
        </button>
    );
}
