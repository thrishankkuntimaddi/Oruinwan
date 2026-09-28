import React, { useEffect } from 'react';
import { ChevronUp, ChevronDown, Minus, ChevronsUp, ChevronsDown, CheckSquare, Bug, Zap, CornerDownRight, X } from 'lucide-react';
import { STATUS_META, PRIORITY_META, statusLabel, priorityLabel, isClosed, toDateInput } from '../../utils/taskMeta';
import { getAvatarUrl } from '../../utils/avatarUtils';
import { formatDate as formatUserDate, isDateOnly } from '../../utils/userDateFormat';
import { getUserPreferences } from '../../hooks/useUserPreferences';
import './tasks.css';

export const FONT = 'var(--font)';

/** Background/border tints derived from a status/priority colour (works with CSS variables). */
export const tint = (color, pct) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/**
 * A date in the user's format (Settings → Language & region). Pass opts without
 * `year` for the compact card form (Sep 28 / 28 Sep).
 */
export function fmtDate(d, opts = { month: 'short', day: 'numeric', year: 'numeric' }) {
    if (!d) return '';
    // Date-only values (due dates) are stored as UTC midnight: keep that calendar day.
    return formatUserDate(d, getUserPreferences().region, { year: !!opts?.year, dateOnly: isDateOnly(d) });
}

export function isOverdue(task) {
    if (!task?.dueDate || isClosed(task.status)) return false;
    // Compare calendar days: a task due today is not overdue until tomorrow.
    return toDateInput(task.dueDate) < toDateInput(new Date());
}

export function StatusBadge({ status, compact = false }) {
    const meta = STATUS_META[status] || STATUS_META.todo;
    return (
        <span title={statusLabel(status)} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%',
            padding: compact ? '2px 6px' : '3px 8px', borderRadius: '2px',
            fontSize: '11px', fontWeight: 600, fontFamily: FONT, whiteSpace: 'nowrap',
            color: 'var(--text-primary)', background: tint(meta.color, 14), border: `1px solid ${tint(meta.color, 38)}`,
        }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '1px', background: meta.color, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{statusLabel(status)}</span>
        </span>
    );
}

export function PriorityIcon({ priority, size = 14 }) {
    const color = PRIORITY_META[priority]?.color || PRIORITY_META.medium.color;
    const Icon = { highest: ChevronsUp, high: ChevronUp, low: ChevronDown, lowest: ChevronsDown }[priority] || Minus;
    return <Icon size={size} strokeWidth={2.5} style={{ color, flexShrink: 0 }} aria-hidden />;
}

export function PriorityTag({ priority, size = 12 }) {
    return (
        <span title={`${priorityLabel(priority)} priority`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', fontFamily: FONT, whiteSpace: 'nowrap' }}>
            <PriorityIcon priority={priority} size={size} />
            {priorityLabel(priority)}
        </span>
    );
}

const ISSUE_TYPES = {
    task: { label: 'Task', color: '#6ea8fe', Icon: CheckSquare },
    bug: { label: 'Bug', color: '#e05252', Icon: Bug },
    epic: { label: 'Epic', color: '#b59cff', Icon: Zap },
    subtask: { label: 'Subtask', color: '#5ac8d8', Icon: CornerDownRight },
};

export function IssueTypeIcon({ type = 'task', size = 11 }) {
    const meta = ISSUE_TYPES[type] || ISSUE_TYPES.task;
    const { Icon } = meta;
    return (
        <span title={meta.label} style={{ width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '2px', background: tint(meta.color, 16), flexShrink: 0 }}>
            <Icon size={size} strokeWidth={2.5} style={{ color: meta.color }} />
        </span>
    );
}

export function UserAvatar({ user, size = 22, ring = false }) {
    const name = user?.username || user?.name || '?';
    return (
        <img
            src={getAvatarUrl({ _id: user?.id || user?._id, username: name, profilePicture: user?.profilePicture })}
            alt={name}
            title={name}
            width={size}
            height={size}
            style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, background: 'var(--bg-active)', boxShadow: ring ? '0 0 0 2px var(--bg-surface)' : 'none' }}
        />
    );
}

/** Overlapping avatars for multi-assignee tasks (max `max`, then +N). */
export function AvatarStack({ users = [], size = 22, max = 3 }) {
    if (!users.length) return <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>—</span>;
    const shown = users.slice(0, max);
    const extra = users.length - shown.length;
    return (
        <span title={users.map((u) => u.username).join(', ')} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {shown.map((u, i) => (
                <span key={u.id || i} style={{ marginLeft: i === 0 ? 0 : -Math.round(size / 3), display: 'inline-flex' }}>
                    <UserAvatar user={u} size={size} ring />
                </span>
            ))}
            {extra > 0 && (
                <span style={{ marginLeft: -Math.round(size / 3), width: size, height: size, borderRadius: '50%', background: 'var(--bg-active)', boxShadow: '0 0 0 2px var(--bg-surface)', color: 'var(--text-secondary)', fontSize: '9px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    +{extra}
                </span>
            )}
        </span>
    );
}

/** Modal shell matching the Create Channel modal (sharp corners, app tokens, Esc closes). */
export function TaskDialog({ title, subtitle, icon, onClose, children, footer, width = 440, zIndex = 70, accent = 'var(--accent)' }) {
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (
        <div className="tasks-ui" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}
            style={{ position: 'fixed', inset: 0, zIndex, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'var(--bg-overlay)', backdropFilter: 'blur(4px)', fontFamily: FONT }}
            onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div style={{ width: '100%', maxWidth: width, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: '2px', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '1px solid var(--border-default)' }}>
                    {icon && (
                        <span style={{ width: '32px', height: '32px', borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tint(accent, 15), border: `1px solid ${tint(accent, 35)}`, color: accent, flexShrink: 0 }}>{icon}</span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.015em' }}>{title}</h3>
                        {subtitle && <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</p>}
                    </div>
                    <button type="button" className="tk-icon-btn danger" onClick={onClose} aria-label="Close"><X size={16} /></button>
                </div>
                <div style={{ padding: '18px 20px', overflowY: 'auto' }}>{children}</div>
                {footer && (
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px', borderTop: '1px solid var(--border-default)', background: 'var(--bg-base)' }}>{footer}</div>
                )}
            </div>
        </div>
    );
}
