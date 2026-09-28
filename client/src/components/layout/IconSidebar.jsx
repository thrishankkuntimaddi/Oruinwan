import React, { useState, useRef, useEffect } from "react";
import { useWorkspaceFeatures } from '../../hooks/useWorkspaceFeatures';
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useNotifications } from "../../features/notifications/NotificationsContext";
import { Home, MessageSquare, CheckSquare, FileText, Newspaper, Hash, Briefcase, Shield, Video, Settings, Puzzle, ChevronDown, Plus, ArrowRight } from "lucide-react";
import { Avatar } from "../../shared/components/ui";
import { WorkspaceIcon } from "../../utils/workspaceIcons";
import "./shell.css";

/** Owner of the user's company, or its co-owner (coOwnerOf === companyId), as the server decides. */
export const isCompanyOwner = (user) => {
    if (user?.companyRole === 'owner') return true;
    const companyId = String(user?.companyId?._id || user?.companyId || '');
    return !!companyId && String(user?.coOwnerOf?._id || user?.coOwnerOf || '') === companyId;
};

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
        // Company console: owners (and co-owners) land on the owner console, admins on the admin one.
        ...(isCompanyOwner(user) ? [{ icon: <Shield size={19} strokeWidth={2} />, path: "/owner/dashboard", label: "Owner console", absolute: true }]
            : user?.companyRole === 'admin' ? [{ icon: <Shield size={19} strokeWidth={2} />, path: "/admin/dashboard", label: "Admin console", absolute: true }] : []),
        ...((user?.companyRole === 'manager' || (user?.managedDepartments && user.managedDepartments.length > 0)) ? [{ icon: <Briefcase size={19} strokeWidth={2} />, path: "/manager/dashboard/overview", label: "Manager", absolute: true }] : []),
    ];


    const badge = (n) => (n > 0 ? <span className="gl-shell-badge">{n > 99 ? '99+' : n}</span> : null);

    return (
        <nav className="gl-shell-rail" aria-label="Workspace sections">

            {/* Workspace switcher */}
            <div style={{ position: 'relative', marginBottom: '6px' }} ref={menuRef}>
                <button
                    type="button"
                    className="gl-shell-ws-btn"
                    onClick={() => setShowWorkspaceMenu(s => !s)}
                    title={activeWorkspace?.name || 'Switch Workspace'}
                    aria-label={`Workspace: ${activeWorkspace?.name || 'none'}. Switch workspace`}
                    aria-haspopup="menu"
                    aria-expanded={showWorkspaceMenu}
                    style={{ backgroundColor: activeWorkspace?.color || 'var(--accent)' }}
                >
                    <WorkspaceIcon icon={activeWorkspace?.icon} size={18} />
                    <span className="gl-shell-ws-btn-caret" aria-hidden="true"><ChevronDown size={8} /></span>
                </button>

                {showWorkspaceMenu && (
                    <div className="gl-card gl-shell-popover" role="menu" style={{ left: '46px', top: 0, width: '236px' }}>
                        <div className="gl-shell-menu">
                            <button type="button" role="menuitem" className="gl-shell-menu-item is-accent"
                                onClick={() => { navigate("/workspaces"); setShowWorkspaceMenu(false); }}
                            >
                                <span style={{ flex: 1 }}>Manage Workspaces</span>
                                <ArrowRight size={13} style={{ color: 'var(--accent)' }} />
                            </button>
                        </div>

                        <div className="gl-shell-menu" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                            <div className="gl-shell-menu-label">Switch to</div>
                            {workspaces.map(ws => {
                                const current = ws.id === activeWorkspace?.id;
                                return (
                                    <button
                                        type="button"
                                        role="menuitem"
                                        key={ws.id}
                                        className={`gl-shell-menu-item${current ? ' is-active' : ''}`}
                                        aria-current={current ? 'true' : undefined}
                                        onClick={() => { setActiveWorkspace(ws); setShowWorkspaceMenu(false); navigate(`/workspace/${ws.id}/home`); }}
                                    >
                                        <span className="gl-shell-ws-tile" style={{ width: '22px', height: '22px', backgroundColor: ws.color || 'var(--accent)' }}>
                                            <WorkspaceIcon icon={ws.icon} size={13} />
                                        </span>
                                        <span>{ws.name}</span>
                                        {current && <span className="gl-shell-dot" aria-hidden="true" />}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="gl-shell-menu">
                            <button type="button" role="menuitem" className="gl-shell-menu-item"
                                onClick={() => { setShowWorkspaceMenu(false); navigate('/workspaces', { state: { createWorkspace: true } }); }}
                            >
                                <span style={{ width: '22px', height: '22px', borderRadius: '2px', border: '1px dashed var(--border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Plus size={12} /></span>
                                Create workspace
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="gl-shell-rail-sep" aria-hidden="true" />

            {/* Sections */}
            <div className="gl-shell-rail-nav">
                {navItems.map((item) => {
                    const targetPath = item.absolute
                        ? item.path
                        : (workspaceId ? `/workspace/${workspaceId}${item.path}` : '/workspaces');
                    const active = isActive(item.path);
                    const count = badgeFor(item.path);

                    return (
                        <div key={item.path} className="gl-shell-tip-host">
                            <button
                                type="button"
                                className={`gl-shell-rail-btn${active ? ' is-active' : ''}`}
                                onClick={() => navigate(targetPath)}
                                title={item.label}
                                aria-label={item.label}
                                aria-current={active ? 'page' : undefined}
                            >
                                {item.icon}
                                {badge(count)}
                            </button>
                            <span className="gl-shell-tip" aria-hidden="true">{item.label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Settings + profile */}
            <div className="gl-shell-rail-foot">
                <div className="gl-shell-tip-host">
                    <button
                        type="button"
                        className="gl-shell-rail-btn"
                        onClick={() => navigate("/settings", { state: { from: location.pathname } })}
                        title="Settings"
                        aria-label="Settings"
                    >
                        <Settings size={19} strokeWidth={2} />
                    </button>
                    <span className="gl-shell-tip" aria-hidden="true">Settings</span>
                </div>

                <button
                    type="button"
                    className="gl-shell-avatar-btn"
                    onClick={onProfileClick}
                    title={user?.username || 'Profile'}
                    aria-label={`Profile menu${user?.username ? ` (${user.username})` : ''}`}
                >
                    <Avatar
                        src={user?.profilePicture}
                        fallback={user?.username || "User"}
                        alt={user?.username}
                        status={user?.userStatus === "dnd" ? "busy" : user?.userStatus === "away" ? "away" : "online"}
                        size="sm"
                    />
                </button>
            </div>
        </nav>
    );
};

export default IconSidebar;
