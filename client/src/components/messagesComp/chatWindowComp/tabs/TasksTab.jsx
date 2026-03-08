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
import api from '../../../../services/api';
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
    { key: 'backlog', label: 'BACKLOG', color: '#8993A4', headerBg: '#F4F5F7', topColor: '#8993A4' },
    { key: 'todo', label: 'TO DO', color: '#42526E', headerBg: '#F4F5F7', topColor: '#42526E' },
    { key: 'in_progress', label: 'IN PROGRESS', color: '#0052CC', headerBg: '#DEEBFF', topColor: '#0052CC' },
    { key: 'review', label: 'IN REVIEW', color: '#6554C0', headerBg: '#EAE6FF', topColor: '#6554C0' },
    { key: 'done', label: 'DONE', color: '#00875A', headerBg: '#E3FCEF', topColor: '#00875A' },
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

const JIRA_BLUE = '#0052CC';

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
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
            style={{ background: m.headerBg, color: m.color }}>
            {m.label}
        </span>
    );
}

// ─── Issue Type Icon (Jira-discipline) ────────────────────────────────────────

const ISSUE_TYPE_META = {
    epic: { label: 'Epic', color: '#6554C0', bg: '#EAE6FF', Icon: Zap },
    bug: { label: 'Bug', color: '#FF5630', bg: '#FFEBE6', Icon: AlertTriangle },
    subtask: { label: 'Subtask', color: '#00B8D9', bg: '#E6FCFF', Icon: CheckCircle2 },
    task: { label: 'Task', color: '#0052CC', bg: '#DEEBFF', Icon: CheckCircle2 },
};

