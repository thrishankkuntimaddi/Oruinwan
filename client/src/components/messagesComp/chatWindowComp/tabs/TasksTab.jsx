/**
 * TasksTab.jsx — Jira-Grade Channel Task Board
 *
 * Discipline:
 *  - 5 column board: BACKLOG | TO DO | IN PROGRESS | IN REVIEW | DONE
 *  - BLOCKED tasks shown with red banner in their current column
 *  - Workflow state machine (mirrors backend workflowValidator.js)
 *  - Single-assignee per task, picked from workspace members
 *  - Subtasks as first-class citizens
 *  - Append-only activity log per task
 *  - Inline quick-add per column
 *  - Task detail side panel (click any card)
 */

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
    Plus, X, Loader2, ChevronUp, ChevronDown, Minus,
    Calendar, User, AlertTriangle, CheckCircle2, Clock,
    BookOpen, ArrowRight, RotateCcw, Tag, Flag, Bug,
    ListTodo, Eye, Activity, ChevronRight, Zap, Link2
} from 'lucide-react';
import api from '@services/api';
import { useWorkspace } from '../../../../contexts/WorkspaceContext';

// ─── Workflow State Machine (mirrors backend workflowValidator.js) ─────────────

const TRANSITIONS = {
    backlog: ['todo', 'cancelled'],
    todo: ['in_progress', 'backlog', 'cancelled'],
    in_progress: ['review', 'blocked', 'todo', 'cancelled'],
    review: ['done', 'in_progress', 'blocked'],
    blocked: ['in_progress', 'todo'],
    done: [],
    cancelled: [],
};

const COLUMNS = [
    { key: 'backlog', label: 'BACKLOG', color: '#8993A4', headerBg: 'rgba(137,147,164,0.12)', topColor: '#8993A4' },
    { key: 'todo', label: 'TO DO', color: '#a0aec0', headerBg: 'rgba(160,174,192,0.1)', topColor: '#a0aec0' },
    { key: 'in_progress', label: 'IN PROGRESS', color: '#b8956a', headerBg: 'rgba(184,149,106,0.1)', topColor: '#b8956a' },
    { key: 'review', label: 'IN REVIEW', color: '#9c7fd4', headerBg: 'rgba(156,127,212,0.1)', topColor: '#9c7fd4' },
    { key: 'done', label: 'DONE', color: '#48bb78', headerBg: 'rgba(72,187,120,0.1)', topColor: '#48bb78' },
];

const colMap = Object.fromEntries(COLUMNS.map(c => [c.key, c]));

const PRIORITIES = [
    { key: 'highest', label: 'Highest', color: '#CD1317' },
    { key: 'high', label: 'High', color: '#E97F33' },
    { key: 'medium', label: 'Medium', color: '#E2B203' },
    { key: 'low', label: 'Low', color: '#3E7FC1' },
    { key: 'lowest', label: 'Lowest', color: '#7A869A' },
];

const pMap = Object.fromEntries(PRIORITIES.map(p => [p.key, p]));
const pMeta = k => pMap[k] || pMap.medium;

const JIRA_BLUE = 'var(--accent)';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function allowedTransitions(status) {
    return TRANSITIONS[status] || [];
}

function initials(u) {
    if (!u) return '?';
    const name = u.username || u.name || '';
    return name.slice(0, 2).toUpperCase();
}

function avatarColor(u) {
    const colors = ['#6554C0', '#0052CC', '#00875A', '#FF5630', '#FF991F', '#36B37E', '#00B8D9'];
    const name = u?.username || u?.name || '';
    return colors[name.charCodeAt(0) % colors.length];
}

function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(task) {
    return task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done' && task.status !== 'cancelled';
}

// ─── Priority Icon ────────────────────────────────────────────────────────────

function PriorityIcon({ priority, size = 14 }) {
    const m = pMeta(priority);
    if (priority === 'highest') return <ChevronUp size={size} strokeWidth={3} style={{ color: m.color }} />;
    if (priority === 'high') return <ChevronUp size={size} strokeWidth={2} style={{ color: m.color }} />;
    if (priority === 'low') return <ChevronDown size={size} strokeWidth={2} style={{ color: m.color }} />;
    if (priority === 'lowest') return <ChevronDown size={size} strokeWidth={3} style={{ color: m.color }} />;
    return <Minus size={size} strokeWidth={2.5} style={{ color: m.color }} />;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
    const m = colMap[status] || colMap.todo;
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            padding: '1px 8px', borderRadius: '2px',
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
            backgroundColor: m.headerBg, color: m.color,
            border: `1px solid ${m.topColor}30`,
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        }}>
            {m.label}
        </span>
    );
}

// ─── Issue Type Icon (Jira-discipline) ────────────────────────────────────────

