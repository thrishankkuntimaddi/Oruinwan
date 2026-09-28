import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Briefcase, Settings, LogOut, Bell, Check, X, Bot, Loader2, AlertCircle, RefreshCcw } from 'lucide-react';
import HelpButton from '../../components/help/HelpButton';
import api from '@services/api';
import { getAvatarUrl } from '../../utils/avatarUtils';
import { useSocket } from '../../contexts/SocketContext';
import { notificationHref } from '../../features/notifications/NotificationsContext';
import { notificationTypeMeta, timeAgo } from '../../features/notifications/notificationTypes';

const PER_WORKSPACE = 8;
const MAX_WORKSPACES = 12;

/**
 * Bell on /workspaces: the latest real notifications from every workspace the
 * user is an active member of (GET /api/notifications is per workspace).
 */
const NotificationPanel = ({ workspaces = [], onUnreadChange }) => {
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

    // Lets the page show per-workspace unread counts on the cards.
    useEffect(() => { onUnreadChange?.(unreadByWs); }, [unreadByWs, onUnreadChange]);

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
        <div className="gl-wsp-bell">
            <button
                type="button"
                className="gl-icon-btn"
                onClick={() => { setOpen(o => !o); if (!open) load(); }}
                title="Notifications"
                aria-label={unread > 0 ? `Notifications (${unread} unread)` : 'Notifications'}
                aria-expanded={open}
            >
                <Bell size={17} />
            </button>
            {unread > 0 && <span className="gl-wsp-bell__count" aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}

            {open && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />}

            {open && (
                <div role="dialog" aria-label="Notifications" className="gl-wsp-pop">
                    <div className="gl-wsp-pop__head">
                        <div className="gl-wsp-pop__title">
                            <Bell size={13} />
                            <span>Notifications</span>
                            {unread > 0 && <span className="gl-count" style={{ color: 'var(--accent)', background: 'var(--gl-accent-soft)' }}>{unread} new</span>}
                        </div>
                        {unread > 0 && (
                            <button type="button" onClick={markAllRead} className="gl-btn gl-btn--ghost gl-btn--sm"><Check size={12} /> Mark all read</button>
                        )}
                    </div>

                    <div className="gl-wsp-pop__body">
                        {loading && items.length === 0 ? (
                            <div className="gl-wsp-pop__state"><Loader2 size={16} className="animate-spin" /></div>
                        ) : error && items.length === 0 ? (
                            <div role="alert" className="gl-wsp-pop__state">
                                <AlertCircle size={20} style={{ color: 'var(--state-danger)' }} />
                                <p style={{ color: 'var(--text-primary)', margin: 0 }}>Couldn’t load notifications</p>
                                <button type="button" onClick={load} className="gl-btn gl-btn--sm"><RefreshCcw size={11} /> Try again</button>
                            </div>
                        ) : items.length === 0 ? (
                            <div className="gl-wsp-pop__state">
                                <Bell size={24} style={{ opacity: 0.45 }} />
                                <p style={{ margin: 0, fontWeight: 600 }}>All caught up!</p>
                            </div>
                        ) : items.map(n => {
                            const { Icon, color } = notificationTypeMeta(n.type);
                            return (
                                <div key={n._id} className={`gl-wsp-note${n.read ? '' : ' is-unread'}`} role="button" tabIndex={0}
                                    onClick={() => open_(n)}
                                    onKeyDown={e => { if (e.key === 'Enter') open_(n); }}
                                >
                                    <div className="gl-wsp-note__icon" style={{ color }}><Icon size={13} /></div>
                                    <div className="gl-wsp-note__main">
                                        <p className="gl-wsp-note__title">
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.title}</span>
                                            {!n.read && <span className="gl-wsp-note__dot" />}
                                        </p>
                                        {n.body && <p className="gl-wsp-note__text">{n.body}</p>}
                                        <p className="gl-wsp-note__meta">{nameOf[String(n.workspaceId)] || 'Workspace'} · {timeAgo(n.createdAt)}</p>
                                    </div>
                                    <button type="button" onClick={e => { e.stopPropagation(); dismiss(n); }} onKeyDown={e => e.stopPropagation()}
                                        className="gl-icon-btn gl-wsp-note__dismiss" style={{ width: 22, height: 22 }} title="Dismiss" aria-label={`Dismiss: ${n.title}`}
                                    ><X size={12} /></button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const CONSOLES = [
    { key: 'owner', show: r => r === 'owner', label: 'Owner Console', Icon: Shield, prop: 'onOwnerConsoleClick' },
    { key: 'admin', show: r => r === 'admin', label: 'Admin Console', Icon: Shield, prop: 'onAdminConsoleClick' },
    { key: 'manager', show: r => r === 'manager' || r === 'admin', label: 'Manager Console', Icon: Briefcase, prop: 'onManagerConsoleClick' },
];

const Header = ({ workspaces = [], user, onProfileClick, onSettingsClick, onLogout, onAIClick, showAI, onUnreadChange, ...handlers }) => (
    <header className="gl-wsp-bar gl-glass-bar">
        <div className="gl-wsp-bar__inner">
            <div className="gl-wsp-brand">
                <img src="/icons/oruinwan-128.png" alt="" className="gl-wsp-brand__mark" />
                <span className="gl-wsp-brand__name">Oruinwan</span>
            </div>

            <div className="gl-wsp-bar__right">
                {CONSOLES.filter(c => c.show(user?.companyRole)).map(({ key, label, Icon, prop }) => (
                    <button key={key} type="button" className="gl-wsp-console" onClick={handlers[prop]}>
                        <Icon size={13} /> {label}
                    </button>
                ))}

                <button type="button" className="gl-wsp-user" onClick={onProfileClick} title="View Profile" aria-label="View profile">
                    <img src={getAvatarUrl(user)} alt="" className="gl-wsp-user__avatar" />
                    <span className="gl-wsp-user__text">
                        <span className="gl-wsp-user__name">{user?.username || 'User'}</span>
                        <span className="gl-wsp-user__mail">{user?.email}</span>
                    </span>
                </button>

                <span className="gl-wsp-bar__sep" aria-hidden="true" />

                <NotificationPanel workspaces={workspaces} onUnreadChange={onUnreadChange} />

                <button type="button" className="gl-icon-btn" onClick={onSettingsClick} title="Settings" aria-label="Settings">
                    <Settings size={17} />
                </button>

                <HelpButton size={17} />

                <button type="button" className="gl-icon-btn" onClick={onAIClick} title="Oruinwan AI" aria-label="Oruinwan AI" aria-pressed={!!showAI}>
                    <Bot size={17} />
                </button>

                <button type="button" className="gl-icon-btn is-danger" onClick={onLogout} title="Sign out" aria-label="Sign out">
                    <LogOut size={17} />
                </button>
            </div>
        </div>
    </header>
);

export default Header;
