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
import { PanelEmpty } from '../components/layout/WorkspacePanel';
import '../styles/gloss.css';
import '../styles/gloss-x-panels.css';


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
                <div className="gl-x-group-label">{label}</div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {items.map(n => {
                        const { Icon, color: dot, label: typeLabel } = notificationTypeMeta(n.type);
                        const href = notificationHref(n, workspaceId);
                        return (
                            <div
                                key={n._id}
                                onClick={() => handleClick(n)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) handleClick(n); }}
                                tabIndex={0}
                                role="button"
                                className={`gl-card gl-x-row gl-x-notif${n.read ? '' : ' is-unread'}`}
                                style={{ cursor: href ? 'pointer' : 'default' }}
                            >
                                <div className="gl-x-notif-icon">
                                    <Icon size={15} style={{ color: dot }} />
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                <span style={{ fontSize: '13px', fontWeight: n.read ? 500 : 700, color: n.read ? 'var(--text-secondary)' : 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {n.title}
                                                </span>
                                                {!n.read && (
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
                                                )}
                                                <span className="gl-x-badge">{typeLabel}</span>
                                            </div>
                                            {n.body && (
                                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                    {n.body}
                                                </p>
                                            )}
                                            <p style={{ fontSize: '10.5px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                                                {timeAgo(n.createdAt)}
                                            </p>
                                        </div>

                                        <div className="gl-x-reveal" style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                                            {href && (
                                                <button type="button" className="gl-icon-btn gl-x-xs" title="Open" aria-label="Open"
                                                    onClick={e => { e.stopPropagation(); handleClick(n); }}>
                                                    <ExternalLink size={12} />
                                                </button>
                                            )}
                                            <button type="button" className="gl-icon-btn gl-x-xs gl-x-danger" title="Dismiss" aria-label={`Dismiss: ${n.title}`}
                                                onClick={e => { e.stopPropagation(); dismiss(n._id); }}>
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

    const lead = error && notifications.length === 0 ? 'Couldn’t load notifications' : unreadCount > 0 ? `${unreadCount} unread` : 'All caught up';

    return (
        <div className="gl-x-page" style={{ '--gl-x-page-w': '816px' }}>

            <div className="gl-x-page-top gl-ambient">
                <div className="gl-page-head gl-x-wrap">
                    <div className="gl-x-head-row">
                        <span className="gl-x-head-mark" aria-hidden="true"><Bell size={19} /></span>
                        <div style={{ minWidth: 0 }}>
                            <span className="gl-eyebrow">{activeWorkspace?.name || 'Workspace'}</span>
                            <h1 className="gl-page-title">Notifications</h1>
                            <p className="gl-page-lead">{lead}</p>
                        </div>
                    </div>

                    <div className="gl-x-head-actions">
                        <button type="button" className="gl-icon-btn" onClick={refresh} disabled={loading} title="Refresh" aria-label="Refresh" style={{ width: 32, height: 32, border: '1px solid var(--border-default)' }}>
                            <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                        </button>

                        {unreadCount > 0 && (
                            <button type="button" className="gl-btn gl-btn--primary" onClick={markAllRead}>
                                <Check size={13} /> Mark all read
                            </button>
                        )}

                        {notifications.length > 0 && !confirmClear && (
                            <button type="button" className="gl-btn gl-x-danger" onClick={() => setConfirmClear(true)}>
                                <Trash2 size={13} /> Clear all
                            </button>
                        )}
                        {confirmClear && (
                            <div role="alertdialog" aria-label="Clear all notifications?" className="gl-card gl-x-confirm">
                                <span>Clear all notifications?</span>
                                <button type="button" className="gl-btn gl-btn--sm" onClick={() => setConfirmClear(false)} disabled={clearing}>
                                    Cancel
                                </button>
                                <button type="button" className="gl-btn gl-btn--sm gl-x-danger-solid" onClick={doClearAll} disabled={clearing}>
                                    {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Clear
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="gl-x-wrap gl-x-page-tabs">
                    <div className="gl-tabs gl-x-tabs-fit" role="tablist" aria-label="Notification filters">
                        {TABS.map(tab => (
                            <button key={tab.key} type="button" role="tab" className="gl-tab" aria-selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
                                {tab.Icon && <tab.Icon size={12} />}
                                {tab.label}
                                {tab.key === 'unread' && unreadCount > 0 && (
                                    <span style={COUNT_BADGE_STYLE}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="gl-x-page-body">
                <div className="gl-x-wrap gl-x-page-pad">
                    {activeTab === 'settings' ? (
                        <NotificationPreferences workspaceId={workspaceId} />
                    ) : loading && notifications.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: '72px', gap: '12px', color: 'var(--text-secondary)' }}>
                            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
                            <p style={{ fontSize: '13px', margin: 0 }}>Loading notifications…</p>
                        </div>
                    ) : error && notifications.length === 0 ? (
                        <div role="alert" style={{ paddingTop: '48px' }}>
                            <PanelEmpty icon={AlertCircle} title="Couldn’t load notifications" text={error}
                                action={<button type="button" className="gl-btn" onClick={refresh}><RefreshCcw size={13} /> Try again</button>} />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div style={{ paddingTop: '48px' }}>
                            <PanelEmpty icon={Bell}
                                title={activeTab === 'all' ? 'No notifications yet' : `No ${activeTab} notifications`}
                                text={activeTab === 'all' ? "You're all caught up." : 'Try a different filter'} />
                        </div>
                    ) : (
                        <>
                            {renderGroup('Today', groups.Today)}
                            {renderGroup('Yesterday', groups.Yesterday)}
                            {renderGroup('Older', groups.Older)}

                            {hasMore && (
                                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
                                    <button type="button" className="gl-btn" onClick={loadMore} disabled={loading}>
                                        {loading ? <Loader2 size={13} className="animate-spin" /> : <ChevronDown size={13} />}
                                        Load more
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
