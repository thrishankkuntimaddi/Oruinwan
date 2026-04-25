import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Users, Settings,
    Globe, LogOut, Building, Shield, Activity, CreditCard,
    UserPlus, HelpCircle, Briefcase, GitBranch, LayoutTemplate, Lock, UsersRound,
    BarChart2, ClipboardList, ShieldCheck, ChevronUp
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const OwnerSidebar = ({ onNavigate }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const hasWorkspaces = user?.workspaces?.length > 0;

    const navGroups = [
        {
            group: 'OVERVIEW',
            items: [
                { path: '/owner/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { path: '/owner/analytics', label: 'Activity Health', icon: Activity },
                { path: '/owner/billing', label: 'Billing & Plan', icon: CreditCard },
                { path: '/owner/security', label: 'Security & Risk', icon: Shield },
            ]
        },
        {
            group: 'ORGANIZATION',
            items: [
                { path: '/owner/admins', label: 'Admin', icon: Shield },
                { path: '/owner/workspaces', label: 'Workspaces', icon: Briefcase },
                { path: '/owner/departments', label: 'Departments', icon: Building },
                { path: '/owner/users', label: 'People', icon: Users },
                { path: '/owner/onboard', label: 'Onboard', icon: UserPlus },
            ]
        },
        {
            group: 'COLLABORATION',
            items: [
                { path: '/owner/teams', label: 'Teams', icon: UsersRound },
                { path: '/owner/org-chart', label: 'Org Chart', icon: GitBranch },
                { path: '/owner/employees', label: 'Employees', icon: Users },
                { path: '/owner/workspace-templates', label: 'WS Templates', icon: LayoutTemplate },
                { path: '/owner/workspace-permissions', label: 'WS Permissions', icon: Lock },
            ]
        },
        {
            group: 'GOVERNANCE',
            items: [
                { path: '/owner/permission-matrix', label: 'Permission Matrix', icon: Shield },
                { path: '/owner/audit-logs', label: 'Audit Logs', icon: ClipboardList },
                { path: '/owner/compliance-logs', label: 'Compliance Logs', icon: ShieldCheck },
            ]
        },
        {
            group: 'SYSTEM',
            items: [
                { path: '/owner/settings', label: 'Settings', icon: Settings },
                { path: '/contact-admin', label: 'Contact Admin', icon: HelpCircle },
                ...(hasWorkspaces ? [{ path: '/workspaces', label: 'Go to App', icon: Globe }] : [])
            ]
        }
    ];

    const isActive = (path) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside style={{
            width: '240px',
            background: 'var(--bg-surface)',
            borderRight: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            position: 'sticky',
            top: 0,
            zIndex: 20,
            flexShrink: 0,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}>
            {}
            <div style={{
                height: '64px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '0 20px',
                borderBottom: '1px solid var(--border-subtle)',
                flexShrink: 0
            }}>
                <img
                    src="/chttrix-logo.jpg"
                    alt="Chttrix Logo"
                    style={{ width: '28px', height: '28px', objectFit: 'cover', flexShrink: 0 }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span style={{
                        fontSize: '14px', fontWeight: 600,
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.015em',
                        lineHeight: 1.2
                    }}>
                        Chttrix
                    </span>
                    <span style={{
                        fontSize: '10px', fontWeight: 700,
                        color: 'var(--text-muted)',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        lineHeight: 1.4,
                        marginTop: '2px'
                    }}>
                        Owner Console
                    </span>
                </div>
            </div>

            {}
            <nav style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px 12px'
            }} className="custom-scrollbar">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {navGroups.map((group) => (
                        <div key={group.group}>
                            <h3 style={{
                                fontSize: '10px', fontWeight: 700,
                                color: 'var(--text-muted)',
                                letterSpacing: '0.13em',
                                textTransform: 'uppercase',
                                padding: '0 8px',
                                marginBottom: '4px'
                            }}>
                                {group.group}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                {group.items.map((item) => {
                                    const active = isActive(item.path);
                                    return (
                                        <NavItem
                                            key={item.path}
                                            item={item}
                                            active={active}
                                            onClick={() => { navigate(item.path); onNavigate?.(); }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </nav>

            {}
            <div style={{ padding: '12px', borderTop: '1px solid var(--border-subtle)', position: 'relative', flexShrink: 0 }}>
                {showUserMenu && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '12px',
                        right: '12px',
                        marginBottom: '4px',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        overflow: 'hidden',
                        animation: 'slideUp 220ms cubic-bezier(0.16,1,0.3,1)',
                        zIndex: 50
                    }}>
                        <LogoutBtn onClick={handleLogout} />
                    </div>
                )}
                <ProfileBtn
                    user={user}
                    showUserMenu={showUserMenu}
                    onToggle={() => setShowUserMenu(!showUserMenu)}
                    role="Workspace Owner"
                />
            </div>
        </aside>
    );
};

const NavItem = ({ item, active, onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px',
                background: active ? 'var(--bg-active)' : (hov ? 'var(--bg-hover)' : 'transparent'),
                border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
                borderLeft: active ? `2px solid var(--accent)` : '2px solid transparent',
                color: active ? 'var(--text-primary)' : (hov ? 'var(--text-primary)' : 'var(--text-secondary)'),
                fontSize: '13px', fontWeight: active ? 500 : 400,
                textAlign: 'left', cursor: 'pointer',
                transition: 'color 150ms ease, background 150ms ease'
            }}
        >
            <item.icon size={14} style={{ color: active ? 'var(--accent)' : (hov ? 'var(--text-primary)' : 'var(--text-muted)'), flexShrink: 0 }} />
            <span>{item.label}</span>
        </button>
    );
};

const ProfileBtn = ({ user, showUserMenu, onToggle, role }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onToggle}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px',
                background: hov ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 150ms ease'
            }}
        >
            <div style={{
                width: '32px', height: '32px',
                background: 'var(--bg-active)',
                border: '1px solid var(--border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, color: 'var(--accent)',
                flexShrink: 0
            }}>
                {user?.username?.charAt(0)?.toUpperCase() || 'O'}
            </div>
            <div style={{ flex: 1, overflow: 'hidden', textAlign: 'left' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.username}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--accent)', margin: 0, fontWeight: 700, letterSpacing: '0.04em' }}>
                    {role}
                </p>
            </div>
            <ChevronUp size={14} style={{
                color: 'var(--text-muted)',
                transform: showUserMenu ? 'rotate(0deg)' : 'rotate(180deg)',
                transition: 'transform 150ms ease',
                flexShrink: 0
            }} />
        </button>
    );
};

const LogoutBtn = ({ onClick }) => {
    const [hov, setHov] = React.useState(false);
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHov(true)}
            onMouseLeave={() => setHov(false)}
            style={{
                width: '100%', padding: '12px 16px',
                background: hov ? 'var(--bg-hover)' : 'transparent',
                border: 'none',
                color: 'var(--state-danger)',
                fontSize: '13px', fontWeight: 500,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
                textAlign: 'left',
                transition: 'background 150ms ease'
            }}
        >
            <LogOut size={14} />
            Logout
        </button>
    );
};

export default OwnerSidebar;
