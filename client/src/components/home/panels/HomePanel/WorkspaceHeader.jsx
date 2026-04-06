import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronDown, Settings2, SquarePen, UserPlus, Settings, Edit3, LogOut, Rocket, Briefcase, Zap, Palette, Microscope, Globe, Shield, TrendingUp, Lightbulb, Flame, Target, Trophy } from 'lucide-react';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { useToast } from '../../../../contexts/ToastContext';

const ICON_MAP = {
    rocket: <Rocket size={18} />, briefcase: <Briefcase size={18} />, zap: <Zap size={18} />,
    palette: <Palette size={18} />, microscope: <Microscope size={18} />, globe: <Globe size={18} />,
    shield: <Shield size={18} />, trend: <TrendingUp size={18} />, bulb: <Lightbulb size={18} />,
    flame: <Flame size={18} />, target: <Target size={18} />, trophy: <Trophy size={18} />,
};

const WorkspaceHeader = ({
    workspaceName, showWorkspaceMenu, setShowWorkspaceMenu,
    isSelectionMode, setIsSelectionMode, setShowNewDMModal,
    setShowInviteModal, setShowSettingsModal, setShowRenameModal, setNewName,
}) => {
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();
    const { showToast } = useToast();

    const userRole = activeWorkspace?.role?.toLowerCase() || '';
    const isAdmin = userRole === 'admin' || userRole === 'owner';

    const iconBtn = {
        width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: 'none', cursor: 'pointer', borderRadius: '2px',
        color: 'var(--text-muted)', transition: '150ms ease', flexShrink: 0,
    };
    const iconBtnActive = { ...iconBtn, background: 'var(--bg-hover)', color: 'var(--accent)' };

    return (
        <div style={{
            height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 10px 0 14px', borderBottom: '1px solid var(--border-subtle)',
            position: 'relative', userSelect: 'none', fontFamily: 'var(--font)', flexShrink: 0,
            transition: 'background 150ms ease',
        }}>
            {/* Workspace name + chevron */}
            <div
                style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, cursor: 'pointer', minWidth: 0 }}
                onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
            >
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                    {workspaceName}
                </span>
                <ChevronDown
                    size={13}
                    style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 200ms ease', transform: showWorkspaceMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <button
                    style={isSelectionMode ? iconBtnActive : iconBtn}
                    title="Manage Chats"
                    onClick={e => { e.stopPropagation(); setIsSelectionMode(!isSelectionMode); }}
                    onMouseEnter={e => { if (!isSelectionMode) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                    onMouseLeave={e => { if (!isSelectionMode) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                >
                    <Settings2 size={16} />
                </button>
                <button
                    style={iconBtn}
                    title="New Message"
                    onClick={e => { e.stopPropagation(); setShowNewDMModal(true); }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                    <SquarePen size={16} />
                </button>
            </div>

            {/* Dropdown Menu */}
            {showWorkspaceMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowWorkspaceMenu(false)} />
                    <div style={{
                        position: 'absolute', top: '48px', left: '8px', width: '220px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: '2px', zIndex: 50, overflow: 'hidden',
                        animation: 'wsFadeIn 0.15s cubic-bezier(.4,0,.2,1)',
                    }}>
                        {/* Workspace identity */}
                        <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-active)' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '2px', backgroundColor: activeWorkspace?.color || '#b8956a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                                {ICON_MAP[activeWorkspace?.icon?.toLowerCase()] || ICON_MAP.rocket}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {workspaceName}
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px', textTransform: 'capitalize' }}>
                                    {userRole || 'Member'}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ padding: '4px 0' }}>
                            {isAdmin && (
                                <button
                                    style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '9px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                    onClick={() => {
                                        const canInvite = isAdmin || activeWorkspace?.settings?.allowMemberInvite !== false;
                                        if (!canInvite) { showToast('Member invitations are disabled', 'warning'); return; }
                                        setShowInviteModal(true); setShowWorkspaceMenu(false);
                                    }}
                                    disabled={!isAdmin && activeWorkspace?.settings?.allowMemberInvite === false}
                                >
                                    <UserPlus size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    Invite people
                                </button>
                            )}
                            <button
                                style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '9px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                onClick={() => { setShowSettingsModal(true); setShowWorkspaceMenu(false); }}
                            >
                                <Settings size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                Workspace Settings
                            </button>
                            {isAdmin && (
                                <button
                                    style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '9px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                    onClick={() => { setShowRenameModal(true); setShowWorkspaceMenu(false); setNewName(workspaceName); }}
                                >
                                    <Edit3 size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                    Rename Workspace
                                </button>
                            )}
                        </div>

                        {/* Danger zone */}
                        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '4px 0' }}>
                            <button
                                style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--state-danger)', display: 'flex', alignItems: 'center', gap: '9px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                onClick={() => navigate('/workspaces')}
                            >
                                <LogOut size={14} style={{ flexShrink: 0 }} />
                                Sign out of {workspaceName}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default WorkspaceHeader;
