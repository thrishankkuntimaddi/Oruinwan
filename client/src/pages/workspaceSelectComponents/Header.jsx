import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleHelp, Search, BookOpen, Command, Bug, Sparkles, Shield, Briefcase, Settings, LogOut, Bell, Check, X, Bot, Loader2, AlertCircle, RefreshCcw } from 'lucide-react';
import api from '@services/api';
import { getAvatarUrl } from '../../utils/avatarUtils';
import { useSocket } from '../../contexts/SocketContext';
import { notificationHref } from '../../features/notifications/NotificationsContext';
import { notificationTypeMeta, timeAgo, COUNT_BADGE_STYLE } from '../../features/notifications/notificationTypes';

const btn = {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '7px', borderRadius: '2px', transition: '150ms ease',
    color: 'var(--text-muted)', fontFamily: 'var(--font)',
};

// Without the display property, so Tailwind's responsive `hidden sm:flex` classes win.
const { display: _display, ...btnNoDisplay } = btn;

const PER_WORKSPACE = 8;
const MAX_WORKSPACES = 12;

/**
 * Bell on /workspaces: the latest real notifications from every workspace the
 * user is an active member of (GET /api/notifications is per workspace).
 */
const NotificationPanel = ({ workspaces = [] }) => {
    const navigate = useNavigate();
    const { socket } = useSocket() || {};
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unreadByWs, setUnreadByWs] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const activeWs = useMemo(
        () => workspaces.filter(ws => !ws.membershipStatus || ws.membershipStatus === 'active').slice(0, MAX_WORKSPACES),
        [workspaces],
    );
    const wsKey = activeWs.map(ws => ws.id).join(',');
    const nameOf = useMemo(() => Object.fromEntries(activeWs.map(ws => [String(ws.id), ws.name])), [activeWs]);

    const load = useCallback(async () => {
        if (!activeWs.length) { setItems([]); setUnreadByWs({}); return; }
        setLoading(true);
        setError(null);
        const results = await Promise.allSettled(activeWs.map(ws =>
            api.get('/api/notifications', { params: { workspaceId: ws.id, limit: PER_WORKSPACE } })
                .then(({ data }) => ({ ws, data }))));
        const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value);
        if (!ok.length && results.length) {
            const first = results.find(r => r.status === 'rejected');
            setError(first?.reason?.response?.data?.message || 'Could not load notifications');
        }
        setItems(ok
            .flatMap(({ ws, data }) => (data.notifications || []).map(n => ({ ...n, workspaceId: n.workspaceId || ws.id })))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 20));
        setUnreadByWs(Object.fromEntries(ok.map(({ ws, data }) => [String(ws.id), data.unreadCount || 0])));
        setLoading(false);
    }, [wsKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    // New / read / deleted notifications arrive on the user's socket room.
    useEffect(() => {
        if (!socket) return undefined;
        const events = ['notification:new', 'notification:read', 'notification:read-all', 'notification:deleted', 'notification:cleared'];
        let timer = null;
        const onAny = () => { clearTimeout(timer); timer = setTimeout(load, 300); };
        events.forEach(e => socket.on(e, onAny));
        return () => { clearTimeout(timer); events.forEach(e => socket.off(e, onAny)); };
    }, [socket, load]);

    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open]);

    const unread = Object.values(unreadByWs).reduce((a, b) => a + b, 0);

    const markRead = async (n) => {
        if (n.read) return;
        setItems(prev => prev.map(x => (x._id === n._id ? { ...x, read: true } : x)));
        setUnreadByWs(prev => ({ ...prev, [String(n.workspaceId)]: Math.max(0, (prev[String(n.workspaceId)] || 0) - 1) }));
        try { await api.patch(`/api/notifications/${n._id}/read`); } catch { load(); }
    };

    const open_ = (n) => {
        markRead(n);
        const href = notificationHref(n, n.workspaceId);
        setOpen(false);
        navigate(href || `/workspace/${n.workspaceId}/notifications`);
    };

    const markAllRead = async () => {
        const wsIds = Object.entries(unreadByWs).filter(([, c]) => c > 0).map(([id]) => id);
        setItems(prev => prev.map(x => ({ ...x, read: true })));
        setUnreadByWs(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 0])));
        const res = await Promise.allSettled(wsIds.map(id => api.patch('/api/notifications/read-all', null, { params: { workspaceId: id } })));
        if (res.some(r => r.status === 'rejected')) load();
    };

    const dismiss = async (n) => {
        setItems(prev => prev.filter(x => x._id !== n._id));
        if (!n.read) setUnreadByWs(prev => ({ ...prev, [String(n.workspaceId)]: Math.max(0, (prev[String(n.workspaceId)] || 0) - 1) }));
        try { await api.delete(`/api/notifications/${n._id}`); } catch { load(); }
    };

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => { setOpen(o => !o); if (!open) load(); }}
                style={{ ...btn, position: 'relative', color: open ? 'var(--accent)' : 'var(--text-muted)', background: open ? 'var(--bg-hover)' : 'none' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = open ? 'var(--bg-hover)' : 'none'; e.currentTarget.style.color = open ? 'var(--accent)' : 'var(--text-muted)'; }}
                title="Notifications"
                aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
                aria-expanded={open}
            >
                <Bell size={18} />
                {unread > 0 && (
                    <span style={{ ...COUNT_BADGE_STYLE, position: 'absolute', top: '1px', right: '0px' }}>{unread > 99 ? '99+' : unread}</span>
                )}
            </button>

            {open && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />}

            {open && (
                <div role="dialog" aria-label="Notifications" style={{
                    position: 'fixed', top: '48px', right: '12px', width: '340px', maxWidth: 'calc(100vw - 24px)',
                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                    borderRadius: '2px', zIndex: 100, overflow: 'hidden',
                    animation: 'mfFadeIn 0.15s ease',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: '1px solid var(--border-default)', background: 'var(--bg-active)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-primary)' }}>
                            <Bell size={13} />
                            <span style={{ fontWeight: 600, fontSize: '12px' }}>Notifications</span>
                            {unread > 0 && <span style={{ ...COUNT_BADGE_STYLE, padding: '0 5px' }}>{unread} new</span>}
                        </div>
                        {unread > 0 && (
                            <button onClick={markAllRead} style={{ ...btn, padding: '3px', fontSize: '11px', gap: '3px', color: 'var(--text-secondary)', fontWeight: 600 }}
                                onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                            ><Check size={11} /> Mark all read</button>
                        )}
                    </div>

                    <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                        {loading && items.length === 0 ? (
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                <Loader2 size={16} className="animate-spin" />
                            </div>
                        ) : error && items.length === 0 ? (
                            <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px 16px', textAlign: 'center' }}>
                                <AlertCircle size={20} style={{ color: 'var(--state-danger)' }} />
                                <p style={{ fontSize: '12px', color: 'var(--text-primary)', margin: 0 }}>Couldn’t load notifications</p>
                                <button onClick={load} style={{ ...btn, gap: '5px', padding: '5px 12px', fontSize: '11px', color: 'var(--text-primary)', background: 'var(--bg-active)', border: '1px solid var(--border-default)' }}>
                                    <RefreshCcw size={11} /> Try again
                                </button>
                            </div>
                        ) : items.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
                                <Bell size={26} style={{ marginBottom: '10px', opacity: 0.3 }} />
                                <p style={{ fontSize: '12px', fontWeight: 500, margin: 0 }}>All caught up!</p>
                            </div>
                        ) : items.map(n => {
                            const { Icon, color } = notificationTypeMeta(n.type);
                            return (
                                <div key={n._id} className="wsn-row" role="button" tabIndex={0}
                                    onClick={() => open_(n)}
                                    onKeyDown={e => { if (e.key === 'Enter') open_(n); }}
                                    style={{
                                        display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px',
                                        borderBottom: '1px solid var(--border-subtle)',
                                        background: n.read ? 'var(--bg-surface)' : 'var(--bg-hover)',
                                        cursor: 'pointer',
                                    }}
                                >
                                    <div style={{ flexShrink: 0, width: '28px', height: '28px', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-active)', border: '1px solid var(--border-default)', color }}>
                                        <Icon size={13} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                            <p style={{ fontSize: '12px', fontWeight: n.read ? 400 : 600, color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{n.title}</p>
                                            {!n.read && <span style={{ flexShrink: 0, width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)' }} />}
                                        </div>
                                        {n.body && <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</p>}
                                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '3px 0 0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {nameOf[String(n.workspaceId)] || 'Workspace'} · {timeAgo(n.createdAt)}
                                        </p>
                                    </div>
                                    <button onClick={e => { e.stopPropagation(); dismiss(n); }} onKeyDown={e => e.stopPropagation()}
                                        className="wsn-dismiss" title="Dismiss" aria-label={`Dismiss: ${n.title}`}
                                    ><X size={12} /></button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <style>{`
                @keyframes mfFadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
                @keyframes hdrPing { 75%, 100% { transform: scale(2); opacity: 0; } }
                .wsn-row { transition: background 150ms ease; outline: none; }
                .wsn-row:hover, .wsn-row:focus-visible { background: var(--bg-hover) !important; }
                .wsn-dismiss { flex-shrink: 0; display: flex; padding: 3px; border-radius: 2px; color: var(--text-muted); background: none; border: none; cursor: pointer; opacity: 0; transition: opacity 150ms ease, color 150ms ease; }
                .wsn-row:hover .wsn-dismiss, .wsn-row:focus-within .wsn-dismiss, .wsn-dismiss:focus-visible { opacity: 1; }
                .wsn-dismiss:hover { color: var(--text-primary); background: var(--bg-active); }
                @media (hover: none) { .wsn-dismiss { opacity: 1; } }
            `}</style>
        </div>
    );
};

const Header = ({ workspaces = [], showHelp, setShowHelp, onHelpModalOpen, user, onProfileClick, onSettingsClick, onLogout, onOwnerConsoleClick, onAdminConsoleClick, onManagerConsoleClick, onAIClick, showAI }) => {

    const iconBtn = (active = false) => ({
        ...btn,
        color: active ? 'var(--text-primary)' : 'var(--text-muted)',
        background: active ? 'var(--bg-hover)' : 'none',
    });

    // No inline display: the `hidden md:flex` classes decide visibility.
    const consoleBtn = {
        alignItems: 'center', gap: '6px',
        fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)',
        background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '6px 10px', borderRadius: '2px', transition: '150ms ease',
        fontFamily: 'var(--font)',
    };

    return (
        <header style={{
            position: 'fixed', top: 0, width: '100%',
            background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)',
            zIndex: 50, height: '48px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontFamily: 'var(--font)', boxSizing: 'border-box',
            padding: '0 16px', gap: '8px', overflow: 'hidden',
        }}>
            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                <img src="/icons/oruinwan-128.png" alt="Oruinwan" style={{ width: '24px', height: '24px', borderRadius: '2px', objectFit: 'cover' }} />
                <span className="psh-ws-label" style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', letterSpacing: '0.01em', whiteSpace: 'nowrap' }}>Oruinwan</span>
            </div>

            {}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0, marginLeft: 'auto', position: 'relative' }}>

                {}
                {user?.companyRole === 'owner' && (
                    <button onClick={onOwnerConsoleClick} style={consoleBtn} className="hidden md:flex"
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    ><Shield size={13} /> Owner Console</button>
                )}

                {user?.companyRole === 'admin' && (
                    <button onClick={onAdminConsoleClick} style={consoleBtn} className="hidden md:flex"
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    ><Shield size={13} /> Admin Console</button>
                )}

                {(user?.companyRole === 'manager' || user?.companyRole === 'admin') && (
                    <button onClick={onManagerConsoleClick} style={consoleBtn} className="hidden md:flex"
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)'; }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
                    ><Briefcase size={13} /> Manager Console</button>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                    {}
                    <button onClick={onProfileClick} title="View Profile" className="hidden sm:flex"
                        style={{ ...btnNoDisplay, gap: '8px', padding: '4px 8px', maxWidth: '160px' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'none'}
                    >
                        <img src={getAvatarUrl(user)} alt={user?.username || 'User'} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-default)', flexShrink: 0 }} />
                        <div style={{ textAlign: 'left', overflow: 'hidden', minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.username || 'User'}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                        </div>
                    </button>

                    {}
                    <button onClick={onProfileClick} title="View Profile" className="flex sm:hidden" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', alignItems: 'center', justifyContent: 'center' }}>
                        <img src={getAvatarUrl(user)} alt={user?.username || 'U'} style={{ width: '26px', height: '26px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-default)' }} />
                    </button>

                    <div className="hidden md:block" style={{ height: '18px', width: '1px', background: 'var(--border-subtle)', margin: '0 4px' }} />

                    <NotificationPanel workspaces={workspaces} />

                    <button onClick={onSettingsClick} style={iconBtn()} title="Settings"
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    ><Settings size={16} /></button>

                    {}
                    <div style={{ position: 'relative' }}>
                        <button onClick={() => setShowHelp(!showHelp)} style={iconBtn(showHelp)} title="Help & Resources"
                            onMouseEnter={e => { if (!showHelp) { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)'; } }}
                            onMouseLeave={e => { if (!showHelp) { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                        ><CircleHelp size={16} /></button>

                        {showHelp && (
                            <>
                                <div style={{ position: 'fixed', inset: 0, zIndex: 90, cursor: 'default' }} onClick={() => setShowHelp(false)} />
                                <div style={{
                                    position: 'absolute', top: '44px', right: 0, width: '260px',
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                                    borderRadius: '2px', zIndex: 100, overflow: 'hidden', animation: 'mfFadeIn 0.15s ease',
                                }}>
                                    <div style={{ padding: '10px 14px', background: 'var(--bg-active)', borderBottom: '1px solid var(--border-default)' }}>
                                        <h3 style={{ margin: 0, fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>Oruinwan Support</h3>
                                        <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'var(--text-secondary)' }}>We're here to help you collaborate better.</p>
                                    </div>

                                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)' }}>
                                        <div style={{ position: 'relative' }}>
                                            <Search size={11} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                            <input type="text" placeholder="Find answers..."
                                                style={{ width: '100%', paddingLeft: '28px', paddingRight: '8px', paddingTop: '5px', paddingBottom: '5px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '2px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box', fontFamily: 'var(--font)' }}
                                                onFocus={e => e.currentTarget.style.borderColor = 'var(--border-accent)'}
                                                onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ padding: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px' }}>
                                        {[
                                            { label: 'Academy', icon: BookOpen, modal: 'academy', color: 'var(--accent)' },
                                            { label: 'Shortcuts', icon: Command, modal: 'shortcuts', color: 'var(--text-secondary)' },
                                            { label: 'Report Bug', icon: Bug, modal: 'bug', color: 'var(--state-danger)' },
                                            { label: "What's New", icon: Sparkles, modal: 'whatsnew', color: 'var(--accent)' },
                                        ].map(({ label, icon: Icon, modal, color }) => (
                                            <button key={modal}
                                                onClick={() => { setShowHelp(false); onHelpModalOpen(modal); }}
                                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '10px 6px', background: 'transparent', border: 'none', borderRadius: '2px', cursor: 'pointer', transition: '150ms ease', gap: '4px', fontFamily: 'var(--font)' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                            >
                                                <Icon size={17} style={{ color }} />
                                                <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '7px 12px', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span style={{ position: 'relative', display: 'inline-flex', width: '8px', height: '8px' }}>
                                                <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'var(--state-success, #3ecf8e)', opacity: 0.6, animation: 'hdrPing 1.5s cubic-bezier(0,0,0.2,1) infinite' }}></span>
                                                <span style={{ position: 'relative', display: 'inline-flex', borderRadius: '50%', width: '8px', height: '8px', background: 'var(--state-success, #3ecf8e)' }}></span>
                                            </span>
                                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Systems Operational</span>
                                        </div>
                                        <button onClick={() => { setShowHelp(false); onHelpModalOpen('contact'); }}
                                            style={{ ...btn, padding: '2px', fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}
                                            onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'var(--accent)'}
                                        >Contact Us</button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {}
                    <button onClick={onAIClick} style={iconBtn(showAI)} title="Oruinwan AI"
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--accent)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = showAI ? 'var(--bg-hover)' : 'none'; e.currentTarget.style.color = showAI ? 'var(--accent)' : 'var(--text-muted)'; }}
                    ><Bot size={16} /></button>

                    {}
                    <button onClick={onLogout} style={iconBtn()} title="Sign out"
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--state-danger)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                    ><LogOut size={16} /></button>
                </div>
            </div>
        </header>
    );
};

export default Header;
