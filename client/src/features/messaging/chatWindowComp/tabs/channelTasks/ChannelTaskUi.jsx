import React, { useEffect, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, Minus, AlertTriangle, CheckCircle2, Zap, X } from 'lucide-react';
import { STATUS_META, PRIORITY_META, statusLabel } from '../../../../../utils/taskMeta';
import { useTheme } from '../../../../../contexts/ThemeContext';
import { FONT, initials, avatarColor } from './channelTaskUtils';

/** 'light' | 'dark' following the app theme (html.light), for native inputs. */
export function useColorScheme() {
    useTheme();
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.classList.contains('light') ? 'light' : 'dark';
}

export const tint = (color, pct = 14) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

/** Status/priority colours are tuned for dark; pull them towards the text colour so they read in both themes. */
export const readable = (color) => `color-mix(in srgb, ${color} 68%, var(--text-primary))`;

export const sectionLabel = {
    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
    color: 'var(--text-secondary)', margin: '0 0 6px', fontFamily: FONT,
};

export function Avatar({ user, size = 18 }) {
    const pic = user?.profilePicture;
    return (
        <span title={user?.username || ''} style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: avatarColor(user), color: '#0c0c0c',
            fontSize: Math.max(8, Math.round(size * 0.42)), fontWeight: 700, fontFamily: FONT,
        }}>
            {pic ? <img src={pic} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(user)}
        </span>
    );
}

export function StatusBadge({ status }) {
    const color = STATUS_META[status]?.color || 'var(--text-secondary)';
    return (
        <span data-testid="task-status-badge" style={{
            display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
            padding: '2px 8px', borderRadius: '2px',
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
            backgroundColor: tint(color, 16), color: readable(color), border: `1px solid ${tint(color, 40)}`,
            fontFamily: FONT,
        }}>{statusLabel(status)}</span>
    );
}

export function PriorityIcon({ priority, size = 14 }) {
    const color = PRIORITY_META[priority]?.color || PRIORITY_META.medium.color;
    const style = { color: readable(color), flexShrink: 0 };
    if (priority === 'highest') return <ChevronUp size={size} strokeWidth={3} style={style} />;
    if (priority === 'high') return <ChevronUp size={size} strokeWidth={2} style={style} />;
    if (priority === 'low') return <ChevronDown size={size} strokeWidth={2} style={style} />;
    if (priority === 'lowest') return <ChevronDown size={size} strokeWidth={3} style={style} />;
    return <Minus size={size} strokeWidth={2.5} style={style} />;
}

const ISSUE_TYPE_META = {
    epic: { label: 'Epic', color: '#b59cff', Icon: Zap },
    bug: { label: 'Bug', color: '#e05252', Icon: AlertTriangle },
    story: { label: 'Story', color: '#5aba8a', Icon: CheckCircle2 },
    subtask: { label: 'Subtask', color: '#6ea8fe', Icon: CheckCircle2 },
    task: { label: 'Task', color: 'var(--accent)', Icon: CheckCircle2 },
};

export function IssueTypeIcon({ type = 'task', size = 10 }) {
    const meta = ISSUE_TYPE_META[type] || ISSUE_TYPE_META.task;
    const { Icon, color } = meta;
    return (
        <span title={meta.label} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '2px', flexShrink: 0, width: 16, height: 16, background: tint(color, 18),
        }}>
            <Icon size={size} style={{ color }} strokeWidth={2.5} />
        </span>
    );
}

export function IconButton({ title, onClick, children, danger = false, style, ...rest }) {
    const [hover, setHover] = useState(false);
    return (
        <button type="button" title={title} aria-label={title} onClick={onClick}
            onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
            style={{
                padding: '3px', borderRadius: '2px', background: hover ? 'var(--bg-hover)' : 'none', border: 'none',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                color: hover ? (danger ? 'var(--state-danger)' : 'var(--text-primary)') : 'var(--text-secondary)',
                transition: 'color 150ms ease, background-color 150ms ease', ...style,
            }} {...rest}>
            {children}
        </button>
    );
}

/** Small modal asking why a task is blocked (the server requires a reason). */
export function BlockedReasonDialog({ taskTitle, onConfirm, onCancel }) {
    const [reason, setReason] = useState('');
    const ref = useRef(null);
    useEffect(() => { ref.current?.focus(); }, []);
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onCancel(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onCancel]);
    const ok = reason.trim().length > 0;
    const submit = (e) => { e?.preventDefault(); if (ok) onConfirm(reason.trim()); };
    return (
        <div role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }} style={{
            position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'var(--bg-overlay, rgba(0,0,0,0.6))',
        }}>
            <form role="dialog" aria-label="Block task" onSubmit={submit} style={{
                width: 380, maxWidth: 'calc(100vw - 32px)', backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)', borderRadius: '2px', fontFamily: FONT,
                boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--state-danger)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Mark as blocked</span>
                    <IconButton title="Cancel" onClick={onCancel}><X size={14} /></IconButton>
                </div>
                <div style={{ padding: 16 }}>
                    {taskTitle && <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{taskTitle}</p>}
                    <label htmlFor="blocked-reason" style={sectionLabel}>What is blocking it? *</label>
                    <input id="blocked-reason" ref={ref} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Waiting on API keys"
                        style={{
                            width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: 13, fontFamily: FONT,
                            background: 'var(--bg-input)', color: 'var(--text-primary)',
                            border: '1px solid var(--border-default)', borderRadius: '2px', outline: 'none',
                        }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '0 16px 14px' }}>
                    <button type="button" onClick={onCancel} style={secondaryBtn}>Cancel</button>
                    <button type="submit" disabled={!ok} style={{
                        ...primaryBtn, backgroundColor: ok ? 'var(--state-danger)' : 'var(--bg-active)',
                        color: ok ? '#fff' : 'var(--text-muted)', cursor: ok ? 'pointer' : 'not-allowed',
                    }}>Block task</button>
                </div>
            </form>
        </div>
    );
}

export const primaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', fontSize: 12, fontWeight: 600, fontFamily: FONT,
    color: '#0c0c0c', backgroundColor: 'var(--accent)', border: 'none', borderRadius: '2px', cursor: 'pointer',
};

export const secondaryBtn = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', fontSize: 12, fontWeight: 500, fontFamily: FONT,
    color: 'var(--text-secondary)', backgroundColor: 'var(--bg-active)',
    border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer',
};
