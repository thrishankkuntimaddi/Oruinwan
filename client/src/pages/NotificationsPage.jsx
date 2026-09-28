import React, { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Bell, Check, Trash2, RefreshCcw, Loader2, ExternalLink, Settings,
    ChevronDown, X, AlertCircle,
} from 'lucide-react';
import { useNotifications, notificationHref } from '../features/notifications/NotificationsContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import NotificationPreferences from '../features/notifications/components/NotificationPreferences';
import { notificationTypeMeta, timeAgo, COUNT_BADGE_STYLE } from '../features/notifications/notificationTypes';

const T = {
    bg:          'var(--bg-base)',
    surface:     'var(--bg-surface)',
    border:      'var(--border-subtle)',
    borderHover: 'var(--border-default)',
    accent:      'var(--accent)',
    accentBg:    'var(--accent-dim)',
    danger:      'var(--state-danger)',
    text:        'var(--text-primary)',
    secondary:   'var(--text-secondary)',
    muted:       'var(--text-muted)',
    dim:         'var(--text-muted)',
    font:        'var(--font)',
};

const TABS = [
    { key: 'all',      label: 'All' },
    { key: 'unread',   label: 'Unread' },
    { key: 'mentions', label: 'Mentions' },
    { key: 'messages', label: 'Messages' },
    { key: 'tasks',    label: 'Tasks' },
    { key: 'team',     label: 'Team' },
    { key: 'settings', label: 'Settings', Icon: Settings },
];

function groupByDay(notifications) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const groups = { Today: [], Yesterday: [], Older: [] };
    notifications.forEach(n => {
        const d = new Date(n.createdAt); d.setHours(0, 0, 0, 0);
        if (d >= today) groups.Today.push(n);
        else if (d >= yesterday) groups.Yesterday.push(n);
        else groups.Older.push(n);
    });
    return groups;
}

