import React, { useState, useRef, useEffect } from "react";
import { useWorkspaceFeatures } from '../../hooks/useWorkspaceFeatures';
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useNotifications } from "../../features/notifications/NotificationsContext";
import { Home, MessageSquare, CheckSquare, FileText, Newspaper, Hash, Briefcase, Shield, Video, Settings, Puzzle, ChevronDown, Plus } from "lucide-react";
import { Avatar } from "../../shared/components/ui";
import { WorkspaceIcon } from "../../utils/workspaceIcons";
import { COUNT_BADGE_STYLE } from "../../features/notifications/notificationTypes";

const IconSidebar = ({ onProfileClick }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuth();
    const { workspaces, activeWorkspace, setActiveWorkspace } = useWorkspace();

    const workspaceId = activeWorkspace?.id;
    const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
    const menuRef = useRef(null);
    const unreadTotals = useNotifications()?.unreadTotals || { dm: 0, channel: 0 };
    const badgeFor = (path) => (path === '/messages' ? unreadTotals.dm : path === '/channels' ? unreadTotals.channel : 0);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowWorkspaceMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!showWorkspaceMenu) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setShowWorkspaceMenu(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showWorkspaceMenu]);

    const isActive = (itemPath) => {
        if (!workspaceId) return false;
        const path = location.pathname;
        if (itemPath === "/home") return path.includes(`/workspace/${workspaceId}/home`);
        if (itemPath === "/channels") return path.includes(`/workspace/${workspaceId}/channels`) || path.includes(`/workspace/${workspaceId}/channel/`);
        if (itemPath === "/messages") return (path.includes(`/workspace/${workspaceId}/messages`) || path.includes(`/workspace/${workspaceId}/dm/`)) && !path.includes("/home/");
        const fullPath = `/workspace/${workspaceId}${itemPath}`;
        return path === fullPath || path.startsWith(fullPath + "/");
    };

    const features = useWorkspaceFeatures(workspaceId);
    const navItems = [
        { icon: <Home size={19} strokeWidth={2} />, path: "/home", label: "Home" },
        { icon: <Hash size={19} strokeWidth={2} />, path: "/channels", label: "Channels" },
        { icon: <MessageSquare size={19} strokeWidth={2} />, path: "/messages", label: "Messages" },
        // Tasks, Notes and Huddles disappear when the workspace admins switch them off.
        ...(features.tasks ? [{ icon: <CheckSquare size={19} strokeWidth={2} />, path: "/tasks", label: "Tasks" }] : []),
        ...(features.notes ? [{ icon: <FileText size={19} strokeWidth={2} />, path: "/notes", label: "Notes" }] : []),
        ...(features.huddles ? [{ icon: <Video size={19} strokeWidth={2} />, path: "/huddles", label: "Huddles" }] : []),
        { icon: <Puzzle size={19} strokeWidth={2} />, path: "/apps", label: "Apps" },
        ...(user?.userType === "company" ? [{ icon: <Newspaper size={19} strokeWidth={2} />, path: "/updates", label: "Updates" }] : []),
        ...((['owner', 'admin'].includes(user?.companyRole) || user?.isCoOwner) ? [{ icon: <Shield size={19} strokeWidth={2} />, path: "/admin/analytics", label: "Admin", absolute: true }] : []),
        ...((user?.companyRole === 'manager' || (user?.managedDepartments && user.managedDepartments.length > 0)) ? [{ icon: <Briefcase size={19} strokeWidth={2} />, path: "/manager/dashboard/overview", label: "Manager", absolute: true }] : []),
    ];

    
    const btnBase = {
        width: '36px', height: '36px', borderRadius: '2px', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: 'none',
        border: 'none', cursor: 'pointer', transition: 'background 150ms ease, color 150ms ease',
        color: 'var(--text-muted)',
    };
    const btnActive = { ...btnBase, background: 'var(--bg-hover)', color: 'var(--accent)' };

    return (
        <div style={{
            width: '52px', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', paddingTop: '10px', paddingBottom: '8px',
            borderRight: '1px solid var(--border-subtle)', zIndex: 50,
            position: 'relative', flexShrink: 0, fontFamily: 'var(--font)',
        }}>

            {}
            <div style={{ position: 'relative', marginBottom: '10px' }} ref={menuRef}>
                <button
                    onClick={() => setShowWorkspaceMenu(s => !s)}
                    title={activeWorkspace?.name || 'Switch Workspace'}
                    style={{
                        width: '36px', height: '36px', borderRadius: '2px', border: 'none', cursor: 'pointer',
                        backgroundColor: activeWorkspace?.color || 'var(--accent)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', position: 'relative', transition: 'opacity 150ms ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    <WorkspaceIcon icon={activeWorkspace?.icon} size={18} />

                    {}
                    <div style={{
                        position: 'absolute', bottom: '-3px', right: '-3px',
                        width: '12px', height: '12px', borderRadius: '50%',
                        background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <ChevronDown size={7} style={{ color: 'var(--text-muted)' }} />
                    </div>
                </button>

                {}
                {showWorkspaceMenu && (
                    <div style={{
                        position: 'absolute', left: '46px', top: 0, width: '220px',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: '2px', zIndex: 100, overflow: 'hidden',
                        animation: 'wsFadeIn 0.15s cubic-bezier(.4,0,.2,1)',
                    }}>
                        {}
                        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                            <button
                                onClick={() => { navigate("/workspaces"); setShowWorkspaceMenu(false); }}
                                style={{ width: '100%', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: '150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                            >
                                <span>Manage Workspaces</span>
                                <span>→</span>
                            </button>
                        </div>

                        {}
                        <div style={{ padding: '4px 0' }}>
                            <div style={{ padding: '4px 12px', fontSize: '9px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Switch to</div>
                            {workspaces.map(ws => (
                                <button
                                    key={ws.id}
                                    onClick={() => { setActiveWorkspace(ws); setShowWorkspaceMenu(false); navigate(`/workspace/${ws.id}/home`); }}
                                    style={{ width: '100%', textAlign: 'left', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', background: ws.id === activeWorkspace?.id ? 'var(--bg-hover)' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = ws.id === activeWorkspace?.id ? 'var(--bg-hover)' : 'none'}
                                >
                                    <div style={{ width: '22px', height: '22px', borderRadius: '2px', backgroundColor: ws.color || 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                                        <WorkspaceIcon icon={ws.icon} size={13} />
                                    </div>
                                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                                    {ws.id === activeWorkspace?.id && (
                                        <div style={{ marginLeft: 'auto', width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                                    )}
                                </button>
                            ))}
                        </div>
                        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '4px 0' }}>
                            <button
                                onClick={() => { setShowWorkspaceMenu(false); navigate('/workspaces', { state: { createWorkspace: true } }); }}
                                style={{ width: '100%', textAlign: 'left', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', transition: '150ms ease' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                <span style={{ width: '22px', height: '22px', borderRadius: '2px', border: '1px dashed var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={12} /></span>
                                Create workspace
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', alignItems: 'center', overflowY: 'auto', padding: '2px 0' }} className="no-scrollbar">
                {navItems.map((item) => {
                    const targetPath = item.absolute
                        ? item.path
                        : (workspaceId ? `/workspace/${workspaceId}${item.path}` : '/workspaces');
                    const active = isActive(item.path);

                    return (
                        <div key={item.path} style={{ position: 'relative' }} className="group">
                            <button
                                onClick={() => navigate(targetPath)}
                                style={active ? btnActive : btnBase}
                                onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                                onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                                title={item.label}
                            >
                                {}
                                {active && (
                                    <div style={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: '2px', background: 'var(--accent)', borderRadius: '0 2px 2px 0' }} />
                                )}
                                {item.icon}
                                {badgeFor(item.path) > 0 && (
                                    <span style={{ ...COUNT_BADGE_STYLE, position: 'absolute', top: '4px', right: '4px', minWidth: '14px', height: '14px', fontFamily: 'var(--font)', pointerEvents: 'none' }}>
                                        {badgeFor(item.path) > 99 ? '99+' : badgeFor(item.path)}
                                    </span>
                                )}
                            </button>
                            {}
                            <div style={{
                                position: 'absolute', left: '44px', top: '50%', transform: 'translateY(-50%)',
                                background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                                color: 'var(--text-primary)', fontSize: '11px', fontWeight: 500,
                                padding: '4px 8px', borderRadius: '2px', whiteSpace: 'nowrap',
                                pointerEvents: 'none', zIndex: 50, opacity: 0, transition: 'opacity 100ms ease',
                                fontFamily: 'var(--font)',
                            }} className="group-hover:opacity-100">
                                {item.label}
                            </div>
                        </div>
                    );
                })}
            </div>

            {}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', paddingTop: '8px' }}>
                {}
                <div style={{ position: 'relative' }} className="group">
                    <button
                        onClick={() => navigate("/settings", { state: { from: location.pathname } })}
                        style={btnBase}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Settings"
                    >
                        <Settings size={19} strokeWidth={2} />
                    </button>
                    <div style={{
                        position: 'absolute', left: '44px', top: '50%', transform: 'translateY(-50%)',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)', fontSize: '11px', fontWeight: 500,
                        padding: '4px 8px', borderRadius: '2px', whiteSpace: 'nowrap',
                        pointerEvents: 'none', zIndex: 50, opacity: 0, transition: 'opacity 100ms ease',
                        fontFamily: 'var(--font)',
                    }} className="group-hover:opacity-100">
                        Settings
                    </div>
                </div>

                {}
                <div onClick={onProfileClick} style={{ cursor: 'pointer', transition: 'opacity 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    title={user?.username || 'Profile'}
                >
                    <Avatar
                        src={user?.profilePicture}
                        fallback={user?.username || "User"}
                        alt={user?.username}
                        status={user?.userStatus === "dnd" ? "busy" : user?.userStatus === "away" ? "away" : "online"}
                        size="sm"
                    />
                </div>
            </div>
        </div>
    );
};

export default IconSidebar;
