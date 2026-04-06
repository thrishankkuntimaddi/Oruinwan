import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Eye, Activity, Plus, ChevronRight,
    CheckCircle2, Tag, Loader2,
    ArrowRight, User, Edit2, Calendar, Trash2,
    Timer, Link2, PlayCircle, StopCircle
} from 'lucide-react';
import api from '@services/api';
import { useToast } from '../../contexts/ToastContext';

// ─── Design tokens (Monolith Flow) ───────────────────────────────────────────
const T = {
    base: '#0c0c0c',
    surface: '#111111',
    surface2: '#161616',
    border: 'rgba(255,255,255,0.07)',
    borderHover: 'rgba(255,255,255,0.12)',
    text: '#e4e4e4',
    textMuted: 'rgba(228,228,228,0.45)',
    textDim: 'rgba(228,228,228,0.25)',
    amber: '#b8956a',
    amberBg: 'rgba(184,149,106,0.12)',
    amberBorder: 'rgba(184,149,106,0.25)',
};

// ─── Statuses ─────────────────────────────────────────────────────────────────
const WS_STATUSES = [
    { key: 'To Do',      label: 'TO DO',       color: 'rgba(228,228,228,0.5)',  bg: 'rgba(255,255,255,0.06)' },
    { key: 'In Progress',label: 'IN PROGRESS',  color: '#60a5fa',               bg: 'rgba(96,165,250,0.1)'   },
    { key: 'In Review',  label: 'IN REVIEW',    color: '#a78bfa',               bg: 'rgba(167,139,250,0.1)'  },
    { key: 'Completed',  label: 'COMPLETED',    color: '#34d399',               bg: 'rgba(52,211,153,0.1)'   },
    { key: 'Blocked',    label: 'BLOCKED',      color: '#f87171',               bg: 'rgba(248,113,113,0.1)'  },
];
const STATUS_MAP = Object.fromEntries(WS_STATUSES.map(s => [s.key, s]));

// ─── Priorities ───────────────────────────────────────────────────────────────
const WS_PRIORITIES = [
    { key: 'Emergency', label: 'Emergency', color: '#f87171', arrow: '↑↑' },
    { key: 'High',      label: 'High',      color: '#fb923c', arrow: '↑'  },
    { key: 'Medium',    label: 'Medium',    color: T.amber,  arrow: '—'  },
    { key: 'Low',       label: 'Low',       color: '#60a5fa', arrow: '↓'  },
    { key: 'Lowest',    label: 'Lowest',    color: T.textMuted, arrow: '↓↓'},
];
const PRIO_MAP = Object.fromEntries(WS_PRIORITIES.map(p => [p.key, p]));

