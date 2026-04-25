import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Hash, MessageSquare, FolderOpen, BookOpen, Newspaper, Video,
    Puzzle, Shield, Briefcase, ChevronRight, Bell, LogOut,
    Settings, User, Zap, FileText, CheckSquare, Globe, ChevronDown, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { getAvatarUrl } from '../../utils/avatarUtils';

const STATUS_MAP = {
    active:  { label: 'Active',    dot: '#34d399' },
    away:    { label: 'Away',      dot: '#fbbf24' },
    dnd:     { label: 'Do not disturb', dot: '#f87171' },
    offline: { label: 'Invisible', dot: 'rgba(228,228,228,0.25)' },
};

const QUICK = [
    { id: 'channels', Icon: Hash,         label: 'Channels',  bg: 'rgba(184,149,106,0.12)', path: '/channels'  },
    { id: 'messages', Icon: MessageSquare,label: 'Messages',  bg: 'rgba(52,211,153,0.10)',  path: '/messages'  },
    { id: 'files',    Icon: FolderOpen,   label: 'Files',     bg: 'rgba(167,139,250,0.12)', path: '/files'     },
    { id: 'knowledge',Icon: BookOpen,     label: 'Knowledge', bg: 'rgba(251,191,36,0.10)',  path: '/knowledge' },
];

