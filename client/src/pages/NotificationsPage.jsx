import React, { useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Bell, AtSign, UserPlus, Check, MessageCircle,
    Trash2, Filter, RefreshCcw, Loader2, ExternalLink,
    ChevronDown, X
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationsContext';
import { useWorkspace } from '../contexts/WorkspaceContext';

// ── Type metadata ──────────────────────────────────────────────────────────
const TYPE_META = {
    mention: { label: 'Mentions', Icon: AtSign, color: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40', tabKey: 'mentions' },
    dm: { label: 'Messages', Icon: MessageCircle, color: 'text-sky-600 bg-sky-100 dark:bg-sky-900/40', tabKey: 'messages' },
    task_assigned: { label: 'Task', Icon: Check, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40', tabKey: 'tasks' },
    task_comment: { label: 'Task', Icon: MessageCircle, color: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40', tabKey: 'tasks' },
    member_joined: { label: 'Team', Icon: UserPlus, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40', tabKey: 'team' },
    channel_pinned: { label: 'Channel', Icon: Bell, color: 'text-violet-600 bg-violet-100 dark:bg-violet-900/40', tabKey: 'all' },
    huddle_started: { label: 'Huddle', Icon: Bell, color: 'text-red-500 bg-red-100 dark:bg-red-900/40', tabKey: 'all' },
    schedule_created: { label: 'Meeting', Icon: Bell, color: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40', tabKey: 'all' },
    reaction: { label: 'Reaction', Icon: Bell, color: 'text-pink-600 bg-pink-100 dark:bg-pink-900/40', tabKey: 'all' },
};

const TABS = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'mentions', label: 'Mentions' },
    { key: 'messages', label: 'Messages' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'team', label: 'Team' },
];

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'yesterday' : `${d}d ago`;
}

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
        notifications, unreadCount, loading, hasMore,
        loadMore, refresh, markRead, markAllRead, dismiss, clearAll,
    } = useNotifications();

    const [activeTab, setActiveTab] = useState('all');

    // ── Filter logic ──────────────────────────────────────────────────
    const filtered = notifications.filter(n => {
        if (activeTab === 'all') return true;
        if (activeTab === 'unread') return !n.read;
        const meta = TYPE_META[n.type];
        return meta?.tabKey === activeTab;
    });

    const groups = groupByDay(filtered);

    const handleClick = useCallback((n) => {
        if (!n.read) markRead(n._id);
        if (n.link) navigate(`/workspace/${workspaceId}${n.link}`);
    }, [markRead, navigate, workspaceId]);

    // ── Render helpers ────────────────────────────────────────────────
    const renderGroup = (label, items) => {
        if (!items.length) return null;
        return (
            <div key={label} className="mb-6">
                <div className="flex items-center gap-3 mb-2 px-1">
                    <span className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{label}</span>
                    <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
                </div>
                <div className="space-y-1">
                    {items.map(n => {
                        const { Icon, color, label: typeLabel } = TYPE_META[n.type] || TYPE_META.channel_pinned;
                        return (
                            <div
                                key={n._id}
                                onClick={() => handleClick(n)}
                                className={`group flex items-start gap-4 p-3.5 rounded-xl cursor-pointer transition-all border
                                    ${n.read
                                        ? 'bg-white dark:bg-gray-800/50 border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800'
                                        : 'bg-indigo-50/40 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50 hover:bg-indigo-50/70'
                                    }`}
                            >
                                {/* Icon */}
                                <div className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                                    <Icon size={18} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`text-sm font-semibold truncate ${n.read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-white'}`}>
                                                    {n.title}
                                                </span>
                                                {!n.read && (
                                                    <span className="flex-shrink-0 w-2 h-2 rounded-full bg-indigo-500" />
                                                )}
                                                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                                                    {typeLabel}
                                                </span>
                                            </div>
                                            {n.body && (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{n.body}</p>
                                            )}
                                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo(n.createdAt)}</p>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {n.link && (
                                                <div className="p-1.5 rounded-lg text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 hover:text-indigo-600"
                                                    title="Open"
                                                    onClick={e => { e.stopPropagation(); handleClick(n); }}
                                                >
                                                    <ExternalLink size={13} />
                                                </div>
                                            )}
                                            <button
                                                onClick={e => { e.stopPropagation(); dismiss(n._id); }}
                                                className="p-1.5 rounded-lg text-gray-300 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors"
                                                title="Dismiss"
                                            >
                                                <X size={13} />
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
        <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-950">
            {/* Page Header */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
                <div className="flex items-center justify-between max-w-3xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/40">
                            <Bell size={20} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Notifications</h1>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                                {activeWorkspace?.name ? ` · ${activeWorkspace.name}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={refresh}
                            disabled={loading}
                            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                            title="Refresh"
                        >
                            <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                            >
                                <Check size={14} /> Mark all read
                            </button>
                        )}
                        {notifications.length > 0 && (
                            <button
                                onClick={clearAll}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 hover:border-red-200 transition-colors"
                            >
                                <Trash2 size={14} /> Clear all
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex-shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6">
                <div className="max-w-3xl mx-auto flex gap-1 overflow-x-auto scrollbar-none">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex-shrink-0 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                                ${activeTab === tab.key
                                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                                }`}
                        >
                            {tab.label}
                            {tab.key === 'unread' && unreadCount > 0 && (
                                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600 text-white">
                                    {unreadCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Notification Feed */}
            <div className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 py-6">
                    {loading && notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                            <Loader2 size={32} className="animate-spin mb-3" />
                            <p className="text-sm">Loading notifications…</p>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                                <Bell size={28} className="opacity-40" />
                            </div>
                            <p className="text-base font-semibold text-gray-500 dark:text-gray-400">
                                {activeTab === 'all' ? 'No notifications yet' : `No ${activeTab} notifications`}
                            </p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                                {activeTab === 'all' ? 'You\'re all caught up! 🎉' : 'Try a different filter'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {renderGroup('Today', groups.Today)}
                            {renderGroup('Yesterday', groups.Yesterday)}
                            {renderGroup('Older', groups.Older)}

                            {/* Load more */}
                            {hasMore && (
                                <div className="flex justify-center mt-4">
                                    <button
                                        onClick={loadMore}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
                                    >
                                        {loading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
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