const TRANSITIONS = {
    'To Do':      ['In Progress', 'Blocked'],
    'In Progress':['In Review', 'Blocked', 'To Do'],
    'In Review':  ['Completed', 'In Progress', 'Blocked'],
    'Completed':  [],
    'Blocked':    ['In Progress', 'To Do'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function avatarColor(name = '') {
    const colors = ['#b8956a', '#60a5fa', '#34d399', '#a78bfa', '#fb923c', '#f472b6', '#38bdf8'];
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
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtSeconds(s) {
    if (!s) return '0m';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${sec}s`;
    return `${sec}s`;
}

// ─── Section label ────────────────────────────────────────────────────────────
const SectionLabel = ({ children, icon }) => (
    <p style={{ fontSize: '10px', fontWeight: 700, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'monospace' }}>
        {icon} {children}
    </p>
);

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

    const ACTION_ICONS = {
        created: <Plus size={10} style={{ color: '#34d399' }} />,
        status_changed: <ArrowRight size={10} style={{ color: '#60a5fa' }} />,
        updated: <Activity size={10} style={{ color: T.amber }} />,
        assignee_added: <User size={10} style={{ color: '#a78bfa' }} />,
        assignee_removed: <User size={10} style={{ color: '#f87171' }} />,
    };

    if (loading) return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', padding: '32px 0', color: T.textMuted, fontSize: '12px' }}>
            <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading activity…
        </div>
    );

    if (!log.length) return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '36px 0', textAlign: 'center' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: T.surface2, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Activity size={13} style={{ color: T.textDim }} />
            </div>
            <p style={{ fontSize: '12px', color: T.textMuted }}>No activity recorded yet.</p>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[...log].reverse().map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: T.surface2, border: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                        {ACTION_ICONS[a.action] || <Activity size={10} style={{ color: T.textDim }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', color: T.text, margin: 0 }}>
                            <span style={{ fontWeight: 700 }}>{a.user?.username || 'Someone'}</span>
                            {' '}
                            <span style={{ color: T.textMuted }}>
                                {a.action === 'created' && 'created this task'}
                                {a.action === 'status_changed' && `moved from ${a.from} → ${a.to}`}
                                {a.action === 'updated' && `updated ${a.field}`}
                                {a.action === 'assignee_added' && 'added an assignee'}
                                {a.action === 'assignee_removed' && 'removed an assignee'}
                                {!['created','status_changed','updated','assignee_added','assignee_removed'].includes(a.action) && a.action}
                            </span>
                        </p>
                        <p style={{ fontSize: '10px', color: T.textDim, marginTop: '2px' }}>
                            {a.createdAt ? new Date(a.createdAt).toLocaleString() : ''}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
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

    // Time tracking
    const [timerRunning, setTimerRunning] = useState(false);
    const [timerElapsed, setTimerElapsed] = useState(0);
    const [timerLoading, setTimerLoading] = useState(false);
    const timerRef = useRef(null);
    const [totalTime, setTotalTime] = useState(task.timeTracking?.totalTime || 0);

    useEffect(() => {
        const hasOpenSession = task.timeTracking?.sessions?.some(s => s.start && !s.end);
        if (hasOpenSession) {
            setTimerRunning(true);
            const openSession = task.timeTracking.sessions.slice().reverse().find(s => s.start && !s.end);
            if (openSession) {
                setTimerElapsed(Math.floor((Date.now() - new Date(openSession.start).getTime()) / 1000));
            }
        }
        setTotalTime(task.timeTracking?.totalTime || 0);
    }, [task.timeTracking]);

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
            setTimerRunning(true); setTimerElapsed(0);
            showToast('Timer started', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to start timer', 'error');
        } finally { setTimerLoading(false); }
    };

    const stopTimer = async () => {
        setTimerLoading(true);
        try {
            const res = await api.post(`/api/v2/tasks/${task.id}/time/stop`);
            setTimerRunning(false); setTimerElapsed(0);
            setTotalTime(res.data.timeTracking?.totalTime || 0);
            showToast(`Timer stopped — +${fmtSeconds(res.data.elapsed)}`, 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to stop timer', 'error');
        } finally { setTimerLoading(false); }
    };

    // Dependencies
    const [depInput, setDepInput] = useState('');
    const [depLoading, setDepLoading] = useState(false);
    const [localDeps, setLocalDeps] = useState(task.dependencies || []);

    const addDependency = async () => {
        if (!depInput.trim()) return;
        setDepLoading(true);
        try {
            const res = await api.post(`/api/v2/tasks/${task.id}/dependency`, { dependencyTaskId: depInput.trim() });
            setLocalDeps(res.data.dependencies || []);
            setDepInput('');
            showToast('Dependency added', 'success');
        } catch (err) {
            showToast(err.response?.data?.message || 'Failed to add dependency', 'error');
        } finally { setDepLoading(false); }
    };

    useEffect(() => {
        setTitle(task.title || '');
        setDesc(task.description || '');
        setLocalDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    }, [task]);

    const save = useCallback(async (updates) => {
        setSaving(true);
        try { await onUpdate(task.id, updates); }
        finally { setSaving(false); }
    }, [task.id, onUpdate]);

    const handleStatusClick = (newStatus) => {
        if (newStatus === 'Blocked') setShowBlockedInput(true);
        else save({ status: newStatus });
    };

    const confirmBlocked = () => {
        if (!blockedReason.trim()) return;
        save({ status: 'Blocked', blockedReason: blockedReason.trim() });
        setShowBlockedInput(false); setBlockedReason('');
    };

    const statusConf = STATUS_MAP[task.status] || STATUS_MAP['To Do'];
    const allowedNext = TRANSITIONS[task.status] || [];
    const assignees = task.assignees || (task.assignee && task.assignee !== 'Self' ? [{ username: task.assignee }] : []);
    const reporter = task.assigner ? { username: task.assigner } : task.createdBy;

    return (
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', width: '320px', height: '100%', background: T.surface, borderLeft: `1px solid ${T.border}`, overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: T.base }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '3px 8px', background: statusConf.bg, color: statusConf.color, border: `1px solid ${statusConf.color}30` }}>
                        {statusConf.label}
                    </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {saving && <Loader2 size={12} style={{ color: T.amber, animation: 'spin 1s linear infinite' }} />}
                    <button onClick={onClose}
                        style={{ padding: '4px', background: 'transparent', border: 'none', color: T.textMuted, cursor: 'pointer', transition: 'color 150ms ease' }}
                        onMouseEnter={e => e.currentTarget.style.color = T.text}
                        onMouseLeave={e => e.currentTarget.style.color = T.textMuted}>
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: `1px solid ${T.border}`, flexShrink: 0, background: T.base }}>
                {[
                    { key: 'details', label: 'Details', icon: <Eye size={11} /> },
                    { key: 'activity', label: 'Activity', icon: <Activity size={11} /> },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', fontSize: '12px', fontWeight: 600, background: 'transparent', border: 'none', borderBottom: tab === t.key ? `2px solid ${T.amber}` : '2px solid transparent', color: tab === t.key ? T.amber : T.textMuted, cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', scrollbarWidth: 'thin' }}>
                {tab === 'details' ? (
                    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                        {/* Issue key */}
                        {task.issueKey && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <CheckCircle2 size={11} style={{ color: T.amber }} />
                                <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: T.textDim }}>{task.issueKey}</span>
                            </div>
                        )}

                        {/* Title */}
                        <div>
                            {editTitle ? (
                                <input autoFocus value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    onBlur={() => { save({ title: title.trim() || task.title }); setEditTitle(false); }}
                                    onKeyDown={e => { if (e.key === 'Enter') { save({ title: title.trim() }); setEditTitle(false); } }}
                                    style={{ width: '100%', fontSize: '14px', fontWeight: 700, color: T.text, background: T.surface2, border: `1px solid ${T.amber}`, padding: '6px 8px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                                />
                            ) : (
                                <p onClick={() => setEditTitle(true)}
                                    style={{ fontSize: '14px', fontWeight: 700, color: T.text, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '6px', padding: '4px 6px', margin: '-4px -6px', transition: 'background 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                                    onMouseEnter={e => e.currentTarget.style.background = T.amberBg}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    <span style={{ flex: 1, lineHeight: 1.4 }}>{task.title}</span>
                                    <Edit2 size={10} style={{ color: T.textDim, flexShrink: 0, marginTop: '4px' }} />
                                </p>
                            )}
                        </div>

                        {/* Description */}
                        <div>
                            <SectionLabel>Description</SectionLabel>
                            {editDesc ? (
                                <textarea autoFocus value={desc}
                                    onChange={e => setDesc(e.target.value)}
                                    rows={3}
                                    onBlur={() => { save({ description: desc }); setEditDesc(false); }}
                                    style={{ width: '100%', fontSize: '12px', color: T.text, background: T.surface2, border: `1px solid ${T.border}`, padding: '8px', outline: 'none', resize: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                                />
                            ) : (
                                <p onClick={() => setEditDesc(true)}
                                    style={{ fontSize: '12px', color: task.description ? T.textMuted : T.textDim, cursor: 'pointer', padding: '6px 8px', margin: '-6px -8px', minHeight: '28px', lineHeight: 1.6, transition: 'background 150ms ease', fontFamily: 'Inter, system-ui, sans-serif', fontStyle: task.description ? 'normal' : 'italic' }}
                                    onMouseEnter={e => e.currentTarget.style.background = T.amberBg}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                    {task.description || 'Click to add description…'}
                                </p>
                            )}
                        </div>

                        {/* Status transitions */}
                        <div>
                            <SectionLabel>Status</SectionLabel>
                            {allowedNext.length === 0 ? (
                                <span style={{ fontSize: '11px', color: T.textDim, fontStyle: 'italic' }}>Terminal status — no transitions.</span>
                            ) : (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {allowedNext.map(ns => {
                                        const nm = STATUS_MAP[ns] || {};
                                        return (
                                            <button key={ns} onClick={() => handleStatusClick(ns)}
                                                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: nm.bg || T.surface2, color: nm.color || T.textMuted, border: `1px solid ${(nm.color || T.textMuted)}30`, cursor: 'pointer', transition: 'opacity 150ms ease' }}
                                                onMouseEnter={e => e.currentTarget.style.opacity = '0.75'}
                                                onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
                                                <ChevronRight size={9} /> {nm.label || ns}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {showBlockedInput && (
                                <div style={{ marginTop: '10px', padding: '10px', background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.2)' }}>
                                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#f87171', marginBottom: '8px' }}>Reason for blocking *</p>
                                    <input autoFocus value={blockedReason}
                                        onChange={e => setBlockedReason(e.target.value)}
                                        placeholder="What is blocking this task?"
                                        style={{ width: '100%', fontSize: '12px', background: T.surface2, border: '1px solid rgba(248,113,113,0.3)', color: T.text, padding: '6px 8px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box' }}
                                        onKeyDown={e => e.key === 'Enter' && confirmBlocked()}
                                    />
                                    <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                                        <button onClick={confirmBlocked}
                                            style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 700, color: '#0c0c0c', background: '#f87171', border: 'none', cursor: 'pointer' }}>
                                            Confirm
                                        </button>
                                        <button onClick={() => setShowBlockedInput(false)}
                                            style={{ padding: '4px 10px', fontSize: '11px', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Priority */}
                        <div>
                            <SectionLabel>Priority</SectionLabel>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {WS_PRIORITIES.map(p => (
                                    <button key={p.key} onClick={() => save({ priority: p.key })}
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, background: task.priority === p.key ? `${p.color}18` : T.surface2, color: p.color, border: task.priority === p.key ? `1px solid ${p.color}50` : `1px solid ${T.border}`, cursor: 'pointer', transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                        <span style={{ fontSize: '9px', fontWeight: 700 }}>{p.arrow}</span>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Assignees */}
                        <div>
                            <SectionLabel>Assignee</SectionLabel>
                            {assignees.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {assignees.map((a, i) => {
                                        const name = a.username || a.name || a.email || '?';
                                        return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0c0c0c', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                                                    {initials(a)}
                                                </div>
                                                <span style={{ fontSize: '12px', fontWeight: 500, color: T.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : members.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '128px', overflowY: 'auto' }}>
                                    {members.slice(0, 8).map(m => {
                                        const name = m.username || m.name || m.email || '?';
                                        return (
                                            <button key={m._id || m.id} onClick={() => save({ assignedToIds: [m._id || m.id] })}
                                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', transition: 'background 150ms ease' }}
                                                onMouseEnter={e => e.currentTarget.style.background = T.amberBg}
                                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: avatarColor(name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0c0c0c', fontSize: '8px', fontWeight: 700, flexShrink: 0 }}>
                                                    {initials(m)}
                                                </div>
                                                <span style={{ fontSize: '12px', color: T.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <span style={{ fontSize: '12px', color: T.textDim, fontStyle: 'italic' }}>Unassigned</span>
                            )}
                        </div>

                        {/* Due Date */}
                        <div>
                            <SectionLabel icon={<Calendar size={10} />}>Due Date</SectionLabel>
                            <input type="date" value={localDueDate}
                                onChange={e => { setLocalDueDate(e.target.value); save({ dueDate: e.target.value || null }); }}
                                style={{ width: '100%', fontSize: '12px', background: T.surface2, border: `1px solid ${T.border}`, color: T.text, padding: '6px 8px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', boxSizing: 'border-box', colorScheme: 'dark' }}
                            />
                            {task.dueDate && (
                                <p style={{ fontSize: '11px', color: T.textMuted, marginTop: '4px' }}>{fmtDate(task.dueDate)}</p>
                            )}
                        </div>

                        {/* Child Issues */}
                        {(task.subtasks?.length > 0 || task.childIssues?.length > 0) && (
                            <div>
                                <SectionLabel>Child Issues ({(task.subtasks || task.childIssues || []).length})</SectionLabel>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {(task.subtasks || task.childIssues || []).map((s, i) => (
                                        <div key={s._id || i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: T.textMuted, padding: '3px 4px', transition: 'background 150ms ease' }}
                                            onMouseEnter={e => e.currentTarget.style.background = T.surface2}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <div style={{ width: '12px', height: '12px', border: `1px solid ${s.status === 'Completed' || s.status === 'done' ? '#34d399' : T.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                {(s.status === 'done' || s.status === 'Completed') && <CheckCircle2 size={9} style={{ color: '#34d399' }} />}
                                            </div>
                                            <span style={{ textDecoration: (s.status === 'done' || s.status === 'Completed') ? 'line-through' : 'none', color: (s.status === 'done' || s.status === 'Completed') ? T.textDim : T.textMuted }}>
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
                                <SectionLabel>Labels</SectionLabel>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                    {task.labels.map((l, i) => (
                                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '10px', background: T.amberBg, color: T.amber, border: `1px solid ${T.amberBorder}` }}>
                                            <Tag size={8} /> {l}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Time Tracking */}
                        <div>
                            <SectionLabel icon={<Timer size={10} />}>Time Tracking</SectionLabel>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <span style={{ fontSize: '12px', color: T.textMuted }}>Logged:</span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: T.amber }}>{fmtSeconds(totalTime)}</span>
                                {timerRunning && (
                                    <span style={{ marginLeft: 'auto', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: '#34d399' }}>
                                        +{fmtSeconds(timerElapsed)} ⏱
                                    </span>
                                )}
                            </div>
                            <button onClick={timerRunning ? stopTimer : startTimer} disabled={timerLoading}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', padding: '10px', fontSize: '12px', fontWeight: 700, background: timerRunning ? 'rgba(248,113,113,0.1)' : 'rgba(52,211,153,0.1)', color: timerRunning ? '#f87171' : '#34d399', border: `1px solid ${timerRunning ? 'rgba(248,113,113,0.25)' : 'rgba(52,211,153,0.25)'}`, cursor: timerLoading ? 'not-allowed' : 'pointer', opacity: timerLoading ? 0.6 : 1, transition: 'all 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}>
                                {timerLoading ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                    : timerRunning ? <><StopCircle size={13} /> Stop Timer</>
                                    : <><PlayCircle size={13} /> Start Timer</>}
                            </button>
                        </div>

                        {/* Dependencies */}
                        <div>
                            <SectionLabel icon={<Link2 size={10} />}>Dependencies</SectionLabel>
                            {localDeps.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                                    {localDeps.map((dep, i) => {
                                        const depId = dep._id || dep.toString();
                                        const depTitle = dep.title || depId.slice(-8);
                                        return (
                                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: T.textMuted, background: T.surface2, border: `1px solid ${T.border}`, padding: '6px 10px' }}>
                                                <Link2 size={9} style={{ color: T.textDim, flexShrink: 0 }} />
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{depTitle}</span>
                                                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: T.textDim }}>{depId.slice(-6)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p style={{ fontSize: '11px', color: T.textDim, fontStyle: 'italic', marginBottom: '8px' }}>No dependencies</p>
                            )}
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input value={depInput} onChange={e => setDepInput(e.target.value)}
                                    placeholder="Paste Task ID…"
                                    style={{ flex: 1, fontSize: '12px', background: T.surface2, border: `1px solid ${T.border}`, color: T.text, padding: '6px 8px', outline: 'none', fontFamily: 'Inter, system-ui, sans-serif', minWidth: 0 }}
                                    onFocus={e => e.target.style.borderColor = T.amber}
                                    onBlur={e => e.target.style.borderColor = T.border}
                                    onKeyDown={e => e.key === 'Enter' && addDependency()}
                                />
                                <button onClick={addDependency} disabled={!depInput.trim() || depLoading}
                                    style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, color: '#0c0c0c', background: T.amber, border: 'none', cursor: depInput.trim() && !depLoading ? 'pointer' : 'not-allowed', opacity: !depInput.trim() || depLoading ? 0.5 : 1, transition: 'opacity 150ms ease' }}>
                                    {depLoading ? <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} /> : 'Add'}
                                </button>
                            </div>
                        </div>

                        {/* Channel */}
                        {task.project && (
                            <div>
                                <SectionLabel>Channel</SectionLabel>
                                <span style={{ fontSize: '12px', fontWeight: 500, color: T.textMuted }}>#{task.project}</span>
                            </div>
                        )}

                        {/* Reporter */}
                        {reporter && (
                            <div>
                                <SectionLabel>Reporter</SectionLabel>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: avatarColor(reporter.username || reporter.name || reporter), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0c0c0c', fontSize: '8px', fontWeight: 700, flexShrink: 0 }}>
                                        {initials(reporter)}
                                    </div>
                                    <span style={{ fontSize: '12px', color: T.textMuted }}>{reporter.username || reporter.name || reporter}</span>
                                </div>
                            </div>
                        )}

                        {/* Completion note */}
                        {task.completionNote && (
                            <div style={{ padding: '10px', background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.18)' }}>
                                <p style={{ fontSize: '10px', fontWeight: 700, color: '#34d399', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={10} /> Completion Note
                                </p>
                                <p style={{ fontSize: '12px', color: 'rgba(52,211,153,0.7)', fontStyle: 'italic' }}>"{task.completionNote}"</p>
                                {task.completedAt && (
                                    <p style={{ fontSize: '10px', color: 'rgba(52,211,153,0.4)', marginTop: '4px' }}>
                                        {new Date(task.completedAt).toLocaleDateString()}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Delete */}
                        <div style={{ paddingTop: '8px', borderTop: `1px solid ${T.border}` }}>
                            <button onClick={() => onDelete(task.id)}
                                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', transition: 'color 150ms ease', fontFamily: 'Inter, system-ui, sans-serif' }}
                                onMouseEnter={e => e.currentTarget.style.color = '#fca5a5'}
                                onMouseLeave={e => e.currentTarget.style.color = '#f87171'}>
                                <Trash2 size={11} /> Delete issue
                            </button>
                        </div>

                    </div>
                ) : (
                    <div style={{ padding: '16px' }}>
                        <ActivityLog taskId={task.id} />
                    </div>
                )}
            </div>
        </div>
    );
}