export default function NotificationsPage() {
    const navigate = useNavigate();
    const { workspaceId } = useParams();
    const { activeWorkspace } = useWorkspace();
    const {
        notifications, unreadCount, loading, error, hasMore,
        loadMore, refresh, markRead, markAllRead, dismiss, clearAll,
    } = useNotifications();

    const [activeTab, setActiveTab] = useState('all');
    const [hoveredId, setHoveredId] = useState(null);
    const [confirmClear, setConfirmClear] = useState(false);
    const [clearing, setClearing] = useState(false);

    const doClearAll = async () => {
        setClearing(true);
        const ok = await clearAll();
        setClearing(false);
        if (ok !== false) setConfirmClear(false);
    };

    const filtered = notifications.filter(n => {
        if (activeTab === 'all') return true;
        if (activeTab === 'unread') return !n.read;
        return notificationTypeMeta(n.type).tab === activeTab;
    });

    const groups = groupByDay(filtered);

    const handleClick = useCallback((n) => {
        if (!n.read) markRead(n._id);
        const href = notificationHref(n, workspaceId);
        if (href) navigate(href);
    }, [markRead, navigate, workspaceId]);

    const renderGroup = (label, items) => {
        if (!items.length) return null;
        return (
            <div key={label} style={{ marginBottom: '24px' }}>
                {}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', padding: '0 2px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: T.font, whiteSpace: 'nowrap' }}>{label}</span>
                    <div style={{ flex: 1, height: '1px', background: T.border }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {items.map(n => {
                        const { Icon, color: dot, label: typeLabel } = notificationTypeMeta(n.type);
                        const isHovered = hoveredId === n._id;
                        const href = notificationHref(n, workspaceId);
                        return (
                            <div
                                key={n._id}
                                onClick={() => handleClick(n)}
                                onMouseEnter={() => setHoveredId(n._id)}
                                onMouseLeave={() => setHoveredId(null)}
                                onFocus={() => setHoveredId(n._id)}
                                onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setHoveredId(null); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) handleClick(n); }}
                                tabIndex={0}
                                role="button"
                                style={{
                                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                                    padding: '10px 14px',
                                    background: n.read
                                        ? (isHovered ? 'var(--bg-hover)' : 'transparent')
                                        : (isHovered ? 'var(--bg-hover)' : 'var(--highlight-bg-weak)'),
                                    border: `1px solid ${isHovered ? T.borderHover : T.border}`,
                                    cursor: href ? 'pointer' : 'default',
                                    outline: 'none',
                                    transition: 'all 150ms ease',
                                    position: 'relative',
                                }}
                            >
                                {}
                                {!n.read && (
                                    <span style={{ position: 'absolute', left: 0, top: '10px', bottom: '10px', width: '2px', background: T.accent }} />
                                )}

                                {}
                                <div style={{
                                    flexShrink: 0, width: '34px', height: '34px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: 'var(--bg-active)',
                                    border: `1px solid ${T.borderHover}`,
                                }}>
                                    <Icon size={15} style={{ color: dot }} />
                                </div>

                                {}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '13px', fontWeight: n.read ? 500 : 700, color: n.read ? T.muted : T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: T.font }}>
                                                    {n.title}
                                                </span>
                                                {!n.read && (
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: T.accent, flexShrink: 0 }} />
                                                )}
                                                <span style={{ fontSize: '9px', fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '1px 5px', background: 'var(--bg-hover)', border: `1px solid ${T.border}`, fontFamily: T.font, whiteSpace: 'nowrap' }}>
                                                    {typeLabel}
                                                </span>
                                            </div>
                                            {n.body && (
                                                <p style={{ fontSize: '12px', color: T.muted, marginTop: '2px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontFamily: T.font }}>
                                                    {n.body}
                                                </p>
                                            )}
                                            <p style={{ fontSize: '10px', color: T.dim, marginTop: '4px', fontFamily: T.font }}>
                                                {timeAgo(n.createdAt)}
                                            </p>
                                        </div>

                                        {}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: isHovered ? 1 : 0, transition: 'opacity 150ms ease', flexShrink: 0 }}>
                                            {href && (
                                                <button
                                                    title="Open"
                                                    aria-label="Open"
                                                    onClick={e => { e.stopPropagation(); handleClick(n); }}
                                                    style={{ padding: '4px', background: 'none', border: 'none', color: T.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '150ms ease' }}
                                                    onMouseEnter={e => e.currentTarget.style.color = T.accent}
                                                    onMouseLeave={e => e.currentTarget.style.color = T.muted}
                                                >
                                                    <ExternalLink size={12} />
                                                </button>
                                            )}
                                            <button
                                                title="Dismiss"
                                                aria-label={`Dismiss: ${n.title}`}
                                                onClick={e => { e.stopPropagation(); dismiss(n._id); }}
                                                style={{ padding: '4px', background: 'none', border: 'none', color: T.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '150ms ease' }}
                                                onMouseEnter={e => e.currentTarget.style.color = T.danger}
                                                onMouseLeave={e => e.currentTarget.style.color = T.muted}
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: T.bg, fontFamily: T.font }}>

            {}
            <div style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '16px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '760px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.accentBg, border: `1px solid ${T.borderHover}` }}>
                            <Bell size={17} style={{ color: T.accent }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: '17px', fontWeight: 700, color: T.text, margin: 0 }}>Notifications</h1>
                            <p style={{ fontSize: '12px', color: T.muted, margin: 0 }}>
                                {error && notifications.length === 0 ? 'Couldn’t load notifications' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                                {activeWorkspace?.name ? ` · ${activeWorkspace.name}` : ''}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            onClick={refresh}
                            disabled={loading}
                            title="Refresh"
                            style={{ padding: '6px', background: 'none', border: `1px solid ${T.border}`, color: T.muted, cursor: 'pointer', display: 'flex', alignItems: 'center', transition: '150ms ease', opacity: loading ? 0.5 : 1 }}
                            onMouseEnter={e => e.currentTarget.style.color = T.text}
                            onMouseLeave={e => e.currentTarget.style.color = T.muted}
                        >
                            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>

                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: T.accentBg, border: `1px solid ${T.borderHover}`, color: T.accent, fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: T.font, transition: '150ms ease' }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = T.borderHover; }}
                            >
                                <Check size={13} /> Mark all read
                            </button>
                        )}

                        {notifications.length > 0 && !confirmClear && (
                            <button
                                onClick={() => setConfirmClear(true)}
                                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', background: 'transparent', border: `1px solid ${T.border}`, color: T.muted, fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: T.font, transition: '150ms ease' }}
                                onMouseEnter={e => { e.currentTarget.style.color = T.danger; e.currentTarget.style.borderColor = T.danger; }}
                                onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
                            >
                                <Trash2 size={13} /> Clear all
                            </button>
                        )}
                        {confirmClear && (
                            <div role="alertdialog" aria-label="Clear all notifications?" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 3px 3px 10px', border: `1px solid ${T.borderHover}`, background: 'var(--bg-active)' }}>
                                <span style={{ fontSize: '12px', color: T.text }}>Clear all notifications?</span>
                                <button
                                    onClick={() => setConfirmClear(false)}
                                    disabled={clearing}
                                    style={{ padding: '4px 10px', fontSize: '12px', background: 'transparent', border: `1px solid ${T.border}`, color: T.secondary, cursor: 'pointer', fontFamily: T.font }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={doClearAll}
                                    disabled={clearing}
                                    style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px', fontWeight: 600, background: T.danger, border: `1px solid ${T.danger}`, color: 'var(--bg-base)', cursor: clearing ? 'wait' : 'pointer', fontFamily: T.font }}
                                >
                                    {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Clear
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {}
            <div style={{ flexShrink: 0, background: T.surface, borderBottom: `1px solid ${T.border}`, padding: '0 24px' }}>
                <div style={{ maxWidth: '760px', margin: '0 auto', display: 'flex', gap: '0', overflowX: 'auto' }}>
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                style={{
                                    flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px',
                                    padding: '10px 14px', fontSize: '12px', fontWeight: isActive ? 700 : 400,
                                    color: isActive ? T.accent : T.muted,
                                    background: 'transparent', border: 'none', borderBottom: `2px solid ${isActive ? T.accent : 'transparent'}`,
                                    cursor: 'pointer', fontFamily: T.font, transition: 'all 150ms ease', whiteSpace: 'nowrap',
                                }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = T.text; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = T.muted; }}
                            >
                                {tab.Icon && <tab.Icon size={12} />}
                                {tab.label}
                                {tab.key === 'unread' && unreadCount > 0 && (
                                    <span style={COUNT_BADGE_STYLE}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {}
            <div style={{ flex: 1, overflowY: 'auto' }}>
                {activeTab === 'settings' ? (
                    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 24px' }}>
                        <NotificationPreferences workspaceId={workspaceId} />
                    </div>
                ) : (
                    <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 24px' }}>
                        {loading && notifications.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '96px', gap: '12px', color: T.muted }}>
                                <Loader2 size={28} className="animate-spin" style={{ color: T.accent }} />
                                <p style={{ fontSize: '13px', fontFamily: T.font }}>Loading notifications…</p>
                            </div>
                        ) : error && notifications.length === 0 ? (
                            <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '96px', gap: '10px' }}>
                                <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-hover)', border: `1px solid ${T.border}` }}>
                                    <AlertCircle size={24} style={{ color: T.danger }} />
                                </div>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: T.text, fontFamily: T.font, margin: 0 }}>Couldn’t load notifications</p>
                                <p style={{ fontSize: '12px', color: T.secondary, fontFamily: T.font, margin: 0 }}>{error}</p>
                                <button
                                    onClick={refresh}
                                    style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: 500, color: T.text, background: 'var(--bg-active)', border: `1px solid ${T.borderHover}`, cursor: 'pointer', fontFamily: T.font }}
                                >
                                    <RefreshCcw size={13} /> Try again
                                </button>
                            </div>
                        ) : filtered.length === 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '96px', gap: '12px' }}>
                                <div style={{ width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-hover)', border: `1px solid ${T.border}` }}>
                                    <Bell size={24} style={{ color: T.dim }} />
                                </div>
                                <p style={{ fontSize: '14px', fontWeight: 600, color: T.muted, fontFamily: T.font }}>
                                    {activeTab === 'all' ? 'No notifications yet' : `No ${activeTab} notifications`}
                                </p>
                                <p style={{ fontSize: '12px', color: T.dim, fontFamily: T.font }}>
                                    {activeTab === 'all' ? "You're all caught up." : 'Try a different filter'}
                                </p>
                            </div>
                        ) : (
                            <>
                                {renderGroup('Today', groups.Today)}
                                {renderGroup('Yesterday', groups.Yesterday)}
                                {renderGroup('Older', groups.Older)}

                                {hasMore && (
                                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                                        <button
                                            onClick={loadMore}
                                            disabled={loading}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px', fontSize: '12px', fontWeight: 500, color: T.muted, background: 'transparent', border: `1px solid ${T.border}`, cursor: 'pointer', fontFamily: T.font, transition: '150ms ease', opacity: loading ? 0.5 : 1 }}
                                            onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.borderHover; }}
                                            onMouseLeave={e => { e.currentTarget.style.color = T.muted; e.currentTarget.style.borderColor = T.border; }}
                                        >
                                            {loading ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
                                            Load more
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
