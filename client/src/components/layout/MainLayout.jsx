import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import IconSidebar from "./IconSidebar";
import ProfileMenu from "../SidebarComp/ProfileSidebar";
import ChttrixAIChat from "../ai/ChttrixAIChat/ChttrixAIChat";
import { useWorkspace } from "../../contexts/WorkspaceContext";
import { useNotifications } from "../../contexts/NotificationsContext";
import SearchInlineBar from "../search/SearchInlineBar";
import MobileBottomNav from "./MobileBottomNav";
import MobileHomePage from "./MobileHomePage";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Bot, BookOpen, Command, Bug, Sparkles, Search, MessageCircle, X, Loader2, Bell, CircleHelp, AtSign, UserPlus, Check, Trash2, ExternalLink, ChevronLeft } from "lucide-react";

const NOTIF_ICONS = {
    mention:         { Icon: AtSign,       color: 'var(--text-muted)' },
    dm:              { Icon: MessageCircle, color: 'var(--text-muted)' },
    task_assigned:   { Icon: Check,         color: 'var(--state-success)' },
    task_comment:    { Icon: MessageCircle, color: 'var(--text-muted)' },
    member_joined:   { Icon: UserPlus,      color: 'var(--state-success)' },
    channel_pinned:  { Icon: Bell,          color: 'var(--accent)' },
    huddle_started:  { Icon: Bell,          color: 'var(--state-danger)' },
    schedule_created:{ Icon: Bell,          color: 'var(--accent)' },
    reaction:        { Icon: Bell,          color: 'var(--text-secondary)' },
};

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

