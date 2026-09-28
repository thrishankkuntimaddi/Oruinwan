import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, Settings2, SquarePen, UserPlus, Settings, Edit3, LogOut, Plus, ArrowLeftRight } from 'lucide-react';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { useToast } from '../../../../contexts/ToastContext';
import { WorkspaceIcon } from '../../../../utils/workspaceIcons';

const menuItem = { width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '9px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' };
const hoverOn = e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; };
const hoverOff = e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; };

const WorkspaceHeader = ({
    workspaceName, showWorkspaceMenu, setShowWorkspaceMenu,
    isSelectionMode, setIsSelectionMode, setShowNewDMModal,
    setShowInviteModal, setShowSettingsModal, setShowRenameModal, setNewName,
}) => {
    const navigate = useNavigate();
    const { activeWorkspace, workspaces = [], setActiveWorkspace } = useWorkspace();
    const { showToast } = useToast();
    const [showSwitch, setShowSwitch] = useState(false);
    const otherWorkspaces = workspaces.filter(ws => String(ws.id) !== String(activeWorkspace?.id) && (ws.membershipStatus || 'active') === 'active');

    // Esc closes the menu; it always reopens with the switcher folded.
    useEffect(() => {
        if (!showWorkspaceMenu) { setShowSwitch(false); return undefined; }
        const onKey = (e) => { if (e.key === 'Escape') setShowWorkspaceMenu(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showWorkspaceMenu, setShowWorkspaceMenu]);

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
            {}
            <div
                style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, cursor: 'pointer', minWidth: 0 }}
                onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
                role="button"
                tabIndex={0}
                aria-haspopup="menu"
                aria-expanded={showWorkspaceMenu}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowWorkspaceMenu(!showWorkspaceMenu); } }}
            >
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                    {workspaceName}
                </span>
                <ChevronDown
                    size={13}
                    style={{ color: 'var(--text-muted)', flexShrink: 0, transition: 'transform 200ms ease', transform: showWorkspaceMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
            </div>

            {}
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

            {}
            {showWorkspaceMenu && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowWorkspaceMenu(false)} />
                    <div style={{
                        position: 'absolute', top: '48px', left: '8px', width: '220px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: '2px', zIndex: 50, overflow: 'hidden',
                        animation: 'wsFadeIn 0.15s cubic-bezier(.4,0,.2,1)',
                    }}>
                        {}
                        <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-active)' }}>
                            <div style={{ width: '36px', height: '36px', borderRadius: '2px', backgroundColor: activeWorkspace?.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                                <WorkspaceIcon icon={activeWorkspace?.icon} size={18} />
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

                        {}
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

                        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '4px 0' }}>
                            <button style={menuItem} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                                onClick={() => setShowSwitch(v => !v)} aria-expanded={showSwitch}
                            >
                                <ArrowLeftRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                Switch workspace
                                <ChevronRight size={12} style={{ marginLeft: 'auto', color: 'var(--text-muted)', transition: 'transform 150ms ease', transform: showSwitch ? 'rotate(90deg)' : 'none' }} />
                            </button>
                            {showSwitch && (
                                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                    {otherWorkspaces.length === 0 ? (
                                        <div style={{ padding: '6px 14px 8px 37px', fontSize: '11px', color: 'var(--text-muted)' }}>No other workspaces</div>
                                    ) : otherWorkspaces.map(ws => (
                                        <button key={ws.id} style={{ ...menuItem, padding: '6px 14px 6px 34px' }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                                            onClick={() => { setShowWorkspaceMenu(false); setActiveWorkspace?.(ws); navigate(`/workspace/${ws.id}/home`); }}
                                        >
                                            <span style={{ width: '18px', height: '18px', borderRadius: '2px', background: ws.color || 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <WorkspaceIcon icon={ws.icon} size={11} />
                                            </span>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            <button style={menuItem} onMouseEnter={hoverOn} onMouseLeave={hoverOff}
                                onClick={() => { setShowWorkspaceMenu(false); navigate('/workspaces', { state: { createWorkspace: true } }); }}
                            >
                                <Plus size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                Create workspace
                            </button>
                        </div>

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
