import {
    AtSign, MessageCircle, Check, UserPlus, Bell, Trash2, ExternalLink,
    GitBranch, Calendar, Zap, Brain, AlertTriangle, Pin, Headphones, Smile, ArrowRightLeft,
    Clock, FileText,
} from 'lucide-react';

/**
 * One place for how each stored notification type looks (bell, the
 * Notifications page, the /workspaces bell). `color` is always a theme token.
 * `tab` is the Notifications page filter the type belongs to.
 */
export const NOTIFICATION_TYPE_META = {
    mention:           { label: 'Mention',     Icon: AtSign,         color: 'var(--accent)',          tab: 'mentions' },
    dm:                { label: 'Message',     Icon: MessageCircle,  color: 'var(--text-secondary)',  tab: 'messages' },
    thread_reply:      { label: 'Thread',      Icon: GitBranch,      color: 'var(--text-secondary)',  tab: 'messages' },
    reaction:          { label: 'Reaction',    Icon: Smile,          color: 'var(--text-secondary)',  tab: 'all' },
    task_assigned:     { label: 'Task',        Icon: Check,          color: 'var(--state-success)',   tab: 'tasks' },
    task_comment:      { label: 'Task',        Icon: MessageCircle,  color: 'var(--text-secondary)',  tab: 'tasks' },
    task_status:       { label: 'Status',      Icon: ArrowRightLeft, color: 'var(--accent)',          tab: 'tasks' },
    task_due_soon:     { label: 'Due soon',    Icon: Clock,          color: 'var(--accent)',          tab: 'tasks' },
    task_updated:      { label: 'Task',        Icon: Check,          color: 'var(--text-secondary)',  tab: 'tasks' },
    task_removed:      { label: 'Task',        Icon: Trash2,         color: 'var(--state-danger)',    tab: 'tasks' },
    task_transfer:     { label: 'Transfer',    Icon: ExternalLink,   color: 'var(--accent)',          tab: 'tasks' },
    note_shared:       { label: 'Note',        Icon: FileText,       color: 'var(--text-secondary)',  tab: 'all' },
    member_joined:     { label: 'Team',        Icon: UserPlus,       color: 'var(--state-success)',   tab: 'team' },
    channel_pinned:    { label: 'Channel',     Icon: Pin,            color: 'var(--accent)',          tab: 'all' },
    huddle_started:    { label: 'Huddle',      Icon: Headphones,     color: 'var(--state-danger)',    tab: 'all' },
    schedule_created:  { label: 'Meeting',     Icon: Calendar,       color: 'var(--accent)',          tab: 'all' },
    meeting_reminder:  { label: 'Meeting',     Icon: Calendar,       color: 'var(--accent)',          tab: 'all' },
    integration_alert: { label: 'Integration', Icon: AlertTriangle,  color: 'var(--accent)',          tab: 'all' },
    ai_suggestion:     { label: 'AI',          Icon: Brain,          color: 'var(--accent)',          tab: 'all' },
    digest:            { label: 'Digest',      Icon: Zap,            color: 'var(--text-secondary)',  tab: 'all' },
};

const FALLBACK = { label: 'Notice', Icon: Bell, color: 'var(--text-secondary)', tab: 'all' };

export function notificationTypeMeta(type) {
    return NOTIFICATION_TYPE_META[type] || FALLBACK;
}

export function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return d === 1 ? 'yesterday' : `${d}d ago`;
}

/** Small, square (2px) count badge used on bells and tabs. */
export const COUNT_BADGE_STYLE = {
    minWidth: 15,
    height: 15,
    padding: '0 4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    background: 'var(--accent)',
    color: 'var(--bg-base)',
    fontSize: 9,
    fontWeight: 700,
    lineHeight: 1,
    boxSizing: 'border-box',
};
