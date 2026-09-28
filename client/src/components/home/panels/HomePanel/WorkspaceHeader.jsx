import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, UserPlus, Settings, Edit3, LogOut, Plus, ArrowLeftRight } from 'lucide-react';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';
import { useToast } from '../../../../contexts/ToastContext';
import { WorkspaceIcon } from '../../../../utils/workspaceIcons';
import '../../../layout/shell.css';

/**
 * The workspace menu that drops from the Home panel's title (invite, settings,
 * rename, switch, create, sign out). Rendered inside the WorkspacePanel header
 * (headerExtra), so it anchors to the header.
 */
const WorkspaceHeader = ({
    workspaceName, showWorkspaceMenu, setShowWorkspaceMenu,
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

    if (!showWorkspaceMenu) return null;

    const userRole = activeWorkspace?.role?.toLowerCase() || '';
    const isAdmin = userRole === 'admin' || userRole === 'owner';

    return (
        <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowWorkspaceMenu(false)} />
            <div className="gl-card gl-shell-popover" role="menu" aria-label="Workspace menu"
                style={{ top: 'calc(var(--ws-panel-head-h) - 4px)', left: '8px', width: '240px', zIndex: 50 }}
            >
                <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '10px', backgroundImage: 'var(--gl-glass)' }}>
                    <span className="gl-shell-ws-tile" style={{ width: '34px', height: '34px', backgroundColor: activeWorkspace?.color || 'var(--accent)' }}>
                        <WorkspaceIcon icon={activeWorkspace?.icon} size={17} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 650, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                            {workspaceName}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', marginTop: '1px', textTransform: 'capitalize' }}>
                            {userRole || 'Member'}
                        </div>
                    </div>
                </div>

                <div className="gl-shell-menu">
                    {isAdmin && (
                        <button type="button" role="menuitem" className="gl-shell-menu-item"
                            onClick={() => {
                                const canInvite = isAdmin || activeWorkspace?.settings?.allowMemberInvite !== false;
                                if (!canInvite) { showToast('Member invitations are disabled', 'warning'); return; }
                                setShowInviteModal(true); setShowWorkspaceMenu(false);
                            }}
                            disabled={!isAdmin && activeWorkspace?.settings?.allowMemberInvite === false}
                        >
                            <UserPlus size={14} />
                            Invite people
                        </button>
                    )}
                    <button type="button" role="menuitem" className="gl-shell-menu-item"
                        onClick={() => { setShowSettingsModal(true); setShowWorkspaceMenu(false); }}
                    >
                        <Settings size={14} />
                        Workspace Settings
                    </button>
                    {isAdmin && (
                        <button type="button" role="menuitem" className="gl-shell-menu-item"
                            onClick={() => { setShowRenameModal(true); setShowWorkspaceMenu(false); setNewName(workspaceName); }}
                        >
                            <Edit3 size={14} />
                            Rename Workspace
                        </button>
                    )}
                </div>

                <div className="gl-shell-menu">
                    <button type="button" role="menuitem" className="gl-shell-menu-item"
                        onClick={() => setShowSwitch(v => !v)} aria-expanded={showSwitch}
                    >
                        <ArrowLeftRight size={14} />
                        Switch workspace
                        <ChevronRight size={12} style={{ marginLeft: 'auto', transition: 'transform 150ms ease', transform: showSwitch ? 'rotate(90deg)' : 'none' }} />
                    </button>
                    {showSwitch && (
                        <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                            {otherWorkspaces.length === 0 ? (
                                <div style={{ padding: '4px 8px 8px 31px', fontSize: '11px', color: 'var(--text-secondary)' }}>No other workspaces</div>
                            ) : otherWorkspaces.map(ws => (
                                <button type="button" role="menuitem" key={ws.id} className="gl-shell-menu-item" style={{ paddingLeft: '28px' }}
                                    onClick={() => { setShowWorkspaceMenu(false); setActiveWorkspace?.(ws); navigate(`/workspace/${ws.id}/home`); }}
                                >
                                    <span className="gl-shell-ws-tile" style={{ width: '18px', height: '18px', background: ws.color || 'var(--accent)' }}>
                                        <WorkspaceIcon icon={ws.icon} size={11} />
                                    </span>
                                    <span>{ws.name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                    <button type="button" role="menuitem" className="gl-shell-menu-item"
                        onClick={() => { setShowWorkspaceMenu(false); navigate('/workspaces', { state: { createWorkspace: true } }); }}
                    >
                        <Plus size={14} />
                        Create workspace
                    </button>
                </div>

                <div className="gl-shell-menu">
                    <button type="button" role="menuitem" className="gl-shell-menu-item is-danger"
                        onClick={() => navigate('/workspaces')}
                    >
                        <LogOut size={14} />
                        <span>Sign out of {workspaceName}</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default WorkspaceHeader;
