// AdminSidebar — Monolith Flow Design System
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Globe, LogOut, Building, BarChart3, User, HelpCircle, UserPlus, Shield,
    LayoutDashboard, Users, Settings, GitBranch, LayoutTemplate, Lock, UsersRound, ChevronUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const NAV_GROUPS = [
    {
        group: 'OVERVIEW',
        items: [
            { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { path: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
        ]
    },
    {
        group: 'ORGANIZATION',
        items: [
            { path: '/admin/departments', label: 'Departments', icon: Building },
            { path: '/admin/workspaces', label: 'Workspaces', icon: Globe },
            { path: '/admin/users', label: 'People', icon: Users },
            { path: '/admin/onboard', label: 'Onboard', icon: UserPlus },
        ]
    },
    {
        group: 'COLLABORATION',
        items: [
            { path: '/admin/teams', label: 'Teams', icon: UsersRound },
            { path: '/admin/org-chart', label: 'Org Chart', icon: GitBranch },
            { path: '/admin/workspace-templates', label: 'WS Templates', icon: LayoutTemplate },
            { path: '/admin/workspace-permissions', label: 'WS Permissions', icon: Lock },
        ]
    },
    {
        group: 'SYSTEM',
        items: [
            { path: '/admin/security', label: 'Audit & Security', icon: Shield },
            { path: '/admin/settings', label: 'Settings', icon: Settings },
            { path: '/manager/dashboard/overview', label: 'Cross Visibility', icon: LayoutDashboard },
            { path: '/contact-admin', label: 'Contact Admin', icon: HelpCircle },
            { path: '/workspaces', label: 'Go to App', icon: Globe },
        ]
    }
];

export default function AdminSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [showMenu, setShowMenu] = useState(false);

    const isActive = (path) => location.pathname === path;

    const handleLogout = () => { logout(); navigate('/login'); };
    const initials = user?.username?.charAt(0)?.toUpperCase() || 'A';

    return (
        <aside style={{
            width: '200px', flexShrink: 0, background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex', flexDirection: 'column', height: '100vh',
            position: 'sticky', top: 0,
            fontFamily: 'Inter, system-ui, sans-serif',
        }}>
            {/* Logo */}
            <div style={{
                height: '56px', padding: '0 16px', display: 'flex', alignItems: 'center',
                gap: '10px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0,
            }}>
                <img src="/chttrix-logo.jpg" alt="Chttrix" style={{ width: '26px', height: '26px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-accent)' }} />
                <div>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>Chttrix</p>
                    <p style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '2px' }}>Company Admin</p>
                </div>
            </div>

            {/* Nav */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }} className="custom-scrollbar">
                {NAV_GROUPS.map(grp => (
                    <div key={grp.group} style={{ marginBottom: '20px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', padding: '0 8px', marginBottom: '4px' }}>{grp.group}</p>
                        {grp.items.map(item => {
                            const active = isActive(item.path);
                            return (
                                <NavItem key={item.path} active={active} icon={item.icon} label={item.label} onClick={() => navigate(item.path)} />
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* User footer */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px', position: 'relative', flexShrink: 0 }}>
                {/* Dropdown */}
                {showMenu && (
                    <div style={{
                        position: 'absolute', bottom: '100%', left: '8px', right: '8px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        zIndex: 50, overflow: 'hidden', boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
                        marginBottom: '4px',
                    }}>
                        <button onClick={() => { setShowMenu(false); navigate('/admin/profile'); }}
                            style={{ width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: 'inherit' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                            <User size={13} /> My Profile
                        </button>
                        <div style={{ height: '1px', background: 'var(--border-subtle)' }} />
                        <button onClick={() => { setShowMenu(false); handleLogout(); }}
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
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username}</p>
                        <p style={{ fontSize: '9px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Admin Console</p>
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
