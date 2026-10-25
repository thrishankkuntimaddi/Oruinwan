import React, { useState, useRef, useEffect } from "react";
import { useWorkspaceFeatures } from '../../hooks/useWorkspaceFeatures';
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useNotifications } from "../../features/notifications/NotificationsContext";
import { Home, MessageSquare, CheckSquare, FileText, Newspaper, Hash, Briefcase, Shield, Video, Settings, Settings2, Bot, ChevronDown, Plus, ArrowRight, BookOpen, FolderOpen, LayoutGrid } from "lucide-react";
import { Avatar } from "../../shared/components/ui";
import { WorkspaceIcon } from "../../utils/workspaceIcons";
import "./shell.css";
import { usePlan } from "../../features/plan/usePlan";
import { planBlock, blockedButtonProps, guardAction } from "../../features/plan/planLimit";
import "../../features/plan/plan.css";

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
    const [showMore, setShowMore] = useState(false);
    const moreRef = useRef(null);
    // Free plan: workspaces you created (loaded when the switcher opens).
    const { plan: userPlan } = usePlan(showWorkspaceMenu ? null : false);
    const createBlock = planBlock(userPlan, 'workspaces.create');
    const menuRef = useRef(null);
    const unreadTotals = useNotifications()?.unreadTotals || { dm: 0, channel: 0 };
    const badgeFor = (path) => (path === '/messages' ? unreadTotals.dm : path === '/channels' ? unreadTotals.channel : 0);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowWorkspaceMenu(false);
            }
            if (moreRef.current && !moreRef.current.contains(event.target)) setShowMore(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!showWorkspaceMenu && !showMore) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') { setShowWorkspaceMenu(false); setShowMore(false); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showWorkspaceMenu, showMore]);

    const isActive = (itemPath) => {
        if (!workspaceId) return false;
        const path = location.pathname;
        if (itemPath === "/home") return path.includes(`/workspace/${workspaceId}/home`);
        if (itemPath === "/channels") return path.includes(`/workspace/${workspaceId}/channels`) || path.includes(`/workspace/${workspaceId}/channel/`);
        if (itemPath === "/messages") return (path.includes(`/workspace/${workspaceId}/messages`) || path.includes(`/workspace/${workspaceId}/dm/`)) && !path.includes("/home/");
        if (itemPath === "/agents") return ["/agents", "/apps", "/automations"].some((p) => path.startsWith(`/workspace/${workspaceId}${p}`));
        // Design reviews live in Tasks (Planning), the roadmap in Notes.
        if (itemPath === "/tasks") return ["/tasks", "/reviews"].some((p) => path === `/workspace/${workspaceId}${p}` || path.startsWith(`/workspace/${workspaceId}${p}/`));
        if (itemPath === "/notes") return ["/notes", "/roadmap"].some((p) => path === `/workspace/${workspaceId}${p}` || path.startsWith(`/workspace/${workspaceId}${p}/`));
        const fullPath = `/workspace/${workspaceId}${itemPath}`;
        return path === fullPath || path.startsWith(fullPath + "/");
    };

    const features = useWorkspaceFeatures(workspaceId);
    const navItems = [
        { icon: <Home size={19} strokeWidth={2} />, path: "/home", label: "Home" },
        { icon: <Hash size={19} strokeWidth={2} />, path: "/channels", label: "Channels" },
        { icon: <MessageSquare size={19} strokeWidth={2} />, path: "/messages", label: "Messages" },
        // Tasks, Notes and Huddles disappear when the workspace admins switch them off.
        // Tasks includes Planning → Design reviews; Notes includes the Roadmap tab.
        ...(features.tasks ? [{ icon: <CheckSquare size={19} strokeWidth={2} />, path: "/tasks", label: "Tasks" }] : []),
        ...(features.notes ? [{ icon: <FileText size={19} strokeWidth={2} />, path: "/notes", label: "Notes" }] : []),
        ...(features.huddles ? [{ icon: <Video size={19} strokeWidth={2} />, path: "/huddles", label: "Huddles" }] : []),
        // Everything below lives under More, so the rail keeps to the places used all day.
        // Files: everything shared with you in channels and DMs, plus workspace uploads.
        { icon: <FolderOpen size={19} strokeWidth={2} />, path: "/files", label: "Files", more: true },
        // Knowledge (pages, handbook, graph) had no entry on the desktop rail, so it was only
        // reachable from search or a typed URL.
        { icon: <BookOpen size={19} strokeWidth={2} />, path: "/knowledge", label: "Knowledge", more: true },
        // Agents & tools: AI agents (Claude, ChatGPT…), workflows and apps.
        { icon: <Bot size={19} strokeWidth={2} />, path: "/agents", label: "Agents & tools", also: ["/apps", "/automations"], more: true },
        ...(user?.userType === "company" ? [{ icon: <Newspaper size={19} strokeWidth={2} />, path: "/updates", label: "Updates", more: true }] : []),
        // Workspace Admin: this workspace's owner and admins (company consoles stay below).
        ...(["owner", "admin"].includes(activeWorkspace?.role) || activeWorkspace?.isOwner ? [{ icon: <Settings2 size={19} strokeWidth={2} />, path: "/admin", label: "Workspace admin", more: true }] : []),
        // Company console: owners (and co-owners) land on the owner console, admins on the admin one.
        ...(isCompanyOwner(user) ? [{ icon: <Shield size={19} strokeWidth={2} />, path: "/owner/dashboard", label: "Owner console", absolute: true, more: true }]
            : user?.companyRole === 'admin' ? [{ icon: <Shield size={19} strokeWidth={2} />, path: "/admin/dashboard", label: "Admin console", absolute: true, more: true }] : []),
        ...((user?.companyRole === 'manager' || (user?.managedDepartments && user.managedDepartments.length > 0)) ? [{ icon: <Briefcase size={19} strokeWidth={2} />, path: "/manager/dashboard/overview", label: "Manager", absolute: true, more: true }] : []),
    ];
    const targetOf = (item) => (item.absolute ? item.path : (workspaceId ? `/workspace/${workspaceId}${item.path}` : '/workspaces'));
    const moreItems = navItems.filter((i) => i.more);
    // A More page that's open shows on the rail too, so you can see where you are.
    const railItems = navItems.filter((i) => !i.more || isActive(i.path));
    const moreActive = moreItems.some((i) => isActive(i.path));


    const badge = (n) => (n > 0 ? <span className="gl-shell-badge">{n > 99 ? '99+' : n}</span> : null);

    return (
        <nav className="gl-shell-rail" aria-label="Workspace sections">

            {/* Workspace switcher */}
            <div style={{ position: 'relative', marginBottom: '6px' }} ref={menuRef}>
                <button
                    type="button"
                    className="gl-shell-ws-btn"
                    data-tour="workspace"
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
                            <button type="button" role="menuitem" className="gl-shell-menu-item" {...blockedButtonProps(createBlock)}
                                onClick={guardAction(createBlock, () => { setShowWorkspaceMenu(false); navigate('/workspaces', { state: { createWorkspace: true } }); })}
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
                {railItems.map((item) => {
                    const targetPath = targetOf(item);
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
                                data-tour={item.path.slice(1)}
                            >
                                {item.icon}
                                {badge(count)}
                            </button>
                            <span className="gl-shell-tip" aria-hidden="true">{item.label}</span>
                        </div>
                    );
                })}
                {moreItems.length > 0 && (
                    <div className="gl-shell-tip-host" ref={moreRef} style={{ position: 'relative' }}>
                        <button
                            type="button"
                            className={`gl-shell-rail-btn${moreActive || showMore ? ' is-active' : ''}`}
                            onClick={() => setShowMore((v) => !v)}
                            title="More"
                            aria-label="More: files, knowledge, agents and tools"
                            aria-haspopup="menu"
                            aria-expanded={showMore}
                            data-tour="agents"
                        >
                            <LayoutGrid size={19} strokeWidth={2} />
                        </button>
                        {!showMore && <span className="gl-shell-tip" aria-hidden="true">More</span>}
                        {showMore && (
                            <div className="gl-card gl-shell-popover" role="menu" style={{ left: '46px', top: 0, width: '220px' }}>
                                <div className="gl-shell-menu">
                                    {moreItems.map((item) => (
                                        <button
                                            key={item.path}
                                            type="button"
                                            role="menuitem"
                                            className={`gl-shell-menu-item${isActive(item.path) ? ' is-active' : ''}`}
                                            onClick={() => { setShowMore(false); navigate(targetOf(item)); }}
                                        >
                                            <span style={{ display: 'inline-flex', width: 22, justifyContent: 'center', color: 'var(--text-secondary)' }}>{item.icon}</span>
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
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
                    data-tour="profile"
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
