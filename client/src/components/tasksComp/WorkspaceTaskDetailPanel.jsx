/**
 * WorkspaceTaskDetailPanel.jsx
 *
 * Jira-style right-side detail panel for the /tasks workspace page.
 * Adapted from TasksTab.jsx TaskDetailPanel to match the workspace task schema:
 *   - task.id  (not task._id)
 *   - task.status  e.g. "To Do", "In Progress", "In Review", "Completed", "Blocked"
 *   - task.priority e.g. "High", "Medium", "Low", "Emergency"
 *   - task.assignees[]  (populated objects)
 *   - task.assigner / task.assignerId
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Eye, Activity, Plus, ChevronRight,
    CheckCircle2, Tag, Loader2, AlertTriangle,
    ArrowRight, User, Edit2, Calendar, Trash2,
    Timer, Link2, PlayCircle, StopCircle
} from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const JIRA_BLUE = '#0052CC';

// Workspace task statuses (Sentence-case strings used in the DB)
const WS_STATUSES = [
    { key: 'To Do', label: 'TO DO', color: '#42526E', bg: '#DFE1E6' },
    { key: 'In Progress', label: 'IN PROGRESS', color: '#0052CC', bg: '#DEEBFF' },
    { key: 'In Review', label: 'IN REVIEW', color: '#6554C0', bg: '#EAE6FF' },
    { key: 'Completed', label: 'COMPLETED', color: '#00875A', bg: '#E3FCEF' },
    { key: 'Blocked', label: 'BLOCKED', color: '#FF5630', bg: '#FFEBE6' },
];

const STATUS_MAP = Object.fromEntries(WS_STATUSES.map(s => [s.key, s]));

// Workspace task priorities
const WS_PRIORITIES = [
    { key: 'Emergency', label: 'Emergency', color: '#CD1317', arrow: '↑↑' },
    { key: 'High', label: 'High', color: '#E97F33', arrow: '↑' },
    { key: 'Medium', label: 'Medium', color: '#E2B203', arrow: '—' },
    { key: 'Low', label: 'Low', color: '#3E7FC1', arrow: '↓' },
    { key: 'Lowest', label: 'Lowest', color: '#7A869A', arrow: '↓↓' },
];

const PRIO_MAP = Object.fromEntries(WS_PRIORITIES.map(p => [p.key, p]));

// Which statuses can be transitioned to from each status
const TRANSITIONS = {
    'To Do': ['In Progress', 'Blocked'],
    'In Progress': ['In Review', 'Blocked', 'To Do'],
    'In Review': ['Completed', 'In Progress', 'Blocked'],
    'Completed': [],
    'Blocked': ['In Progress', 'To Do'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avatarColor(name = '') {
    const colors = ['#0052CC', '#00875A', '#FF5630', '#6554C0', '#FF8B00', '#00B8D9', '#36B37E'];
    let h = 0;
    for (let i = 0; i < (name.length || 0); i++) h = (h * 31 + name.charCodeAt(i)) % colors.length;
    return colors[h];
}

function initials(u) {
    if (!u) return '?';
    const name = u.username || u.name || u.email || '';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

function fmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtSeconds(s) {
    if (!s) return '0m';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

// ─── Activity log ─────────────────────────────────────────────────────────────

function ActivityLog({ taskId }) {
    const [log, setLog] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!taskId) return;
        setLoading(true);
        // Try v2 endpoint first, fallback gracefully
        api.get(`/api/v2/tasks/${taskId}/activity`)
            .then(r => setLog(r.data.activities || r.data.activity || []))
            .catch(() => setLog([]))
            .finally(() => setLoading(false));
    }, [taskId]);

    const ACTION_ICONS = {
        created: <Plus size={11} className="text-green-600" />,
        status_changed: <ArrowRight size={11} className="text-blue-600" />,
        updated: <Activity size={11} className="text-orange-500" />,
        assignee_added: <User size={11} className="text-indigo-600" />,
        assignee_removed: <User size={11} className="text-red-500" />,
    };

    if (loading) return (
        <div className="flex items-center gap-2 justify-center py-8 text-gray-400 text-xs animate-pulse">
            <Loader2 size={13} className="animate-spin" /> Loading activity…
        </div>
    );

    if (!log.length) return (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <Activity size={14} className="text-gray-300" />
            </div>
            <p className="text-xs text-gray-400">No activity recorded yet.</p>
        </div>
    );

    return (
        <div className="space-y-3 text-xs">
            {[...log].reverse().map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                        {ACTION_ICONS[a.action] || <Activity size={11} className="text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-gray-700">
                            <span className="font-semibold">{a.user?.username || 'Someone'}</span>
                            {' '}
                            <span className="text-gray-500">
                                {a.action === 'created' && 'created this task'}
                                {a.action === 'status_changed' && `moved from ${a.from} → ${a.to}`}
                                {a.action === 'updated' && `updated ${a.field}`}
                                {a.action === 'assignee_added' && 'added an assignee'}
                                {a.action === 'assignee_removed' && 'removed an assignee'}
                                {!['created', 'status_changed', 'updated', 'assignee_added', 'assignee_removed'].includes(a.action) && a.action}
                            </span>
                        </p>
                        <p className="text-gray-400 text-[10px] mt-0.5">
                            {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main Panel ────────────────────────────────────────────────────────────────

export default function WorkspaceTaskDetailPanel({ task, members = [], onClose, onUpdate, onDelete }) {
    const { showToast } = useToast();
    const [tab, setTab] = useState('details');
    const [editTitle, setEditTitle] = useState(false);
    const [title, setTitle] = useState(task.title || '');
    const [desc, setDesc] = useState(task.description || '');
    const [editDesc, setEditDesc] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showBlockedInput, setShowBlockedInput] = useState(false);
    const [blockedReason, setBlockedReason] = useState('');
    const [localDueDate, setLocalDueDate] = useState(
        task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
    );

    // ── Time Tracking state ──────────────────────────────────────────────────
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerElapsed, setTimerElapsed] = useState(0); // seconds since start
    const [timerLoading, setTimerLoading] = useState(false);
    const timerRef = useRef(null);
    const [totalTime, setTotalTime] = useState(task.timeTracking?.totalTime || 0);

    // Check if a session is already open on mount
    useEffect(() => {
        const hasOpenSession = task.timeTracking?.sessions?.some(s => s.start && !s.end);
        if (hasOpenSession) {
            setTimerRunning(true);
            const openSession = task.timeTracking.sessions.slice().reverse().find(s => s.start && !s.end);
            if (openSession) {
                const elapsed = Math.floor((Date.now() - new Date(openSession.start).getTime()) / 1000);
                setTimerElapsed(elapsed);
            }
        }
        setTotalTime(task.timeTracking?.totalTime || 0);
    }, [task.timeTracking]);

    // Live tick when timer is running
    useEffect(() => {
        if (timerRunning) {
            timerRef.current = setInterval(() => setTimerElapsed(e => e + 1), 1000);
        } else {
            clearInterval(timerRef.current);
        }
        return () => clearInterval(timerRef.current);
    }, [timerRunning]);

    const startTimer = async () => {
        setTimerLoading(true);
        try {
            await api.post(`/api/v2/tasks/${task.id}/time/start`);
            setTimerRunning(true);
            setTimerElapsed(0);
            showToast('Timer started', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to start timer', 'error');
        } finally { setTimerLoading(false); }
    };

    const stopTimer = async () => {
        setTimerLoading(true);
        try {
            const res = await api.post(`/api/v2/tasks/${task.id}/time/stop`);
            setTimerRunning(false);
            setTimerElapsed(0);
            setTotalTime(res.data.timeTracking?.totalTime || 0);
            showToast(`Timer stopped — +${fmtSeconds(res.data.elapsed)}`, 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to stop timer', 'error');
        } finally { setTimerLoading(false); }
    };

    // ── Dependencies state ───────────────────────────────────────────────────
    const [depInput, setDepInput] = useState('');
    const [depLoading, setDepLoading] = useState(false);
    const [localDeps, setLocalDeps] = useState(task.dependencies || []);

    const addDependency = async () => {
        if (!depInput.trim()) return;
        setDepLoading(true);
        try {
            const res = await api.post(`/api/v2/tasks/${task.id}/dependency`, {
                dependencyTaskId: depInput.trim()
            });
            setLocalDeps(res.data.dependencies || []);
            setDepInput('');
            showToast('Dependency added', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to add dependency', 'error');
        } finally { setDepLoading(false); }
    };


    // Sync when task prop changes (e.g. after a remote update)
    useEffect(() => {
        setTitle(task.title || '');
        setDesc(task.description || '');
        setLocalDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    }, [task]);

    const save = useCallback(async (updates) => {
        setSaving(true);
        try {
            await onUpdate(task.id, updates);
        } finally {
            setSaving(false);
        }
    }, [task.id, onUpdate]);

    const handleStatusClick = (newStatus) => {
        if (newStatus === 'Blocked') {
            setShowBlockedInput(true);
        } else {
            save({ status: newStatus });
        }
    };

    const confirmBlocked = () => {
        if (!blockedReason.trim()) return;
        save({ status: 'Blocked', blockedReason: blockedReason.trim() });
        setShowBlockedInput(false);
        setBlockedReason('');
    };

    const statusConf = STATUS_MAP[task.status] || STATUS_MAP['To Do'];
    const allowedNext = TRANSITIONS[task.status] || [];
    const assignees = task.assignees || (task.assignee && task.assignee !== 'Self' ? [{ username: task.assignee }] : []);
    const reporter = task.assigner ? { username: task.assigner } : task.createdBy;
    const pConf = PRIO_MAP[task.priority] || PRIO_MAP.Medium;

    return (
        <div
            className="flex-shrink-0 flex flex-col bg-white overflow-hidden"
            style={{
                width: 320,
                borderLeft: '1px solid #DFE1E6',
                height: '100%',
            }}
        >
            {/* ── Header ── */}
            <div
                className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid #DFE1E6', background: '#F4F5F7' }}
            >
                <div className="flex items-center gap-2">
                    <div
                        className="w-4 h-4 rounded-sm flex items-center justify-center"
                        style={{ background: statusConf.color }}
                    >
                        <div className="w-2 h-2 rounded-full bg-white opacity-90" />
                    </div>
                    <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm"
                        style={{ background: statusConf.bg, color: statusConf.color }}
                    >
                        {statusConf.label}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {saving && <Loader2 size={12} className="animate-spin text-gray-400" />}
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex border-b flex-shrink-0" style={{ borderColor: '#DFE1E6' }}>
                {[
                    { key: 'details', label: 'Details', icon: <Eye size={12} /> },
                    { key: 'activity', label: 'Activity', icon: <Activity size={12} /> },
                ].map(t => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-all"
                        style={{
                            color: tab === t.key ? JIRA_BLUE : '#42526E',
                            borderBottom: tab === t.key ? `2px solid ${JIRA_BLUE}` : '2px solid transparent',
                        }}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {tab === 'details' ? (
                    <div className="p-4 space-y-5">

                        {/* Issue key + type */}
                        {task.issueKey && (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-sm flex items-center justify-center" style={{ background: '#DEEBFF' }}>
                                    <CheckCircle2 size={10} style={{ color: JIRA_BLUE }} />
                                </div>
                                <span className="text-[10px] font-mono font-bold" style={{ color: '#7A869A' }}>{task.issueKey}</span>
                            </div>
                        )}

                        {/* Title — click to edit */}
                        <div>
                            {editTitle ? (
                                <input
                                    autoFocus
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    onBlur={() => { save({ title: title.trim() || task.title }); setEditTitle(false); }}
                                    onKeyDown={e => { if (e.key === 'Enter') { save({ title: title.trim() }); setEditTitle(false); } }}
                                    className="w-full font-semibold text-sm text-gray-900 border-b-2 focus:outline-none pb-1"
                                    style={{ borderColor: JIRA_BLUE }}
                                />
                            ) : (
                                <p
                                    onClick={() => setEditTitle(true)}
                                    className="font-semibold text-sm text-gray-900 cursor-pointer hover:bg-blue-50 rounded -mx-1 px-1 py-0.5 leading-snug group flex items-start gap-1"
                                >
                                    <span className="flex-1">{task.title}</span>
                                    <Edit2 size={10} className="mt-1 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Description</p>
                            {editDesc ? (
                                <textarea
                                    autoFocus
                                    value={desc}
                                    onChange={e => setDesc(e.target.value)}
                                    rows={3}
                                    onBlur={() => { save({ description: desc }); setEditDesc(false); }}
                                    className="w-full text-xs text-gray-700 border rounded p-2 focus:outline-none resize-none"
                                    style={{ borderColor: '#DFE1E6' }}
                                />
                            ) : (
                                <p
                                    onClick={() => setEditDesc(true)}
                                    className="text-xs text-gray-600 cursor-pointer hover:bg-blue-50 rounded -mx-1 px-1 py-0.5 min-h-[28px] leading-relaxed"
                                >
                                    {task.description || <span className="text-gray-400 italic">Click to add description…</span>}
                                </p>
                            )}
                        </div>

                        {/* Status transitions */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Status</p>
                            {allowedNext.length === 0 ? (
                                <span className="text-xs text-gray-400 italic">Terminal status — no transitions.</span>
                            ) : (
                                <div className="flex flex-wrap gap-1.5">
                                    {allowedNext.map(ns => {
                                        const nm = STATUS_MAP[ns] || {};
                                        return (
                                            <button
                                                key={ns}
                                                onClick={() => handleStatusClick(ns)}
                                                className="flex items-center gap-1 px-2.5 py-1 rounded-sm text-[11px] font-bold uppercase tracking-wide transition-all hover:opacity-80"
                                                style={{
                                                    background: nm.bg || '#F4F5F7',
                                                    color: nm.color || '#42526E',
                                                    border: `1px solid ${(nm.color || '#42526E')}30`,
                                                }}
                                            >
                                                <ChevronRight size={10} />
                                                {nm.label || ns}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Blocked reason input */}
                            {showBlockedInput && (
                                <div className="mt-2 p-2.5 bg-red-50 rounded border border-red-200">
                                    <p className="text-[10px] font-semibold text-red-600 mb-1.5">Reason for blocking *</p>
                                    <input
                                        autoFocus
                                        value={blockedReason}
                                        onChange={e => setBlockedReason(e.target.value)}
                                        placeholder="What is blocking this task?"
                                        className="w-full text-xs border border-red-200 rounded p-1.5 focus:outline-none bg-white"
                                        onKeyDown={e => e.key === 'Enter' && confirmBlocked()}
                                    />
                                    <div className="flex gap-1.5 mt-1.5">
                                        <button
                                            onClick={confirmBlocked}
                                            className="px-2 py-1 text-[10px] font-semibold text-white rounded-sm bg-red-600"
                                        >Confirm</button>
                                        <button
                                            onClick={() => setShowBlockedInput(false)}
                                            className="px-2 py-1 text-[10px] text-red-600 hover:bg-red-100 rounded-sm"
                                        >Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Priority */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Priority</p>
                            <div className="flex flex-wrap gap-1">
                                {WS_PRIORITIES.map(p => (
                                    <button
                                        key={p.key}
                                        onClick={() => save({ priority: p.key })}
                                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all"
                                        style={{
                                            background: task.priority === p.key ? `${p.color}18` : '#F4F5F7',
                                            color: p.color,
                                            border: task.priority === p.key ? `1px solid ${p.color}` : '1px solid transparent',
                                        }}
                                    >
                                        <span className="font-bold text-[9px]">{p.arrow}</span>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Assignees */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Assignee</p>
                            {assignees.length > 0 ? (
                                <div className="space-y-2">
                                    {assignees.map((a, i) => {
                                        const name = a.username || a.name || a.email || '?';
                                        return (
                                            <div key={i} className="flex items-center gap-2">
                                                <div
                                                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                                                    style={{ background: avatarColor(name) }}
                                                >
                                                    {initials(a)}
                                                </div>
                                                <span className="text-xs font-medium text-gray-700 flex-1 truncate">{name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                members.length > 0 ? (
                                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                                        {members.slice(0, 8).map(m => {
                                            const name = m.username || m.name || m.email || '?';
                                            return (
                                                <button
                                                    key={m._id || m.id}
                                                    onClick={() => save({ assignedToIds: [m._id || m.id] })}
                                                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-blue-50 transition-colors w-full text-left"
                                                >
                                                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                                                        style={{ background: avatarColor(name) }}>
                                                        {initials(m)}
                                                    </div>
                                                    <span className="text-xs text-gray-700 truncate">{name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <span className="text-xs text-gray-400 italic">Unassigned</span>
                                )
                            )}
                        </div>

                        {/* Due date */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Due Date</p>
                            <input
                                type="date"
                                value={localDueDate}
                                onChange={e => {
                                    setLocalDueDate(e.target.value);
                                    save({ dueDate: e.target.value || null });
                                }}
                                className="w-full text-xs border rounded px-2 py-1.5 focus:outline-none text-gray-700"
                                style={{ borderColor: '#DFE1E6' }}
                            />
                            {task.dueDate && (
                                <p className="text-[10.5px] mt-1 text-gray-400">{fmtDate(task.dueDate)}</p>
                            )}
                        </div>

                        {/* Subtasks / Child issues */}
                        {(task.subtasks?.length > 0 || task.childIssues?.length > 0) && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                    Child Issues ({(task.subtasks || task.childIssues || []).length})
                                </p>
                                <div className="space-y-1">
                                    {(task.subtasks || task.childIssues || []).map((s, i) => (
                                        <div
                                            key={s._id || i}
                                            className="flex items-center gap-2 text-xs text-gray-700 hover:bg-gray-50 rounded px-1 py-0.5"
                                        >
                                            <div
                                                className="w-3 h-3 rounded-sm border flex items-center justify-center flex-shrink-0"
                                                style={{ borderColor: status === 'Completed' ? '#00875A' : '#42526E' }}
                                            >
                                                {(s.status === 'done' || s.status === 'Completed') && (
                                                    <CheckCircle2 size={9} className="text-green-600" />
                                                )}
                                            </div>
                                            <span className={s.status === 'done' || s.status === 'Completed' ? 'line-through text-gray-400' : ''}>
                                                {s.title}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Labels */}
                        {task.labels?.length > 0 && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Labels</p>
                                <div className="flex flex-wrap gap-1">
                                    {task.labels.map((l, i) => (
                                        <span key={i} className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full"
                                            style={{ background: '#DEEBFF', color: JIRA_BLUE }}>
                                            <Tag size={8} /> {l}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ── TIME TRACKING ────────────────────────────────── */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Timer size={10} /> Time Tracking
                            </p>

                            {/* Total logged */}
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs text-gray-500">Logged:</span>
                                <span className="text-xs font-bold" style={{ color: JIRA_BLUE }}>
                                    {fmtSeconds(totalTime)}
                                </span>
                                {timerRunning && (
                                    <span className="ml-auto text-xs font-mono font-bold text-green-600 animate-pulse">
                                        +{fmtSeconds(timerElapsed)} ⏱
                                    </span>
                                )}
                            </div>

                            {/* Start / Stop button */}
                            <button
                                onClick={timerRunning ? stopTimer : startTimer}
                                disabled={timerLoading}
                                className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-sm transition-all w-full justify-center"
                                style={{
                                    background: timerRunning ? '#FFEBE6' : '#E3FCEF',
                                    color: timerRunning ? '#FF5630' : '#00875A',
                                    border: `1px solid ${timerRunning ? '#FF5630' : '#00875A'}30`,
                                    opacity: timerLoading ? 0.6 : 1
                                }}
                            >
                                {timerLoading ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : timerRunning ? (
                                    <><StopCircle size={13} /> Stop Timer</>
                                ) : (
                                    <><PlayCircle size={13} /> Start Timer</>
                                )}
                            </button>
                        </div>

                        {/* ── DEPENDENCIES ─────────────────────────────────── */}
                        <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Link2 size={10} /> Dependencies
                            </p>

                            {/* Existing dependencies */}
                            {localDeps.length > 0 ? (
                                <div className="space-y-1 mb-2">
                                    {localDeps.map((dep, i) => {
                                        const depId = dep._id || dep.toString();
                                        const depTitle = dep.title || depId.slice(-8);
                                        return (
                                            <div key={i} className="flex items-center gap-2 text-xs text-gray-700 bg-gray-50 rounded px-2 py-1.5">
                                                <Link2 size={9} className="text-gray-400 flex-shrink-0" />
                                                <span className="flex-1 truncate" title={depId}>{depTitle}</span>
                                                <span className="text-[9px] font-mono text-gray-400">{depId.slice(-6)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-[11px] text-gray-400 italic mb-2">No dependencies</p>
                            )}

                            {/* Add dependency input */}
                            <div className="flex gap-1.5">
                                <input
                                    value={depInput}
                                    onChange={e => setDepInput(e.target.value)}
                                    placeholder="Paste Task ID…"
                                    className="flex-1 text-xs border rounded-sm px-2 py-1.5 focus:outline-none min-w-0"
                                    style={{ borderColor: '#DFE1E6' }}
                                    onFocus={e => e.target.style.borderColor = JIRA_BLUE}
                                    onBlur={e => e.target.style.borderColor = '#DFE1E6'}
                                    onKeyDown={e => e.key === 'Enter' && addDependency()}
                                />
                                <button
                                    onClick={addDependency}
                                    disabled={!depInput.trim() || depLoading}
                                    className="px-2.5 py-1.5 text-[10px] font-bold text-white rounded-sm transition-all disabled:opacity-40"
                                    style={{ background: JIRA_BLUE }}
                                >
                                    {depLoading ? <Loader2 size={10} className="animate-spin" /> : 'Add'}
                                </button>
                            </div>
                        </div>

                        {/* Channel */}
                        {task.project && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Channel</p>
                                <span className="text-xs font-medium text-gray-700">#{task.project}</span>
                            </div>
                        )}

                        {/* Reporter */}
                        {reporter && (
                            <div>
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Reporter</p>
                                <div className="flex items-center gap-2">
                                    <div
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0"
                                        style={{ background: avatarColor(reporter.username || reporter.name || reporter) }}
                                    >
                                        {initials(reporter)}
                                    </div>
                                    <span className="text-xs text-gray-700">{reporter.username || reporter.name || reporter}</span>
                                </div>
                            </div>
                        )}

                        {/* Completion note */}
                        {task.completionNote && (
                            <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200">
                                <p className="text-[10px] font-bold text-emerald-700 mb-1 flex items-center gap-1">
                                    <CheckCircle2 size={10} /> Completion Note
                                </p>
                                <p className="text-xs text-emerald-800 italic">"{task.completionNote}"</p>
                                {task.completedAt && (
                                    <p className="text-[10px] text-emerald-500 mt-1">
                                        {new Date(task.completedAt).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Delete */}
                        <div className="pt-2 border-t" style={{ borderColor: '#DFE1E6' }}>
                            <button
                                onClick={() => onDelete(task.id)}
                                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                            >
                                <Trash2 size={11} /> Delete issue
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-4">
                        <ActivityLog taskId={task.id} />
                    </div>
                )}
            </div>
        </div>
    );
}