const MobileHomePage = ({ workspaceId, onProfileClick }) => {
    const navigate     = useNavigate();
    const { user, logout } = useAuth();
    const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();
    const [showWs, setShowWs] = useState(false);

    const go = (path) => navigate(`/workspace/${workspaceId}${path}`);

    const status     = user?.userStatus || 'active';
    const statusCfg  = STATUS_MAP[status] || STATUS_MAP.active;

    
    const MORE_ROWS = [
        { Icon: Newspaper, label: 'Updates',          path: '/updates',                show: user?.userType === 'company' },
        { Icon: Video,     label: 'Meetings',         path: '/huddles',                show: true },
        { Icon: Puzzle,    label: 'Apps',             path: '/apps',                   show: true },
        { Icon: FileText,  label: 'Notes',            path: '/notes',                  show: true },
        { Icon: Shield,    label: 'Admin Dashboard',  abs: '/admin/analytics',         show: ['owner','admin'].includes(user?.companyRole) || user?.isCoOwner },
        { Icon: Briefcase, label: 'Manager Portal',   abs: '/manager/dashboard/overview', show: user?.companyRole === 'manager' || (user?.managedDepartments?.length > 0) },
    ].filter(r => r.show);

    const handleMore = (row) => {
        if (row.abs) navigate(row.abs);
        else go(row.path);
    };

    return (
        <div style={{
            flex: 1, overflowY: 'auto', background: 'var(--bg-base)',
            fontFamily: 'var(--font)', paddingBottom: '70px',
            WebkitOverflowScrolling: 'touch',
        }} className="custom-scrollbar">

            {}
            <div style={{
                margin: '12px 12px 0', padding: '14px',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: '12px',
            }}>
                {}
                <button
                    onClick={onProfileClick}
                    style={{ flexShrink: 0, position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                >
                    <div style={{
                        width: '48px', height: '48px', borderRadius: '50%', overflow: 'hidden',
                        backgroundImage: `url(${getAvatarUrl(user)})`,
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        border: '2px solid var(--border-accent)',
                    }} />
                    <span style={{
                        position: 'absolute', bottom: '1px', right: '1px',
                        width: '11px', height: '11px', borderRadius: '50%',
                        background: statusCfg.dot, border: '2px solid var(--bg-base)',
                    }} />
                </button>

                {}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.username || 'User'}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.email || ''}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusCfg.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>{statusCfg.label}</span>
                    </div>
                </div>

                {}
                <button
                    onClick={onProfileClick}
                    style={{
                        flexShrink: 0, padding: '6px 10px', fontSize: '11px', fontWeight: 600,
                        color: 'var(--accent)', background: 'rgba(184,149,106,0.1)',
                        border: '1px solid rgba(184,149,106,0.25)', cursor: 'pointer',
                        fontFamily: 'var(--font)',
                    }}
                >
                    Profile
                </button>
            </div>

            {}
            <div style={{ margin: '8px 12px 0', position: 'relative' }}>
                <button
                    onClick={() => setShowWs(s => !s)}
                    style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                        cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
                    }}
                >
                    <div style={{
                        width: '24px', height: '24px', borderRadius: '2px', flexShrink: 0,
                        background: activeWorkspace?.color || 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Globe size={13} style={{ color: '#fff' }} />
                    </div>
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activeWorkspace?.name || 'Workspace'}
                    </span>
                    <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: showWs ? 'rotate(180deg)' : 'none', transition: '200ms ease', flexShrink: 0 }} />
                </button>
                {showWs && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderTop: 'none', overflow: 'hidden',
                    }}>
                        {workspaces.map(ws => (
                            <button key={ws.id}
                                onClick={() => { setActiveWorkspace(ws); navigate(`/workspace/${ws.id}/home`); setShowWs(false); }}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                    padding: '10px 12px', background: ws.id === activeWorkspace?.id ? 'var(--bg-hover)' : 'none',
                                    border: 'none', cursor: 'pointer', fontFamily: 'var(--font)',
                                }}
                            >
                                <div style={{ width: '20px', height: '20px', borderRadius: '2px', background: ws.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Globe size={11} style={{ color: '#fff' }} />
                                </div>
                                <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', flex: 1, textAlign: 'left' }}>{ws.name}</span>
                                {ws.id === activeWorkspace?.id && <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />}
                            </button>
                        ))}
                        <button
                            onClick={() => { navigate('/workspaces'); setShowWs(false); }}
                            style={{ width: '100%', padding: '9px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', borderTop: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left' }}
                        >
                            Manage Workspaces →
                        </button>
                    </div>
                )}
            </div>

            {}
            <div style={{ margin: '16px 12px 0' }}>
                <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Quick Access
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    {QUICK.map(({ id, Icon, label, bg, path }) => (
                        <button
                            key={id}
                            onClick={() => go(path)}
                            style={{
                                display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                gap: '10px', padding: '14px', background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)', cursor: 'pointer',
                                fontFamily: 'var(--font)', textAlign: 'left',
                                transition: 'border-color 150ms ease, background 150ms ease',
                                WebkitTapHighlightColor: 'transparent',
                            }}
                            onTouchStart={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                            onTouchEnd={e => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.borderColor = 'var(--border-subtle)'; }}
                        >
                            <div style={{ width: '36px', height: '36px', borderRadius: '2px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Icon size={18} style={{ color: 'var(--accent)' }} />
                            </div>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {}
            {MORE_ROWS.length > 0 && (
                <div style={{ margin: '16px 12px 0' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        More
                    </div>
                    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                        {MORE_ROWS.map(({ Icon, label, path, abs }, i) => (
                            <button
                                key={label}
                                onClick={() => handleMore({ path, abs })}
                                style={{
                                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '13px 14px', background: 'none', border: 'none',
                                    borderBottom: i < MORE_ROWS.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                                    cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left',
                                    WebkitTapHighlightColor: 'transparent',
                                }}
                                onTouchStart={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onTouchEnd={e => e.currentTarget.style.background = 'none'}
                            >
                                <Icon size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
                                <ChevronRight size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {}
            <div style={{ margin: '16px 12px 0', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', overflow: 'hidden' }}>
                <button
                    onClick={() => navigate('/settings')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font)', WebkitTapHighlightColor: 'transparent' }}
                    onTouchStart={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onTouchEnd={e => e.currentTarget.style.background = 'none'}
                >
                    <Settings size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left' }}>Settings</span>
                    <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
                </button>
                <button
                    onClick={onProfileClick}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font)', WebkitTapHighlightColor: 'transparent' }}
                    onTouchStart={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onTouchEnd={e => e.currentTarget.style.background = 'none'}
                >
                    <User size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left' }}>Edit Profile</span>
                    <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
                </button>
                <button
                    onClick={() => window.location.reload()}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', background: 'none', border: 'none', borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer', fontFamily: 'var(--font)', WebkitTapHighlightColor: 'transparent' }}
                    onTouchStart={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onTouchEnd={e => e.currentTarget.style.background = 'none'}
                >
                    <RefreshCw size={17} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', textAlign: 'left' }}>Refresh App</span>
                </button>
                <button
                    onClick={() => logout()}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', WebkitTapHighlightColor: 'transparent' }}
                    onTouchStart={e => e.currentTarget.style.background = 'rgba(248,113,113,0.06)'}
                    onTouchEnd={e => e.currentTarget.style.background = 'none'}
                >
                    <LogOut size={17} style={{ color: '#f87171', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#f87171', textAlign: 'left' }}>Sign Out</span>
                </button>
            </div>
        </div>
    );
};

export default MobileHomePage;