const WorkspaceNotificationPanel = () => {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const { activeWorkspace } = useWorkspace();

    
    const notifCtx = useNotifications();

    const notifications = notifCtx?.notifications || [];
    const unreadCount = notifCtx?.unreadCount || 0;
    const loading = notifCtx?.loading || false;
    const markAllRead = notifCtx?.markAllRead || (() => { });
    const dismiss = notifCtx?.dismiss || (() => { });
    const markRead = notifCtx?.markRead || (() => { });

    
    const preview = notifications.slice(0, 8);

    const handleClickNotif = (n) => {
        if (!n.read) markRead(n._id);
        if (n.link && activeWorkspace?.id) {
            navigate(`/workspace/${activeWorkspace.id}${n.link}`);
        }
        setOpen(false);
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(o => !o)}
                style={{ position: 'relative', padding: '6px', borderRadius: '2px', background: open ? 'var(--bg-hover)' : 'none', border: 'none', cursor: 'pointer', color: open ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', transition: '150ms ease' }}
                title="Notifications"
                onMouseEnter={e => { if (!open) e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { if (!open) e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
                <Bell size={18} strokeWidth={2} />
                {unreadCount > 0 && (
                    <span style={{ position: 'absolute', top: '-2px', right: '-2px', minWidth: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '99px', background: 'var(--accent)', color: '#0c0c0c', fontSize: '9px', fontWeight: 700, padding: '0 3px' }}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />}

            {open && (
                <div style={{ position: 'absolute', top: '38px', right: 0, width: '300px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', zIndex: 100, overflow: 'hidden', animation: 'wsFadeIn 0.15s cubic-bezier(.4,0,.2,1)', fontFamily: 'var(--font)' }}>

                    {}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-active)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                            <Bell size={13} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>Notifications</span>
                            {unreadCount > 0 && <span style={{ background: 'var(--accent)', color: '#0c0c0c', fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '99px' }}>{unreadCount} new</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {unreadCount > 0 && (
                                <button onClick={markAllRead} style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                    onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                >
                                    <Check size={10} /> All read
                                </button>
                            )}
                        </div>
                    </div>

                    {}
                    <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                        {loading && notifications.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                <Loader2 size={16} className="animate-spin" />
                            </div>
                        ) : preview.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                                <Bell size={24} style={{ marginBottom: '8px', opacity: 0.3 }} />
                                <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', margin: '0 0 3px' }}>All caught up!</p>
                                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>No new notifications</p>
                            </div>
                        ) : preview.map(n => {
                            const { Icon, color } = NOTIF_ICONS[n.type] || NOTIF_ICONS.channel_pinned;
                            return (
                                <div
                                    key={n._id}
                                    onClick={() => handleClickNotif(n)}
                                    style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', cursor: 'pointer', transition: '150ms ease', background: n.read ? 'none' : 'var(--bg-hover)', borderBottom: '1px solid var(--border-subtle)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                    onMouseLeave={e => e.currentTarget.style.background = n.read ? 'none' : 'var(--bg-hover)'}
                                >
                                    <div style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '2px', background: 'var(--bg-active)', border: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
                                        <Icon size={13} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <p style={{ fontSize: '12px', fontWeight: n.read ? 400 : 600, color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{n.title}</p>
                                            {!n.read && <span style={{ flexShrink: 0, width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />}
                                        </div>
                                        {n.body && <p style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: '2px 0 0' }}>{n.body}</p>}
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0', fontWeight: 500 }}>{timeAgo(n.createdAt)}</p>
                                    </div>
                                    <button
                                        onClick={e => { e.stopPropagation(); dismiss(n._id); }}
                                        style={{ flexShrink: 0, padding: '2px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0, transition: '150ms ease' }}
                                        className="group-hover:opacity-100"
                                        title="Dismiss"
                                    >
                                        <X size={11} />
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    {}
                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)' }}>
                        <button
                            onClick={() => { setOpen(false); navigate(`/workspace/${activeWorkspace?.id}/notifications`); }}
                            style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                        >
                            View all notifications
                        </button>
                        {notifications.length > 0 && (
                            <button
                                onClick={() => notifCtx?.clearAll?.()}
                                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                                title="Clear all"
                            >
                                <Trash2 size={10} /> Clear all
                            </button>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes wsFadeIn {
                    from { opacity: 0; transform: translateY(-6px) scale(0.97); }
                    to   { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
};

const MainLayout = ({ children, sidePanel }) => {
    const { activeWorkspace } = useWorkspace();
    const [showProfile, setShowProfile] = useState(false);
    const [showAI, setShowAI] = useState(false);
    const [aiWidth, setAiWidth] = useState(350);
    const [sidePanelWidth, setSidePanelWidth] = useState(270);
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
        if (!workspaceId) return activeWorkspace?.name || 'Chttrix';
        const p = currentPath;
        if (p.includes('/channels') || p.includes('/channel/')) return 'Channels';
        if (p.includes('/messages') || p.includes('/dm/'))      return 'Messages';
        if (p.includes('/tasks')    || p.includes('/task/'))    return 'Tasks';
        if (p.includes('/notes')    || p.includes('/note/'))    return 'Notes';
        if (p.includes('/files'))                               return 'Files';
        if (p.includes('/knowledge'))                           return 'Knowledge';
        if (p.includes('/huddles'))                             return 'Meetings';
        if (p.includes('/updates'))                             return 'Updates';
        if (p.includes('/apps'))                                return 'Apps';
        if (p.includes('/settings'))                            return 'Settings';
        if (p.includes('/admin'))                               return 'Admin';
        if (p.includes('/manager'))                             return 'Manager';
        return activeWorkspace?.name || 'Chttrix';
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
    
    }, [location.state?.openAI]);

    
    const [showHelp, setShowHelp] = useState(false);
    const [activeHelpModal, setActiveHelpModal] = useState(null); 

    
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
                
                const newWidth = e.clientX - 60;
                
                if (newWidth > 200 && newWidth < 400) {
                    setSidePanelWidth(newWidth);
                }
            }
        };

        const handleMouseUp = () => {
            isResizingAIRef.current = false;
            isResizingSidePanelRef.current = false;
            document.body.style.cursor = "default";
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
        document.body.style.cursor = "col-resize";
        e.preventDefault();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden', background: 'var(--bg-base)', position: 'fixed', inset: 0, fontFamily: 'var(--font)', paddingBottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom))' : 0 }}>
            {}

            {}
            {activeHelpModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', padding: '16px', fontFamily: 'var(--font)' }}>
                    <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px', width: '100%', maxWidth: '560px', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: '0 16px 48px rgba(0,0,0,0.5)' }}>
                        <button
                            onClick={() => setActiveHelpModal(null)}
                            style={{ position: 'absolute', top: '14px', right: '14px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', zIndex: 10, display: 'flex', padding: '4px', borderRadius: '2px', transition: '150ms ease' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                        >
                            <X size={18} />
                        </button>

                        {activeHelpModal === "academy" && (
                            <>
                                <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-active)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <BookOpen size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                    <div>
                                        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Chttrix Academy</h2>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Master your workflow with these guides.</p>
                                    </div>
                                </div>
                                <div style={{ padding: '16px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {["Getting Started Guide", "Advanced Search Techniques", "Managing Notifications", "Integrations 101"].map((guide, i) => (
                                        <div key={i} style={{ padding: '12px 14px', border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer', transition: '150ms ease' }}
                                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-accent)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-default)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                                        >
                                            <h3 style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 3px' }}>{guide}</h3>
                                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>Learn the basics and become a pro user in no time.</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeHelpModal === "shortcuts" && (
                            <>
                                <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-active)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Command size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                    <div>
                                        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Keyboard Shortcuts</h2>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Speed up your workflow.</p>
                                    </div>
                                </div>
                                <div style={{ padding: '16px 24px', overflowY: 'auto' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', backgroundColor: 'var(--border-subtle)' }}>
                                        {[['Quick Search', 'Cmd + K'], ['New Message', 'Cmd + N'], ['Toggle AI', 'Cmd + Shift + A'], ['Close / Escape', 'Esc']].map(([label, key]) => (
                                            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'var(--bg-surface)' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
                                                <kbd style={{ padding: '2px 8px', backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-primary)' }}>{key}</kbd>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {activeHelpModal === "bug" && (
                            <>
                                <div style={{ padding: '20px 24px', backgroundColor: 'rgba(198,60,60,0.08)', borderBottom: '1px solid rgba(198,60,60,0.2)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Bug size={20} style={{ color: 'var(--state-danger)', flexShrink: 0 }} />
                                    <div>
                                        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--state-danger)', margin: 0 }}>Report a Bug</h2>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Found something broken? Let us know.</p>
                                    </div>
                                </div>
                                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>What happened?</label>
                                        <textarea rows={4} placeholder="Describe the issue..." style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'var(--font)' }}
                                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                        />
                                    </div>
                                    <button style={{ padding: '8px', fontSize: '13px', fontWeight: 600, color: '#fff', backgroundColor: 'var(--state-danger)', border: 'none', borderRadius: '2px', cursor: 'pointer', transition: '150ms ease' }}
                                        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                                        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                    >Submit Report</button>
                                </div>
                            </>
                        )}

                        {activeHelpModal === "whatsnew" && (
                            <>
                                <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-active)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Sparkles size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                    <div>
                                        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>What's New</h2>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Latest updates and improvements.</p>
                                    </div>
                                </div>
                                <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {[{ date: 'Nov 2025', color: 'var(--accent)', title: 'Chttrix AI 2.0', body: 'Smarter responses, faster generation, and context-aware suggestions.' }, { date: 'Oct 2025', color: '#9c7fd4', title: 'Dark Mode Beta', body: 'Easy on the eyes. Now the default theme across the app.' }].map(item => (
                                        <div key={item.date} style={{ paddingLeft: '14px', borderLeft: `2px solid ${item.color}`, position: 'relative' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: item.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{item.date}</span>
                                            <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '3px 0 4px' }}>{item.title}</h3>
                                            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{item.body}</p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {activeHelpModal === "contact" && (
                            <>
                                <div style={{ padding: '20px 24px', backgroundColor: 'var(--bg-active)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <MessageCircle size={20} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                    <div>
                                        <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Contact Support</h2>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>We're here to help with any questions.</p>
                                    </div>
                                </div>
                                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>Subject</label>
                                        <select style={{ width: '100%', padding: '7px 10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none' }}>
                                            <option>General Inquiry</option>
                                            <option>Billing Issue</option>
                                            <option>Technical Support</option>
                                            <option>Enterprise Sales</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '6px' }}>Message</label>
                                        <textarea rows={4} placeholder="How can we help you?" style={{ width: '100%', padding: '8px 10px', backgroundColor: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'var(--font)' }}
                                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
                                        />
                                    </div>
                                    <button style={{ padding: '8px', fontSize: '13px', fontWeight: 600, color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '2px', cursor: 'pointer', transition: '150ms ease' }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                                    >Send Message</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {}
            <div style={{ height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: isMobile ? '0 6px' : '0 8px', background: 'var(--bg-base)', flexShrink: 0, zIndex: 60, position: 'relative', borderBottom: '1px solid var(--border-subtle)', gap: '4px' }}>

                {}
                {isMobile && (
                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: '6px' }}>
                        {showAI ? (
                            
                            <button
                                onClick={() => setShowAI(false)}
                                style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 4px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font)', WebkitTapHighlightColor: 'transparent' }}
                            >
                                <ChevronLeft size={16} /> AI
                            </button>
                        ) : isDetailRoute ? (
                            <button
                                onClick={handleMobileBack}
                                style={{ display: 'flex', alignItems: 'center', gap: '2px', padding: '6px 4px', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, fontFamily: 'var(--font)', WebkitTapHighlightColor: 'transparent' }}
                            >
                                <ChevronLeft size={16} /> Back
                            </button>
                        ) : (
                            <span style={{ padding: '0 4px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {getMobileSectionTitle()}
                            </span>
                        )}
                    </div>
                )}

                {}
                <div style={{ flex: 1, minWidth: 0, maxWidth: '560px', margin: '0 auto', position: 'relative', zIndex: 70 }}>
                    <SearchInlineBar workspaceId={activeWorkspace?.id || activeWorkspace?._id} />
                </div>

                {}
                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'flex-end', flexShrink: 0, position: 'relative' }}>

                    {}
                    <WorkspaceNotificationPanel />

                    {}
                    {!isMobile && <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setShowHelp(!showHelp)}
                            style={{ padding: '6px', borderRadius: '2px', background: showHelp ? 'var(--bg-hover)' : 'none', border: 'none', cursor: 'pointer', color: showHelp ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', transition: '150ms ease' }}
                            title="Help & Resources"
                            onMouseEnter={e => { if (!showHelp) e.currentTarget.style.color = 'var(--text-primary)'; }}
                            onMouseLeave={e => { if (!showHelp) e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                            <CircleHelp size={18} strokeWidth={2} />
                        </button>

                        {}
                        {showHelp && (
                            <>
                                <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setShowHelp(false)} />
                                <div style={{ position: 'absolute', top: '36px', right: 0, width: '220px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '2px', zIndex: 100, overflow: 'hidden', animation: 'wsFadeIn 0.15s cubic-bezier(.4,0,.2,1)' }}>
                                    {}
                                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-active)' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Support</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <div style={{ width: '6px', height: '6px', background: 'var(--state-success)', borderRadius: '50%' }} />
                                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--state-success)' }}>All systems normal</span>
                                        </div>
                                    </div>

                                    {}
                                    <div style={{ padding: '4px' }}>
                                        {[
                                            { key: 'academy',   Icon: BookOpen,       label: 'Academy' },
                                            { key: 'shortcuts', Icon: Command,        label: 'Shortcuts' },
                                            { key: 'whatsnew',  Icon: Sparkles,       label: "What's New" },
                                            { key: 'bug',       Icon: Bug,            label: 'Report Bug' },
                                        ].map(({ key, Icon, label }) => (
                                            <button key={key}
                                                onClick={() => { setShowHelp(false); setActiveHelpModal(key); }}
                                                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'none', border: 'none', borderRadius: '2px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', fontFamily: 'var(--font)', transition: '150ms ease', textAlign: 'left' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                                            >
                                                <Icon size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                                {label}
                                            </button>
                                        ))}
                                    </div>

                                    {}
                                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '6px' }}>
                                        <button onClick={() => { setShowHelp(false); setActiveHelpModal('contact'); }}
                                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '7px', background: 'var(--bg-active)', border: '1px solid var(--border-accent)', borderRadius: '2px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'var(--font)', transition: '150ms ease' }}
                                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border-accent)'; }}
                                        >
                                            <MessageCircle size={12} style={{ color: 'var(--text-muted)' }} />
                                            Contact Support
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>}

                    {}
                    {!isMobile && <button
                        onClick={() => setShowAI(!showAI)}
                        style={{ padding: '6px', borderRadius: '2px', background: showAI ? 'var(--bg-hover)' : 'none', border: 'none', cursor: 'pointer', color: showAI ? 'var(--accent)' : 'var(--text-muted)', display: 'flex', transition: '150ms ease' }}
                        title="Toggle Chttrix AI"
                        onMouseEnter={e => { if (!showAI) e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { if (!showAI) e.currentTarget.style.color = 'var(--text-muted)'; }}
                    >
                        <Bot size={18} strokeWidth={2} />
                    </button>}
                </div>
            </div>

            {}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>

                {}
                <div style={{ display: isMobile ? 'none' : 'flex', height: '100%' }}>
                    <IconSidebar onProfileClick={() => setShowProfile(true)} />

                    {}
                    {sidePanel && (
                        <div
                            className="h-full flex"
                            style={{ display: isMobile ? 'none' : 'flex' }}
                        >
                            <div
                                style={{ width: `${sidePanelWidth}px`, background: 'var(--bg-base)', borderRight: '1px solid var(--border-subtle)', height: '100%', flexShrink: 0 }}
                            >
                                {React.cloneElement(sidePanel, { title: activeWorkspace?.name || 'Loading...' })}
                            </div>
                            {}
                            <div
                                className="hidden md:block w-1 cursor-col-resize flex-shrink-0 z-40 transition-colors"
                                style={{ background: 'transparent' }}
                                onMouseDown={startResizingSidePanel}
                                onMouseEnter={e => e.currentTarget.style.background = 'var(--border-accent)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                            />
                        </div>
                    )}
                </div>

                {}
                {isMobile && isMobileHome && !showAI && (
                    <MobileHomePage
                        workspaceId={workspaceId}
                        onProfileClick={() => setShowProfile(true)}
                    />
                )}

                {}
                {isMobile && sidePanel && !isDetailRoute && !isMobileHome && !showAI && (
                    <div style={{ flex: 1, background: 'var(--bg-base)', height: '100%', overflow: 'hidden' }}>
                        {React.cloneElement(sidePanel, { title: activeWorkspace?.name || 'Loading...', isMobile: true })}
                    </div>
                )}

                {}
                {}
                <main
                    style={{
                        flex: 1,
                        display: (isMobile && !showAI && ((sidePanel && !isDetailRoute && !isMobileHome) || isMobileHome)) ? 'none' : 'flex',
                        minWidth: 0, background: 'var(--bg-base)', position: 'relative', width: '100%',
                    }}
                >
                    {}
                    <div style={{ flex: 1, overflow: 'hidden', position: 'relative', width: '100%', display: (isMobile && showAI) ? 'none' : undefined }}>
                        {children}
                    </div>

                    {}
                    {showAI && (
                        <>
                            {}
                            {!isMobile && (
                                <div
                                    className="hidden md:block w-1 flex-shrink-0 z-40 cursor-col-resize transition-colors"
                                    style={{ background: 'transparent' }}
                                    onMouseDown={startResizingAI}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--border-accent)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                />
                            )}

                            {}
                            <div
                                style={{
                                    width: isMobile ? '100%' : aiWidth,
                                    background: 'var(--bg-base)',
                                    borderLeft: isMobile ? 'none' : '1px solid var(--border-subtle)',
                                    display: 'flex', flexDirection: 'column',
                                    paddingBottom: isMobile ? '54px' : 0,
                                }}
                            >
                                <ChttrixAIChat onClose={() => setShowAI(false)} isSidebar={true} />
                            </div>
                        </>
                    )}
                </main>
            </div>

            {}
            {showProfile && <ProfileMenu onClose={() => setShowProfile(false)} />}

            {}
            {isMobile && (
                <MobileBottomNav
                    workspaceId={workspaceId}
                    showAI={showAI}
                    onAIToggle={() => setShowAI(prev => !prev)}
                />
            )}
        </div >
    );
};

export default MainLayout;