function IssueTypeIcon({ type = 'task', size = 12 }) {
    const meta = ISSUE_TYPE_META[type] || ISSUE_TYPE_META.task;
    const { Icon, color, bg } = meta;
    return (
        <span title={meta.label}
            className="inline-flex items-center justify-center rounded-sm flex-shrink-0"
            style={{ width: 16, height: 16, background: bg }}>
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
        <div className="rounded border-2 bg-white mb-2 overflow-hidden" style={{ borderColor: JIRA_BLUE }}>
            <input
                ref={ref}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
                onBlur={() => { if (!title.trim()) onCancel(); }}
                placeholder="What needs to be done?"
                className="w-full px-3 py-2 text-sm text-gray-800 focus:outline-none"
            />
            {title.trim() && (
                <div className="flex gap-1.5 px-2 pb-2">
                    <button onMouseDown={submit}
                        className="px-3 py-1 text-xs font-semibold text-white rounded-sm transition-opacity hover:opacity-90"
                        style={{ background: JIRA_BLUE }}>
                        Create
                    </button>
                    <button onMouseDown={onCancel}
                        className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-sm">
                        Cancel
                    </button>
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

    return (
        <div
            onClick={() => onClick(task)}
            className="group bg-white rounded-sm cursor-pointer mb-2 relative"
            style={{
                boxShadow: '0 1px 2px rgba(9,30,66,0.25)',
                border: blocked ? '1px solid #FF5630' : '1px solid transparent',
                borderLeft: `3px solid ${pMeta(task.priority || 'medium').color}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 1px 2px rgba(9,30,66,0.25), 0 0 0 1px rgba(0,82,204,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = blocked ? '' : '0 1px 2px rgba(9,30,66,0.25)'; }}
        >
            {/* Blocked banner */}
            {blocked && (
                <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[10px] font-semibold text-red-600">
                    <AlertTriangle size={10} strokeWidth={2.5} />
                    BLOCKED{task.blockedReason ? `: ${task.blockedReason.slice(0, 40)}` : ''}
                </div>
            )}

            <div className="px-3 pt-2 pb-2.5">
                {/* Issue type + key row */}
                <div className="flex items-center gap-1.5 mb-1.5">
                    <IssueTypeIcon type={task.type || task.issueType || 'task'} size={10} />
                    {(task.issueKey) && (
                        <span className="text-[10px] font-mono font-semibold" style={{ color: '#7A869A' }}>
                            {task.issueKey}
                        </span>
                    )}
                </div>

                {/* Summary */}
                <p className={`text-sm leading-snug mb-2 ${done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                    {task.title}
                </p>

                {/* Labels */}
                {task.labels?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                        {task.labels.slice(0, 3).map(l => (
                            <span key={l} className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium"
                                style={{ background: '#F4F5F7', color: '#42526E' }}>
                                {l}
                            </span>
                        ))}
                    </div>
                )}

                {/* Bottom chips row */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Priority */}
                    <PriorityIcon priority={task.priority || 'medium'} size={13} />

                    {/* Due date */}
                    {task.dueDate && (
                        <span className={`flex items-center gap-0.5 text-[10px] font-medium ${overdue ? 'text-red-600' : 'text-gray-400'}`}>
                            <Calendar size={9} />
                            {fmtDate(task.dueDate)}
                        </span>
                    )}

                    {/* Subtask count */}
                    {subtaskCount > 0 && (
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                            <ListTodo size={9} /> {subtaskCount}
                        </span>
                    )}

                    <div className="flex-1" />

                    {/* Delete */}
                    <button onClick={e => { e.stopPropagation(); onDelete(task._id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-500 text-gray-300 transition-all">
                        <X size={11} />
                    </button>

                    {/* Assignee */}
                    {assignee && (
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                            style={{ background: avatarColor(assignee) }}
                            title={assignee.username || assignee.name}>
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
        <div className="flex-1 flex flex-col min-w-0 min-h-0"
            style={{ background: '#F4F5F7', minWidth: 180 }}>
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5 flex-shrink-0"
                style={{ borderTop: `3px solid ${col.topColor}` }}>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: col.color }}>
                    {col.label}
                </span>
                <span className="text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center"
                    style={{ background: '#DFE1E6', color: '#42526E' }}>
                    {tasks.length}
                </span>
                {blockedInCol > 0 && (
                    <span className="flex items-center gap-0.5 text-[9px] font-bold text-red-500 ml-0.5">
                        <AlertTriangle size={9} /> {blockedInCol}
                    </span>
                )}
                <div className="flex-1" />
                {!isTerminal && (
                    <button onClick={() => setAdding(v => !v)}
                        className="p-0.5 rounded hover:bg-gray-300 text-gray-500 transition-colors"
                        title="Quick add">
                        <Plus size={14} />
                    </button>
                )}
            </div>

            {/* Cards */}
            <div className="flex-1 min-h-0 overflow-y-auto px-2 pt-1 pb-2"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#C1C7D0 transparent' }}>
                {adding && (
                    <InlineAdd
                        defaultStatus={col.key}
                        onSubmit={(title, status) => { onInlineAdd(title, status); setAdding(false); }}
                        onCancel={() => setAdding(false)}
                    />
                )}

                {tasks.length === 0 && !adding ? (
                    <div className="flex items-center justify-center h-16 opacity-40">
                        <p className="text-xs text-gray-400">No issues</p>
                    </div>
                ) : (
                    tasks.map(t => (
                        <TaskCard key={t._id} task={t} onClick={onCardClick} onDelete={onDelete} />
                    ))
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
        <div className="w-80 flex-shrink-0 flex flex-col h-full bg-white border-l overflow-hidden"
            style={{ borderColor: '#DFE1E6' }}>
            {/* Panel header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid #DFE1E6', background: '#F4F5F7' }}>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-sm flex items-center justify-center"
                        style={{ background: col.color }}>
                        <div className="w-2 h-2 rounded-full bg-white opacity-90" />
                    </div>
                    <StatusBadge status={task.status} />
                </div>
                <div className="flex items-center gap-1">
                    {saving && <Loader2 size={13} className="animate-spin text-gray-400" />}
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors">
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: '#DFE1E6' }}>
                {[
                    { key: 'details', label: 'Details', icon: <Eye size={12} /> },
                    { key: 'activity', label: 'Activity', icon: <Activity size={12} /> },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all"
                        style={{
                            color: tab === t.key ? JIRA_BLUE : '#42526E',
                            borderBottom: tab === t.key ? `2px solid ${JIRA_BLUE}` : '2px solid transparent',
                        }}>
                        {t.icon} {t.label}
                    </button>
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white rounded-sm shadow-2xl w-[520px] max-h-[90vh] mx-4 overflow-hidden flex flex-col"
                style={{ boxShadow: '0 8px 32px rgba(9,30,66,0.35)', border: '1px solid #DFE1E6' }}>

                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                    style={{ borderBottom: '1px solid #DFE1E6', background: '#F4F5F7' }}>
                    <h3 className="font-semibold text-gray-900 text-sm">Create issue</h3>
                    <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-200 text-gray-500">
                        <X size={15} />
                    </button>
                </div>

                <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                    {/* Summary */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                            Summary <span className="text-red-500">*</span>
                        </label>
                        <input ref={ref} value={title} onChange={e => setTitle(e.target.value)}
                            placeholder="Enter a summary for this issue"
                            className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none text-gray-900"
                            style={{ borderColor: '#DFE1E6' }}
                            onFocus={e => e.target.style.borderColor = JIRA_BLUE}
                            onBlur={e => e.target.style.borderColor = '#DFE1E6'} />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5">Description</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)}
                            rows={3} placeholder="Add a description…"
                            className="w-full px-3 py-2 text-sm border rounded-sm focus:outline-none resize-none text-gray-700"
                            style={{ borderColor: '#DFE1E6' }}
                            onFocus={e => e.target.style.borderColor = JIRA_BLUE}
                            onBlur={e => e.target.style.borderColor = '#DFE1E6'} />
                    </div>

                    {/* Status + Priority row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Status</label>
                            <select value={status} onChange={e => setStatus(e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-sm focus:outline-none text-gray-800 bg-white"
                                style={{ borderColor: '#DFE1E6' }}>
                                {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Priority</label>
                            <select value={priority} onChange={e => setPriority(e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-sm focus:outline-none text-gray-800 bg-white"
                                style={{ borderColor: '#DFE1E6' }}>
                                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Assignee + Due date row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Assignee</label>
                            <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-sm focus:outline-none text-gray-800 bg-white"
                                style={{ borderColor: '#DFE1E6' }}>
                                <option value="">Unassigned</option>
                                {members.map(m => (
                                    <option key={m._id || m.id} value={m._id || m.id}>
                                        {m.username || m.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Due date</label>
                            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                                className="w-full px-3 py-2 text-xs border rounded-sm focus:outline-none text-gray-800"
                                style={{ borderColor: '#DFE1E6' }} />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2" style={{ borderTop: '1px solid #DFE1E6' }}>
                        <button type="button" onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-sm transition-colors">
                            Cancel
                        </button>
                        <button type="submit" disabled={!title.trim() || saving}
                            className="px-4 py-2 text-sm font-semibold text-white rounded-sm transition-all disabled:opacity-50 flex items-center gap-2"
                            style={{ background: JIRA_BLUE }}>
                            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
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
    const [showModal, setShowModal] = useState(false);
    const [selected, setSelected] = useState(null);
    const [filter, setFilter] = useState('all');

    // Load tasks + workspace members
    const loadTasks = useCallback(async () => {
        if (!channelId || !workspaceId) { setLoading(false); return; }
        try {
            setLoading(true);
            const res = await api.get('/api/v2/tasks', { params: { workspaceId } });
            const mine = (res.data.tasks || []).filter(t =>
                t.channel && (t.channel._id === channelId || t.channel === channelId)
            );
            setTasks(mine);
        } catch { setTasks([]); }
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
            const assignmentType = data.assignedToIds?.length ? 'individual' : 'channel';
            const res = await api.post('/api/v2/tasks', {
                title: data.title,
                description: data.description,
                priority: data.priority,
                status: data.status,
                workspaceId,
                assignmentType,
                channelId: assignmentType === 'channel' ? channelId : undefined,
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
            <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#F4F5F7' }}>
                <div className="px-5 py-3 bg-white border-b flex items-center justify-between animate-pulse" style={{ borderColor: '#DFE1E6' }}>
                    <div className="h-4 w-48 bg-gray-200 rounded" />
                    <div className="h-8 w-20 bg-blue-100 rounded-sm" />
                </div>
                <div className="flex-1 flex gap-3 p-4 min-h-0">
                    {COLUMNS.map(c => (
                        <div key={c.key} className="flex-1 rounded-sm" style={{ background: '#F4F5F7', borderTop: `3px solid ${c.topColor}` }}>
                            <div className="p-3 animate-pulse">
                                <div className="h-3 w-20 bg-gray-300 rounded mb-3" />
                                {[1, 2].map(i => (
                                    <div key={i} className="bg-white rounded-sm mb-2 p-3 shadow-sm">
                                        <div className="h-3 w-4/5 bg-gray-200 rounded mb-2" />
                                        <div className="h-2 w-1/2 bg-gray-100 rounded" />
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
        <div className="flex flex-col h-full overflow-hidden" style={{ background: '#F4F5F7' }}>

            {/* ── Jira-style toolbar ── */}
            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 bg-white border-b"
                style={{ borderColor: '#DFE1E6' }}>
                <BookOpen size={15} style={{ color: '#42526E' }} />
                <span className="text-sm font-semibold" style={{ color: '#172B4D' }}>
                    #{(channelName || '').replace(/^#/, '')}
                </span>

                <div className="w-px h-4 bg-gray-200 mx-1" />

                {/* Stats */}
                <span className="text-xs" style={{ color: '#7A869A' }}>
                    {tasks.length} issue{tasks.length !== 1 ? 's' : ''}
                    {doneCount > 0 && <> · <span className="text-green-600 font-medium">{doneCount} done</span></>}
                    {totalBlocked > 0 && <> · <span className="text-red-500 font-medium">{totalBlocked} blocked</span></>}
                </span>

                <div className="w-px h-4 bg-gray-200 mx-1" />

                {/* Filters */}
                {[
                    { key: 'all', label: 'All Issues' },
                    { key: 'mine', label: 'My Issues' },
                    { key: 'high', label: 'High Priority' },
                ].map(f => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                        className="text-xs font-medium px-2.5 py-1 rounded transition-all"
                        style={{
                            background: filter === f.key ? '#DEEBFF' : 'transparent',
                            color: filter === f.key ? JIRA_BLUE : '#42526E',
                            fontWeight: filter === f.key ? 700 : 500,
                        }}>
                        {f.label}
                    </button>
                ))}

                <div className="flex-1" />

                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-sm transition-opacity hover:opacity-90"
                    style={{ background: JIRA_BLUE }}>
                    <Plus size={13} strokeWidth={2.5} /> Create
                </button>
            </div>

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