const ISSUE_TYPE_META = {
    epic: { label: 'Epic', color: '#9c7fd4', bg: 'rgba(156,127,212,0.15)', Icon: Zap },
    bug: { label: 'Bug', color: '#fc8181', bg: 'rgba(252,129,129,0.15)', Icon: AlertTriangle },
    subtask: { label: 'Subtask', color: '#63b3ed', bg: 'rgba(99,179,237,0.15)', Icon: CheckCircle2 },
    task: { label: 'Task', color: '#b8956a', bg: 'rgba(184,149,106,0.15)', Icon: CheckCircle2 },
};

function IssueTypeIcon({ type = 'task', size = 12 }) {
    const meta = ISSUE_TYPE_META[type] || ISSUE_TYPE_META.task;
    const { Icon, color, bg } = meta;
    return (
        <span title={meta.label} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: '2px', flexShrink: 0, width: 16, height: 16, background: bg,
        }}>
            <Icon size={size} style={{ color }} strokeWidth={2.5} />
        </span>
    );
}

// ─── Inline Quick-Add ─────────────────────────────────────────────────────────

function InlineAdd({ defaultStatus, onSubmit, onCancel }) {
    const [title, setTitle] = useState('');
    const ref = useRef();
    useEffect(() => ref.current?.focus(), []);

    const submit = (e) => {
        e?.preventDefault();
        if (title.trim()) onSubmit(title.trim(), defaultStatus);
    };

    return (
        <div style={{
            borderRadius: '2px', border: '1px solid var(--accent)',
            backgroundColor: 'var(--bg-active)', marginBottom: '8px', overflow: 'hidden',
        }}>
            <input
                ref={ref}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
                onBlur={() => { if (!title.trim()) onCancel(); }}
                placeholder="What needs to be done?"
                style={{
                    width: '100%', padding: '8px 10px', fontSize: '13px',
                    backgroundColor: 'transparent', color: 'var(--text-primary)',
                    border: 'none', outline: 'none', boxSizing: 'border-box',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}
            />
            {title.trim() && (
                <div style={{ display: 'flex', gap: '6px', padding: '0 8px 8px' }}>
                    <button onMouseDown={submit} style={{
                        padding: '3px 10px', fontSize: '11px', fontWeight: 600,
                        color: '#0c0c0c', backgroundColor: 'var(--accent)',
                        border: 'none', borderRadius: '2px', cursor: 'pointer',
                    }}>Create</button>
                    <button onMouseDown={onCancel} style={{
                        padding: '3px 10px', fontSize: '11px',
                        color: 'var(--text-secondary)', backgroundColor: 'var(--bg-hover)',
                        border: '1px solid var(--border-default)', borderRadius: '2px', cursor: 'pointer',
                    }}>Cancel</button>
                </div>
            )}
        </div>
    );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onClick, onDelete }) {
    const blocked = task.status === 'blocked';
    const done = task.status === 'done';
    const overdue = isOverdue(task);
    const assignee = Array.isArray(task.assignedTo) ? task.assignedTo[0] : task.assignedTo;
    const subtaskCount = task.subtasks?.length || 0;

    const [cardHovered, setCardHovered] = React.useState(false);
    return (
        <div
            onClick={() => onClick(task)}
            onMouseEnter={() => setCardHovered(true)}
            onMouseLeave={() => setCardHovered(false)}
            style={{
                backgroundColor: cardHovered ? 'var(--bg-hover)' : 'var(--bg-active)',
                borderRadius: '2px', cursor: 'pointer', marginBottom: '6px', position: 'relative',
                border: blocked ? '1px solid var(--state-danger)' : `1px solid ${cardHovered ? 'var(--border-accent)' : 'var(--border-default)'}`,
                borderLeft: `3px solid ${pMeta(task.priority || 'medium').color}`,
                transition: 'background-color 150ms ease, border-color 150ms ease',
            }}
        >
            {blocked && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '6px 10px 3px', fontSize: '10px', fontWeight: 700,
                    color: 'var(--state-danger)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>
                    <AlertTriangle size={10} strokeWidth={2.5} />
                    BLOCKED{task.blockedReason ? `: ${task.blockedReason.slice(0, 40)}` : ''}
                </div>
            )}

            <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <IssueTypeIcon type={task.type || task.issueType || 'task'} size={10} />
                    {task.issueKey && (
                        <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {task.issueKey}
                        </span>
                    )}
                </div>

                <p style={{
                    fontSize: '13px', lineHeight: 1.4, marginBottom: '8px',
                    color: done ? 'var(--text-muted)' : 'var(--text-primary)',
                    textDecoration: done ? 'line-through' : 'none',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>{task.title}</p>

                {task.labels?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
                        {task.labels.slice(0, 3).map(l => (
                            <span key={l} style={{
                                padding: '1px 6px', borderRadius: '2px', fontSize: '10px',
                                backgroundColor: 'var(--bg-hover)', color: 'var(--text-muted)',
                                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                            }}>{l}</span>
                        ))}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <PriorityIcon priority={task.priority || 'medium'} size={13} />
                    {task.dueDate && (
                        <span style={{
                            display: 'flex', alignItems: 'center', gap: '3px',
                            fontSize: '10px', fontWeight: 500,
                            color: overdue ? 'var(--state-danger)' : 'var(--text-muted)',
                        }}><Calendar size={9} />{fmtDate(task.dueDate)}</span>
                    )}
                    {subtaskCount > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-muted)' }}>
                            <ListTodo size={9} /> {subtaskCount}
                        </span>
                    )}
                    <div style={{ flex: 1 }} />
                    <button onClick={e => { e.stopPropagation(); onDelete(task._id); }} style={{
                        padding: '2px', background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', opacity: cardHovered ? 1 : 0,
                        transition: 'opacity 150ms ease, color 150ms ease',
                    }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--state-danger)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    ><X size={11} /></button>
                    {assignee && (
                        <div style={{
                            width: 18, height: 18, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#0c0c0c', fontSize: '8px', fontWeight: 700, flexShrink: 0,
                            background: avatarColor(assignee),
                        }} title={assignee.username || assignee.name}>
                            {initials(assignee)}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({ col, tasks, blockedInCol, onCardClick, onDelete, onInlineAdd }) {
    const [adding, setAdding] = useState(false);
    const isTerminal = col.key === 'done' || col.key === 'cancelled';

    return (
        <div style={{
            flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0,
            backgroundColor: 'var(--bg-surface)', minWidth: 180,
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 10px', flexShrink: 0,
                borderTop: `2px solid ${col.topColor}`,
                borderBottom: '1px solid var(--border-subtle)',
            }}>
                <span style={{
                    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: col.color,
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>{col.label}</span>
                <span style={{
                    fontSize: '10px', fontWeight: 700,
                    width: 18, height: 18, borderRadius: '2px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: 'var(--bg-active)', color: 'var(--text-muted)',
                    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}>{tasks.length}</span>
                {blockedInCol > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 700, color: 'var(--state-danger)' }}>
                        <AlertTriangle size={9} /> {blockedInCol}
                    </span>
                )}
                <div style={{ flex: 1 }} />
                {!isTerminal && (
                    <button onClick={() => setAdding(v => !v)} title="Quick add" style={{
                        padding: '3px', borderRadius: '2px', background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--text-muted)', transition: 'color 150ms ease',
                    }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    ><Plus size={13} /></button>
                )}
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '6px 8px 8px' }}>
                {adding && (
                    <InlineAdd
                        defaultStatus={col.key}
                        onSubmit={(title, status) => { onInlineAdd(title, status); setAdding(false); }}
                        onCancel={() => setAdding(false)}
                    />
                )}
                {tasks.length === 0 && !adding ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60px', opacity: 0.4 }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>No issues</p>
                    </div>
                ) : (
                    tasks.map(t => <TaskCard key={t._id} task={t} onClick={onCardClick} onDelete={onDelete} />)
                )}
            </div>
        </div>
    );
}

// ─── Activity Log ─────────────────────────────────────────────────────────────

function ActivityLog({ taskId }) {
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!taskId) return;
        setLoading(true);
        api.get(`/api/v2/tasks/${taskId}/activity`)
            .then(r => setLog(r.data.activities || r.data.activity || []))
            .catch(() => setLog([]))
            .finally(() => setLoading(false));
    }, [taskId]);

    if (loading) return <div className="text-xs text-gray-400 p-2 animate-pulse">Loading activity…</div>;
    if (!log.length) return <div className="text-xs text-gray-400 p-2">No activity yet.</div>;

    const ACTION_ICONS = {
        created: <Plus size={11} className="text-green-600" />,
        status_changed: <ArrowRight size={11} className="text-blue-600" />,
        updated: <Activity size={11} className="text-orange-500" />,
        assignee_added: <User size={11} className="text-indigo-600" />,
        assignee_removed: <User size={11} className="text-red-500" />,
    };

    return (
        <div className="space-y-2 text-xs">
            {log.slice().reverse().map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                    <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {ACTION_ICONS[a.action] || <Activity size={11} className="text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className="font-medium text-gray-700">{a.user?.username || 'Someone'}</span>
                        {' '}
                        <span className="text-gray-500">
                            {a.action === 'created' && 'created this task'}
                            {a.action === 'status_changed' && `moved from ${a.from} → ${a.to}`}
                            {a.action === 'updated' && `updated ${a.field}`}
                            {a.action === 'assignee_added' && 'added an assignee'}
                            {a.action === 'assignee_removed' && 'removed an assignee'}
                            {!['created', 'status_changed', 'updated', 'assignee_added', 'assignee_removed'].includes(a.action) && a.action}
                        </span>
                        <p className="text-gray-400 text-[10px] mt-0.5">
                            {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Task Detail Panel ────────────────────────────────────────────────────────

function TaskDetailPanel({ task, members, onClose, onUpdate, onDelete }) {
    const [tab, setTab] = useState('details'); // details | activity
    const [editTitle, setEditTitle] = useState(false);
    const [title, setTitle] = useState(task.title);
    const [desc, setDesc] = useState(task.description || '');
    const [editDesc, setEditDesc] = useState(false);
    const [newSub, setNewSub] = useState('');
    const [addingSub, setAddingSub] = useState(false);
    const [subtasks, setSubtasks] = useState(task.subtasks || []);
    const [blockedReason, setBlockedReason] = useState('');
    const [showBlockedInput, setShowBlockedInput] = useState(false);
    const [pendingStatus, setPendingStatus] = useState(null);
    const [saving, setSaving] = useState(false);

    const assignee = Array.isArray(task.assignedTo) ? task.assignedTo[0] : task.assignedTo;
    const col = colMap[task.status] || colMap.todo;
    const allowed = allowedTransitions(task.status);

    const save = async (updates) => {
        setSaving(true);
        await onUpdate(task._id, updates);
        setSaving(false);
    };

    const handleStatusClick = (newStatus) => {
        if (newStatus === 'blocked') {
            setPendingStatus('blocked');
            setShowBlockedInput(true);
        } else {
            save({ status: newStatus });
        }
    };

    const confirmBlocked = () => {
        if (!blockedReason.trim()) return;
        save({ status: 'blocked', blockedReason: blockedReason.trim() });
        setShowBlockedInput(false);
        setPendingStatus(null);
        setBlockedReason('');
    };

    const addSubtask = async () => {
        if (!newSub.trim()) return;
        try {
            const res = await api.post(`/api/v2/tasks/${task._id}/subtasks`, {
                title: newSub.trim(),
                priority: 'medium'
            });
            setSubtasks(p => [...p, res.data.subtask || { title: newSub.trim(), _id: Date.now() }]);
            setNewSub('');
            setAddingSub(false);
        } catch (e) { console.error('Subtask failed', e); }
    };

    return (
        <div style={{
            width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column',
            height: '100%', backgroundColor: 'var(--bg-surface)',
            borderLeft: '1px solid var(--border-default)', overflow: 'hidden',
        }}>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', flexShrink: 0,
                borderBottom: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-active)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '2px', backgroundColor: col.color, flexShrink: 0 }} />
                    <StatusBadge status={task.status} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite', color: 'var(--text-muted)' }} />}
                    <button onClick={onClose} style={{
                        padding: '4px', borderRadius: '2px', background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--text-muted)', transition: 'color 150ms ease',
                    }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    ><X size={14} /></button>
                </div>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-default)' }}>
                {[
                    { key: 'details', label: 'Details', icon: <Eye size={12} /> },
                    { key: 'activity', label: 'Activity', icon: <Activity size={12} /> },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', fontSize: '12px', fontWeight: 500,
                        color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                        background: 'none', border: 'none',
                        borderBottom: tab === t.key ? '1px solid var(--accent)' : '1px solid transparent',
                        cursor: 'pointer', transition: 'color 150ms ease',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>{t.icon} {t.label}</button>
                ))}
            </div>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {tab === 'details' ? (
                    <div className="p-4 space-y-5">
                        {/* Title */}
                        <div>
                            {editTitle ? (
                                <input autoFocus value={title} onChange={e => setTitle(e.target.value)}
                                    onBlur={() => { save({ title: title.trim() || task.title }); setEditTitle(false); }}
                                    onKeyDown={e => e.key === 'Enter' && (save({ title: title.trim() }), setEditTitle(false))}
                                    className="w-full font-semibold text-sm text-gray-900 border-b-2 focus:outline-none pb-1"
                                    style={{ borderColor: JIRA_BLUE }} />
                            ) : (
                                <p onClick={() => setEditTitle(true)}
                                    className="font-semibold text-sm text-gray-900 cursor-pointer hover:bg-blue-50 rounded -mx-1 px-1 py-0.5 leading-snug">
                                    {task.title}
                                </p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Description</p>
                            {editDesc ? (
                                <textarea autoFocus value={desc} onChange={e => setDesc(e.target.value)}
                                    rows={3}
                                    onBlur={() => { save({ description: desc }); setEditDesc(false); }}
                                    className="w-full text-xs text-gray-700 border rounded p-2 focus:outline-none resize-none"
                                    style={{ borderColor: '#DFE1E6' }} />
                            ) : (
                                <p onClick={() => setEditDesc(true)}
                                    className="text-xs text-gray-600 cursor-pointer hover:bg-blue-50 rounded -mx-1 px-1 py-0.5 min-h-[24px]">
                                    {task.description || <span className="text-gray-400 italic">Click to add description…</span>}
                                </p>
                            )}
                        </div>

                        {/* Status transitions */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status</p>
                            <div className="flex flex-wrap gap-1.5">
                                {allowed.length === 0 ? (
                                    <span className="text-xs text-gray-400 italic">Terminal status — no transitions available</span>
                                ) : allowed.map(ns => {
                                    const nm = colMap[ns] || {};
                                    return (
                                        <button key={ns} onClick={() => handleStatusClick(ns)}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-bold uppercase tracking-wide transition-all hover:opacity-80"
                                            style={{ background: nm.headerBg || '#F4F5F7', color: nm.color || '#42526E', border: `1px solid ${nm.color || '#DFE1E6'}30` }}>
                                            <ChevronRight size={10} />
                                            {nm.label || ns}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Blocked reason input */}
                            {showBlockedInput && (
                                <div className="mt-2 p-2 bg-red-50 rounded border border-red-200">
                                    <p className="text-[10px] font-semibold text-red-600 mb-1">Reason for blocking *</p>
                                    <input value={blockedReason} onChange={e => setBlockedReason(e.target.value)}
                                        placeholder="What is blocking this task?"
                                        className="w-full text-xs border border-red-200 rounded p-1.5 focus:outline-none bg-white"
                                        onKeyDown={e => e.key === 'Enter' && confirmBlocked()}
                                    />
                                    <div className="flex gap-1.5 mt-1.5">
                                        <button onClick={confirmBlocked}
                                            className="px-2 py-1 text-[10px] font-semibold text-white rounded-sm bg-red-600">Confirm</button>
                                        <button onClick={() => { setShowBlockedInput(false); setPendingStatus(null); }}
                                            className="px-2 py-1 text-[10px] text-red-600 hover:bg-red-100 rounded-sm">Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Priority */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Priority</p>
                            <div className="flex flex-wrap gap-1">
                                {PRIORITIES.map(p => (
                                    <button key={p.key}
                                        onClick={() => save({ priority: p.key })}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all"
                                        style={{
                                            background: (task.priority || 'medium') === p.key ? `${p.color}18` : '#F4F5F7',
                                            color: p.color,
                                            border: (task.priority || 'medium') === p.key ? `1px solid ${p.color}` : '1px solid transparent',
                                        }}>
                                        <PriorityIcon priority={p.key} size={11} />
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Assignee */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Assignee</p>
                            {assignee ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                        style={{ background: avatarColor(assignee) }}>
                                        {initials(assignee)}
                                    </div>
                                    <span className="text-xs font-medium text-gray-700">{assignee.username || assignee.name}</span>
                                    <button onClick={() => save({ assignedTo: [] })}
                                        className="text-gray-300 hover:text-red-500 ml-auto">
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                                    {members.slice(0, 8).map(m => (
                                        <button key={m._id || m.id} onClick={() => save({ assignedTo: [m._id || m.id] })}
                                            className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-blue-50 transition-colors w-full text-left">
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                                                style={{ background: avatarColor(m) }}>
                                                {initials(m)}
                                            </div>
                                            <span className="text-xs text-gray-700 truncate">{m.username || m.name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Due date */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Due date</p>
                            <input type="date"
                                value={task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''}
                                onChange={e => save({ dueDate: e.target.value || null })}
                                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none text-gray-700"
                                style={{ borderColor: '#DFE1E6' }} />
                        </div>

                        {/* Subtasks */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Child Issues ({subtasks.length})</p>
                                <button onClick={() => setAddingSub(v => !v)}
                                    className="text-[10px] font-semibold hover:text-blue-600 transition-colors"
                                    style={{ color: JIRA_BLUE }}>
                                    + Add
                                </button>
                            </div>

                            {addingSub && (
                                <div className="flex gap-1.5 mb-2">
                                    <input value={newSub} onChange={e => setNewSub(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') addSubtask(); if (e.key === 'Escape') setAddingSub(false); }}
                                        placeholder="Subtask title..."
                                        className="flex-1 text-xs border rounded px-2 py-1 focus:outline-none"
                                        style={{ borderColor: JIRA_BLUE }}
                                        autoFocus />
                                    <button onClick={addSubtask}
                                        className="px-2 text-[10px] font-bold text-white rounded"
                                        style={{ background: JIRA_BLUE }}>Add</button>
                                </div>
                            )}

                            <div className="space-y-1">
                                {subtasks.map((s, i) => (
                                    <div key={s._id || i} className="flex items-center gap-2 text-xs text-gray-700 hover:bg-gray-50 rounded px-1 py-0.5">
                                        <div className="w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0"
                                            style={{ borderColor: colMap[s.status]?.color || '#42526E' }}>
                                            {s.status === 'done' && <CheckCircle2 size={9} className="text-green-600" />}
                                        </div>
                                        <span className={s.status === 'done' ? 'line-through text-gray-400' : ''}>{s.title}</span>
                                    </div>
                                ))}
                                {subtasks.length === 0 && !addingSub && (
                                    <p className="text-xs text-gray-400 italic">No child issues</p>
                                )}
                            </div>
                        </div>

                        {/* Tags */}
                        {task.tags?.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Labels</p>
                                <div className="flex flex-wrap gap-1">
                                    {task.tags.map((t, i) => (
                                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full"
                                            style={{ background: '#DEEBFF', color: JIRA_BLUE }}>
                                            <Tag size={8} /> {t}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Created by */}
                        {task.createdBy && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Reporter</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                                        style={{ background: avatarColor(task.createdBy) }}>
                                        {initials(task.createdBy)}
                                    </div>
                                    <span className="text-xs text-gray-700">{task.createdBy.username || task.createdBy.name}</span>
                                </div>
                            </div>
                        )}

                        {/* Delete */}
                        <div className="pt-2 border-t" style={{ borderColor: '#DFE1E6' }}>
                            <button onClick={() => onDelete(task._id)}
                                className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors">
                                Delete issue
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4">
                        <ActivityLog taskId={task._id} />
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

function CreateModal({ onClose, onSubmit, members }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('medium');
    const [status, setStatus] = useState('todo');
    const [dueDate, setDueDate] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [saving, setSaving] = useState(false);
    const ref = useRef();
    useEffect(() => ref.current?.focus(), []);

    const submit = async (e) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        const data = { title: title.trim(), description, priority, status };
        if (dueDate) data.dueDate = dueDate;
        if (assigneeId) data.assignedToIds = [assigneeId];
        await onSubmit(data);
        setSaving(false);
    };

    const selectStyle = {
        width: '100%', padding: '6px 10px', fontSize: '12px',
        border: '1px solid var(--border-default)', borderRadius: '2px',
        backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
        outline: 'none', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    };
    const inputStyle = {
        width: '100%', padding: '6px 10px', fontSize: '13px',
        border: '1px solid var(--border-default)', borderRadius: '2px',
        backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)',
        outline: 'none', boxSizing: 'border-box',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        transition: 'border-color 150ms ease',
    };
    return (
        <div onClick={e => e.target === e.currentTarget && onClose()} style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        }}>
            <div style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-accent)',
                borderRadius: '2px', width: '480px', maxHeight: '90vh',
                margin: '0 16px', overflow: 'hidden',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            }}>
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px', flexShrink: 0,
                    borderBottom: '1px solid var(--border-default)',
                    backgroundColor: 'var(--bg-active)',
                }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Create issue</h3>
                    <button onClick={onClose} style={{
                        padding: '4px', borderRadius: '2px', background: 'none', border: 'none',
                        cursor: 'pointer', color: 'var(--text-muted)', transition: 'color 150ms ease',
                    }}
                        onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    ><X size={15} /></button>
                </div>

                <form onSubmit={submit} style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                            Summary <span style={{ color: 'var(--state-danger)' }}>*</span>
                        </label>
                        <input ref={ref} value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Enter a summary for this issue"
                            style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)}
                            rows={3} placeholder="Add a description…"
                            style={{ ...inputStyle, resize: 'none' }}
                            onFocus={e => e.target.style.borderColor = 'var(--border-accent)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border-default)'} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value)} style={selectStyle}>
                                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value)} style={selectStyle}>
                                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Assignee</label>
                            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} style={selectStyle}>
                                <option value="">Unassigned</option>
                                {members.map(m => <option key={m._id || m.id} value={m._id || m.id}>{m.username || m.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>Due date</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-subtle)' }}>
                        <button type="button" onClick={onClose} style={{
                            padding: '7px 16px', fontSize: '13px', color: 'var(--text-secondary)',
                            backgroundColor: 'var(--bg-active)', border: '1px solid var(--border-default)',
                            borderRadius: '2px', cursor: 'pointer',
                        }}>Cancel</button>
                        <button type="submit" disabled={!title.trim() || saving} style={{
                            padding: '7px 16px', fontSize: '13px', fontWeight: 500,
                            color: '#0c0c0c', backgroundColor: 'var(--accent)',
                            border: 'none', borderRadius: '2px',
                            cursor: !title.trim() || saving ? 'not-allowed' : 'pointer',
                            opacity: !title.trim() || saving ? 0.5 : 1,
                            display: 'flex', alignItems: 'center', gap: '6px',
                        }}>
                            {saving && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
                            Create
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main TasksTab ────────────────────────────────────────────────────────────

export default function TasksTab({ channelId, channelName, workspaceId: workspaceIdProp, currentUserId, socket }) {
    const { activeWorkspace } = useWorkspace();
    const workspaceId = workspaceIdProp || activeWorkspace?.id || activeWorkspace?._id;

    const [tasks, setTasks] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState('all');

    // Load tasks + workspace members
    const loadTasks = useCallback(async () => {
        if (!channelId || !workspaceId) { setLoading(false); return; }
        try {
            setLoading(true);
            setFetchError(null);
            const res = await api.get('/api/v2/tasks', { params: { workspaceId } });
            const mine = (res.data.tasks || []).filter(t => {
                const inChannel = t.channel && (t.channel._id === channelId || t.channel === channelId);
                const assignedHere = !t.channel && Array.isArray(t.assignedTo) &&
                    t.assignedTo.some(a => (a._id || a) === currentUserId);
                return inChannel || assignedHere;
            });
            setTasks(mine);
        } catch (err) {
            setTasks([]);
            setFetchError(err?.response?.data?.message || 'Could not load tasks. Check your connection and try again.');
        }
        finally { setLoading(false); }
    }, [channelId, workspaceId]);

    // Load workspace members for assignee picker
    const loadMembers = useCallback(async () => {
        if (!workspaceId) return;
        try {
            // Correct endpoint: /api/workspaces/:id/members (no v2 prefix)
            const res = await api.get(`/api/workspaces/${workspaceId}/members`).catch(() => ({ data: { members: [] } }));
            const list = res.data.members || res.data.users || res.data || [];
            setMembers(Array.isArray(list) ? list.map(m => m.user || m).filter(Boolean) : []);
        } catch { setMembers([]); }
    }, [workspaceId]);

    useEffect(() => { loadTasks(); loadMembers(); }, [loadTasks, loadMembers]);

    // Socket real-time
    useEffect(() => {
        if (!socket || !channelId) return;
        const add = t => {
            if (t.channel && (t.channel._id === channelId || t.channel === channelId))
                setTasks(p => p.find(x => x._id === t._id) ? p : [...p, t]);
        };
        const upd = t => {
            if (t.channel && (t.channel._id === channelId || t.channel === channelId)) {
                setTasks(p => p.map(x => x._id === t._id ? t : x));
                setSelected(s => s?._id === t._id ? t : s);
            }
        };
        const del = ({ taskId }) => { setTasks(p => p.filter(x => x._id !== taskId)); setSelected(s => s?._id === taskId ? null : s); };
        socket.on('task-created', add);
        socket.on('task-updated', upd);
        socket.on('task-deleted', del);
        return () => { socket.off('task-created', add); socket.off('task-updated', upd); socket.off('task-deleted', del); };
    }, [socket, channelId]);

    // Actions
    const handleCreate = useCallback(async (data) => {
        try {
            // Always use 'channel' assignment type when creating from the Tasks tab.
            // This ensures the task is stored with visibility='channel' and a channel ID,
            // so ALL channel members (including the assignee) can see it in their Tasks tab.
            // Individual assignees are tracked via assignedToIds inside the channel task.
            const res = await api.post('/api/v2/tasks', {
                title: data.title,
                description: data.description,
                priority: data.priority,
                status: data.status,
                workspaceId,
                assignmentType: 'channel',
                channelId,
                assignedToIds: data.assignedToIds || [],
                visibility: 'channel',
                ...(data.dueDate ? { dueDate: data.dueDate } : {}),
            });
            if (res.data.tasks?.[0])
                setTasks(p => p.find(x => x._id === res.data.tasks[0]._id) ? p : [...p, res.data.tasks[0]]);
            setShowModal(false);
        } catch (err) { console.error('Create task failed:', err.response?.data || err); }
    }, [channelId, workspaceId]);

    const handleInlineAdd = useCallback(async (title, status) => {
        await handleCreate({ title, priority: 'medium', status });
    }, [handleCreate]);

    const handleUpdate = useCallback(async (taskId, updates) => {
        try {
            const res = await api.put(`/api/v2/tasks/${taskId}`, updates);
            const updated = res.data.task;
            if (updated) {
                setTasks(p => p.map(t => t._id === taskId ? updated : t));
                setSelected(s => s?._id === taskId ? updated : s);
            }
        } catch (err) {
            console.error('Update failed:', err.response?.data || err);
            loadTasks();
        }
    }, [loadTasks]);

    const handleDelete = useCallback(async (taskId) => {
        setTasks(p => p.filter(t => t._id !== taskId));
        setSelected(s => s?._id === taskId ? null : s);
        try { await api.delete(`/api/v2/tasks/${taskId}`); }
        catch { loadTasks(); }
    }, [loadTasks]);

    // Filtered tasks
    const filtered = useMemo(() => {
        if (filter === 'mine') return tasks.filter(t => {
            const assignees = Array.isArray(t.assignedTo) ? t.assignedTo : (t.assignedTo ? [t.assignedTo] : []);
            return assignees.some(a => (a._id || a) === currentUserId) || (t.createdBy?._id || t.createdBy) === currentUserId;
        });
        if (filter === 'high') return tasks.filter(t => t.priority === 'high' || t.priority === 'highest');
        return tasks;
    }, [tasks, filter, currentUserId]);

    const byStatus = s => filtered.filter(t => (t.status || 'todo') === s && t.status !== 'blocked');
    const allInCol = s => filtered.filter(t => (t.status || 'todo') === s);
    const blockedCountInCol = s => filtered.filter(t => t.status === 'blocked' && t.previousStatus === s).length;

    // Mix blocked tasks into their previous column for display
    const colTasks = s => {
        const base = filtered.filter(t => (t.status || 'todo') === s);
        const blockedHere = filtered.filter(t => t.status === 'blocked' && (t.previousStatus === s || (!t.previousStatus && s === 'in_progress')));
        return [...base, ...blockedHere];
    };

    const totalBlocked = filtered.filter(t => t.status === 'blocked').length;
    const doneCount = tasks.filter(t => t.status === 'done').length;

    // Loading skeleton
    if (loading) {
        return (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>
                <div style={{ padding: '10px 20px', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-default)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.6 }}>
                    <div style={{ height: 14, width: 180, backgroundColor: 'var(--bg-active)', borderRadius: '2px' }} />
                    <div style={{ height: 28, width: 72, backgroundColor: 'var(--bg-active)', borderRadius: '2px' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', gap: '8px', padding: '12px', minHeight: 0 }}>
                    {COLUMNS.map(c => (
                        <div key={c.key} style={{ flex: 1, borderRadius: '2px', backgroundColor: 'var(--bg-surface)', borderTop: `2px solid ${c.topColor}` }}>
                            <div style={{ padding: '10px' }}>
                                <div style={{ height: 10, width: 72, backgroundColor: 'var(--bg-hover)', borderRadius: '2px', marginBottom: '10px' }} />
                                {[1, 2].map(i => (
                                    <div key={i} style={{ backgroundColor: 'var(--bg-active)', borderRadius: '2px', marginBottom: '6px', padding: '10px' }}>
                                        <div style={{ height: 10, width: '80%', backgroundColor: 'var(--bg-hover)', borderRadius: '2px', marginBottom: '6px' }} />
                                        <div style={{ height: 8, width: '50%', backgroundColor: 'var(--bg-hover)', borderRadius: '2px' }} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', backgroundColor: 'var(--bg-base)' }}>

            <div style={{
                flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-default)',
            }}>
                <BookOpen size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    #{(channelName || '').replace(/^#/, '')}
                </span>

                <div style={{ width: 1, height: 14, backgroundColor: 'var(--border-default)', margin: '0 4px' }} />

                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>
                    {tasks.length} issue{tasks.length !== 1 ? 's' : ''}
                    {doneCount > 0 && <> · <span style={{ color: 'var(--state-success)', fontWeight: 500 }}>{doneCount} done</span></>}
                    {totalBlocked > 0 && <> · <span style={{ color: 'var(--state-danger)', fontWeight: 500 }}>{totalBlocked} blocked</span></>}
                </span>

                <div style={{ width: 1, height: 14, backgroundColor: 'var(--border-default)', margin: '0 4px' }} />

                {[
                    { key: 'all', label: 'All Issues' },
                    { key: 'mine', label: 'My Issues' },
                    { key: 'high', label: 'High Priority' },
                ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)} style={{
                        fontSize: '12px', padding: '3px 10px', borderRadius: '2px',
                        backgroundColor: filter === f.key ? 'rgba(184,149,106,0.12)' : 'transparent',
                        color: filter === f.key ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: filter === f.key ? 600 : 400,
                        border: 'none', cursor: 'pointer', transition: 'background-color 150ms ease',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                    }}>{f.label}</button>
                ))}

                <div style={{ flex: 1 }} />

                <button onClick={() => setShowModal(true)} style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 12px', fontSize: '12px', fontWeight: 500,
                    color: '#0c0c0c', backgroundColor: 'var(--accent)',
                    border: 'none', borderRadius: '2px', cursor: 'pointer',
                    transition: 'background-color 150ms ease', fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--accent-hover)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--accent)'}
                ><Plus size={13} strokeWidth={2.5} /> Create</button>
            </div>

            {/* ── Error Banner ── */}
            {fetchError && (
                <div className="flex items-center justify-between gap-3 mx-4 mt-3 px-4 py-3 rounded-sm bg-red-50 border border-red-200 text-sm">
                    <div className="flex items-center gap-2 text-red-700">
                        <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
                        <span>{fetchError}</span>
                    </div>
                    <button
                        onClick={loadTasks}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-white border border-red-200 rounded-sm hover:bg-red-50 transition-colors flex-shrink-0"
                    >
                        <RotateCcw size={12} /> Retry
                    </button>
                </div>
            )}

            {/* ── 5-Column Board + optional detail panel ── */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
                {/* Board */}
                <div className="flex-1 min-h-0 flex gap-2.5 p-3 overflow-x-auto overflow-y-hidden">
                    {COLUMNS.map(col => (
                        <KanbanColumn
                            key={col.key}
                            col={col}
                            tasks={colTasks(col.key)}
                            blockedInCol={colTasks(col.key).filter(t => t.status === 'blocked').length}
                            onCardClick={setSelected}
                            onDelete={handleDelete}
                            onInlineAdd={handleInlineAdd}
                        />
                    ))}
                </div>

                {/* Detail panel */}
                {selected && (
                    <TaskDetailPanel
                        key={selected._id}
                        task={selected}
                        members={members}
                        onClose={() => setSelected(null)}
                        onUpdate={handleUpdate}
                        onDelete={handleDelete}
                    />
                )}
            </div>

            {showModal && (
                <CreateModal
                    onClose={() => setShowModal(false)}
                    onSubmit={handleCreate}
                    members={members}
                />
            )}
        </div>
    );
}
