import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import IconSidebar from "./IconSidebar";
import ProfileMenu from "../SidebarComp/ProfileSidebar";
import ChttrixAIChat from "../ai/ChttrixAIChat/ChttrixAIChat";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useNotifications, notificationHref } from "../../features/notifications/NotificationsContext";
import { notificationTypeMeta, timeAgo } from "../../features/notifications/notificationTypes";
import SearchInlineBar from "../search/SearchInlineBar";
import MobileBottomNav from "./MobileBottomNav";
import MobileHomePage from "./MobileHomePage";
import { useIsMobile } from "../../hooks/useIsMobile";
import HelpButton from "../help/HelpButton";
import { Bot, X, Loader2, Bell, Check, Trash2, ChevronLeft, AlertCircle, RefreshCcw } from "lucide-react";
import "./shell.css";

const WorkspaceNotificationPanel = () => {
    const [open, setOpen] = useState(false);
    const [confirmClear, setConfirmClear] = useState(false);
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();

    const notifCtx = useNotifications();

    const notifications = notifCtx?.notifications || [];
    const unreadCount = notifCtx?.unreadCount || 0;
    const loading = notifCtx?.loading || false;
    const error = notifCtx?.error || null;
    const markAllRead = notifCtx?.markAllRead || (() => { });
    const dismiss = notifCtx?.dismiss || (() => { });
    const markRead = notifCtx?.markRead || (() => { });

    const preview = notifications.slice(0, 8);

    const close = () => { setOpen(false); setConfirmClear(false); };

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const handleClickNotif = (n) => {
        if (!n.read) markRead(n._id);
        const href = notificationHref(n, activeWorkspace?.id);
        if (href) navigate(href);
        close();
    };

    const doClearAll = async () => {
        const ok = await notifCtx?.clearAll?.();
        if (ok !== false) setConfirmClear(false);
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                type="button"
                className="gl-icon-btn"
                onClick={() => (open ? close() : setOpen(true))}
                title="Notifications"
                aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                <Bell size={17} strokeWidth={2} />
                {unreadCount > 0 && (
                    <span className="gl-shell-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>

            {open && <div className="gl-shell-scrim" onClick={close} />}

            {open && (
                <div role="dialog" aria-label="Notifications" className="gl-card gl-shell-popover" style={{ top: '38px', right: 0, width: '340px', maxWidth: 'calc(100vw - 16px)' }}>
                    <div className="gl-shell-popover-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                            <Bell size={13} />
                            <span className="gl-shell-popover-title">Notifications</span>
                            {unreadCount > 0 && <span className="gl-count" style={{ color: 'var(--accent)', background: 'var(--gl-accent-soft)' }}>{unreadCount} new</span>}
                        </div>
                        {unreadCount > 0 && (
                            <button type="button" onClick={markAllRead} className="gl-shell-link">
                                <Check size={11} /> All read
                            </button>
                        )}
                    </div>

                    <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                        {loading && notifications.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                                <Loader2 size={16} className="animate-spin" />
                            </div>
                        ) : error && notifications.length === 0 ? (
                            <div role="alert" className="gl-empty">
                                <AlertCircle size={20} style={{ color: 'var(--state-danger)' }} />
                                <p className="gl-empty-title">Couldn’t load notifications</p>
                                <p className="gl-empty-text">{error}</p>
                                <button type="button" className="gl-btn gl-btn--sm" style={{ marginTop: '6px' }} onClick={() => notifCtx?.refresh?.()}>
                                    <RefreshCcw size={11} /> Try again
                                </button>
                            </div>
                        ) : preview.length === 0 ? (
                            <div className="gl-empty">
                                <span className="gl-empty-mark" aria-hidden="true"><Bell size={18} /></span>
                                <p className="gl-empty-title">All caught up!</p>
                                <p className="gl-empty-text">No new notifications</p>
                            </div>
                        ) : preview.map(n => {
                            const { Icon, color } = notificationTypeMeta(n.type);
                            return (
                                <div
                                    key={n._id}
                                    className={`gl-shell-notif-row${n.read ? '' : ' is-unread'}`}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => handleClickNotif(n)}
                                    onKeyDown={e => { if (e.key === 'Enter') handleClickNotif(n); }}
                                >
                                    <div className="gl-shell-notif-icon" style={{ color }}>
                                        <Icon size={13} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <p style={{ fontSize: '12px', fontWeight: n.read ? 400 : 600, color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{n.title}</p>
                                            {!n.read && <span style={{ flexShrink: 0, width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />}
                                        </div>
                                        {n.body && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '2px 0 0' }}>{n.body}</p>}
                                        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.75, margin: '2px 0 0', fontWeight: 500 }}>{timeAgo(n.createdAt)}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); dismiss(n._id); }}
                                        onKeyDown={e => e.stopPropagation()}
                                        className="gl-icon-btn gl-shell-notif-dismiss"
                                        title="Dismiss"
                                        aria-label={`Dismiss: ${n.title}`}
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <div className="gl-shell-popover-foot">
                        {confirmClear ? (
                            <>
                                <span style={{ fontSize: '11px', color: 'var(--text-primary)' }}>Clear all notifications?</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button type="button" onClick={() => setConfirmClear(false)} className="gl-shell-link">Cancel</button>
                                    <button type="button" onClick={doClearAll} className="gl-shell-link is-danger">
                                        <Trash2 size={10} /> Clear
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="gl-shell-link is-accent"
                                    onClick={() => { close(); navigate(`/workspace/${activeWorkspace?.id}/notifications`); }}
                                >
                                    View all notifications
                                </button>
                                {notifications.length > 0 && (
                                    <button type="button" onClick={() => setConfirmClear(true)} className="gl-shell-link gl-shell-link--danger-hover" title="Clear all">
                                        <Trash2 size={10} /> Clear all
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const PANEL_W_KEY = 'ws-panel-w';
const PANEL_W_MIN = 220;
const PANEL_W_MAX = 420;
const RAIL_W = 52;
const clampPanelW = (w) => Math.min(PANEL_W_MAX, Math.max(PANEL_W_MIN, Math.round(w)));

/** The width the user dragged the side panel to (null = the design default). */
const readPanelW = () => {
    try {
        const raw = Number(localStorage.getItem(PANEL_W_KEY));
        return Number.isFinite(raw) && raw > 0 ? clampPanelW(raw) : null;
    } catch {
        return null;
    }
};

const MainLayout = ({ children, sidePanel }) => {
    const { activeWorkspace } = useWorkspace();
    const [showProfile, setShowProfile] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [aiPrompt, setAIPrompt] = useState(null);

    // The composer's AI button and /ai command open the assistant (optionally with a question).
    useEffect(() => {
        const open = (e) => { setShowAI(true); if (e.detail?.prompt) setAIPrompt(e.detail.prompt); };
        window.addEventListener('chttrix-ai:open', open);
        return () => window.removeEventListener('chttrix-ai:open', open);
    }, []);
    const [aiWidth, setAiWidth] = useState(350);
    // One width for every side panel (Home, Channels, Messages, Notes…): the
    // CSS variable --ws-panel-w on the layout root. Dragging the handle changes
    // it for all sections and it is remembered across sessions.
    const [panelW, setPanelW] = useState(readPanelW);
    const panelWRef = useRef(panelW);
    const [isResizingPanel, setIsResizingPanel] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const isMobile = useIsMobile(768);


    const workspaceId = activeWorkspace?.id || activeWorkspace?._id;
    const currentPath = location.pathname;
    const isDetailRoute = !!workspaceId && (
        currentPath.includes('/channel/') ||
        currentPath.includes('/dm/') ||
        currentPath.includes('/thread/') ||
        currentPath.includes('/task/') ||
        currentPath.includes('/note/')
    );


    const isMobileHome = isMobile && !isDetailRoute && !!workspaceId &&
        (currentPath === `/workspace/${workspaceId}/home` ||
         currentPath === `/workspace/${workspaceId}`);


    const getMobileSectionTitle = () => {
        if (!workspaceId) return activeWorkspace?.name || 'Oruinwan';
        const p = currentPath;
        if (p.includes('/channels') || p.includes('/channel/')) return 'Channels';
        if (p.includes('/messages') || p.includes('/dm/'))      return 'Messages';
        if (p.includes('/tasks')    || p.includes('/task/'))    return 'Tasks';
        if (p.includes('/notes')    || p.includes('/note/'))    return 'Notes';
        if (p.includes('/files'))                               return 'Files';
        if (p.includes('/knowledge'))                           return 'Knowledge';
        if (p.includes('/huddles'))                             return 'Huddles';
        if (p.includes('/updates'))                             return 'Updates';
        if (p.includes('/apps'))                                return 'Apps';
        if (p.includes('/settings'))                            return 'Settings';
        if (p.includes('/admin'))                               return 'Admin';
        if (p.includes('/manager'))                             return 'Manager';
        return activeWorkspace?.name || 'Oruinwan';
    };


    const getMobileBackPath = () => {
        const base = `/workspace/${workspaceId}`;
        if (currentPath.includes('/channel/'))  return `${base}/channels`;
        if (currentPath.includes('/dm/'))       return `${base}/messages`;
        if (currentPath.includes('/task/'))     return `${base}/tasks`;
        if (currentPath.includes('/note/'))     return `${base}/notes`;
        if (currentPath.includes('/thread/'))   return -1;
        return `${base}/home`;
    };

    const handleMobileBack = () => {
        const backPath = getMobileBackPath();
        if (backPath === -1) navigate(-1);
        else navigate(backPath);
    };


    useEffect(() => {
        const fn = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'KeyA') {
                e.preventDefault();
                setShowAI(prev => !prev);
            }
        };
        window.addEventListener('keydown', fn);
        return () => window.removeEventListener('keydown', fn);
    }, []);


    useEffect(() => {
        if (workspaceId) localStorage.setItem('lastWorkspaceId', workspaceId);
    }, [workspaceId]);



    useEffect(() => {
        if (location.state?.openAI && isMobile) {
            setShowAI(true);

            navigate(location.pathname, { replace: true, state: {} });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state?.openAI]);


    const isResizingAIRef = useRef(false);
    const isResizingSidePanelRef = useRef(false);


    useEffect(() => {
        const handleMouseMove = (e) => {

            if (isResizingAIRef.current) {
                const newWidth = window.innerWidth - e.clientX;

                if (newWidth > 300 && newWidth < 600) {
                    setAiWidth(newWidth);
                }
            }


            if (isResizingSidePanelRef.current) {
                const next = clampPanelW(e.clientX - RAIL_W);
                panelWRef.current = next;
                setPanelW(next);
            }
        };

        const handleMouseUp = () => {
            if (isResizingSidePanelRef.current && panelWRef.current) {
                try { localStorage.setItem(PANEL_W_KEY, String(panelWRef.current)); } catch { /* storage unavailable */ }
            }
            if (isResizingSidePanelRef.current) setIsResizingPanel(false);
            isResizingAIRef.current = false;
            isResizingSidePanelRef.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const startResizingAI = (e) => {
        isResizingAIRef.current = true;
        document.body.style.cursor = "col-resize";
        e.preventDefault();
    };

    const startResizingSidePanel = (e) => {
        isResizingSidePanelRef.current = true;
        setIsResizingPanel(true);
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        e.preventDefault();
    };

    // Double-click the handle to go back to the default width.
    const resetPanelWidth = () => {
        panelWRef.current = null;
        setPanelW(null);
        try { localStorage.removeItem(PANEL_W_KEY); } catch { /* storage unavailable */ }
    };

    const rootStyle = {
        display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden',
        background: 'var(--bg-base)', position: 'fixed', inset: 0, fontFamily: 'var(--font)',
        paddingBottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom))' : 0,
        ...(panelW ? { '--ws-panel-w': `${panelW}px` } : null),
    };

    return (
        <div className="gl-shell" style={rootStyle}>
            {/* Top bar */}
            <div className="gl-shell-topbar gl-glass-bar" style={{ padding: isMobile ? '0 6px' : '0 8px' }}>

                {isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: '6px' }}>
                        {showAI ? (

                            <button type="button" className="gl-shell-back" onClick={() => setShowAI(false)}>
                                <ChevronLeft size={16} /> AI
                            </button>
                        ) : isDetailRoute ? (
                            <button type="button" className="gl-shell-back" onClick={handleMobileBack}>
                                <ChevronLeft size={16} /> Back
                            </button>
                        ) : (
                            <span style={{ padding: '0 4px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' }}>
                                {getMobileSectionTitle()}
                            </span>
                        )}
                    </div>
                )}

                {/* Search */}
                <div style={{ flex: 1, minWidth: 0, maxWidth: '560px', margin: '0 auto', position: 'relative', zIndex: 70 }}>
                    <SearchInlineBar workspaceId={activeWorkspace?.id || activeWorkspace?._id} />
                </div>

                {/* Actions */}
                <div className="gl-shell-topbar-actions">
                    <WorkspaceNotificationPanel />

                    <HelpButton className="gl-icon-btn" size={17} />

                    {!isMobile && (
                        <button
                            type="button"
                            className="gl-icon-btn"
                            onClick={() => setShowAI(!showAI)}
                            aria-pressed={showAI}
                            title="Toggle Oruinwan AI"
                            aria-label="Oruinwan AI"
                        >
                            <Bot size={17} strokeWidth={2} />
                        </button>
                    )}
                </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

                <div style={{ display: isMobile ? 'none' : 'flex', height: '100%' }}>
                    <IconSidebar onProfileClick={() => setShowProfile(true)} />

                    {sidePanel && !isMobile && (
                        <div style={{ display: 'flex', height: '100%' }}>
                            <div className="gl-shell-panel-col">
                                {React.cloneElement(sidePanel, { title: activeWorkspace?.name || 'Loading...' })}
                            </div>
                            <div
                                className={`gl-shell-resizer${isResizingPanel ? ' is-dragging' : ''}`}
                                role="separator"
                                aria-orientation="vertical"
                                aria-label="Resize side panel"
                                title="Drag to resize · double-click to reset"
                                onMouseDown={startResizingSidePanel}
                                onDoubleClick={resetPanelWidth}
                            />
                        </div>
                    )}
                </div>

                {isMobile && isMobileHome && !showAI && (
                    <MobileHomePage
                        workspaceId={workspaceId}
                        onProfileClick={() => setShowProfile(true)}
                    />
                )}

                {isMobile && sidePanel && !isDetailRoute && !isMobileHome && !showAI && (
                    <div style={{ flex: 1, background: 'var(--bg-base)', height: '100%', overflow: 'hidden' }}>
                        {React.cloneElement(sidePanel, { title: activeWorkspace?.name || 'Loading...', isMobile: true })}
                    </div>
                )}

                <main
                    style={{
                        flex: 1,
                        display: (isMobile && !showAI && ((sidePanel && !isDetailRoute && !isMobileHome) || isMobileHome)) ? 'none' : 'flex',
                        minWidth: 0, background: 'var(--bg-base)', position: 'relative', width: '100%',
                    }}
                >
                    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', width: '100%', display: (isMobile && showAI) ? 'none' : undefined }}>
                        {children}
                    </div>

                    {showAI && (
                        <>
                            {!isMobile && (
                                <div
                                    className="gl-shell-resizer"
                                    role="separator"
                                    aria-orientation="vertical"
                                    aria-label="Resize AI panel"
                                    onMouseDown={startResizingAI}
                                />
                            )}

                            <div
                                style={{
                                    width: isMobile ? '100%' : aiWidth,
                                    background: 'var(--bg-base)',
                                    borderLeft: isMobile ? 'none' : '1px solid var(--border-subtle)',
                                    display: 'flex', flexDirection: 'column',
                                    paddingBottom: isMobile ? '54px' : 0,
                                }}
                            >
                                <ChttrixAIChat onClose={() => setShowAI(false)} isSidebar={true} initialPrompt={aiPrompt} onPromptConsumed={() => setAIPrompt(null)} />
                            </div>
                        </>
                    )}
                </main>
            </div>

            {showProfile && <ProfileMenu onClose={() => setShowProfile(false)} />}

            {isMobile && (
                <MobileBottomNav
                    workspaceId={workspaceId}
                    showAI={showAI}
                    onAIToggle={() => setShowAI(prev => !prev)}
                />
            )}
        </div>
    );
};

export default MainLayout;
